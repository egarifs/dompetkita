create table if not exists public.finance_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_finance_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_finance_snapshot_updated_at on public.finance_snapshots;
create trigger set_finance_snapshot_updated_at
before update on public.finance_snapshots
for each row
execute function public.set_finance_snapshot_updated_at();

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  child_user_id uuid references auth.users(id) on delete set null,
  child_email text not null,
  child_name text not null,
  phone text not null default '',
  role text not null default 'child',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_role_check check (role = 'child'),
  constraint family_members_status_check check (status in ('active', 'inactive')),
  constraint family_members_parent_child_email_unique unique (parent_user_id, child_email)
);

create index if not exists family_members_child_email_status_idx
on public.family_members (child_email, status);

create index if not exists family_members_parent_user_id_idx
on public.family_members (parent_user_id);

drop trigger if exists set_family_member_updated_at on public.family_members;
create trigger set_family_member_updated_at
before update on public.family_members
for each row
execute function public.set_finance_snapshot_updated_at();

alter table public.finance_snapshots enable row level security;
alter table public.family_members enable row level security;

drop policy if exists "Users can read their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can insert their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can update their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Family children can read parent finance snapshot" on public.finance_snapshots;

drop policy if exists "Parents can read their family members" on public.family_members;
drop policy if exists "Children can read their own family access" on public.family_members;
drop policy if exists "Parents can insert family members" on public.family_members;
drop policy if exists "Parents can update family members" on public.family_members;
drop policy if exists "Parents can delete family members" on public.family_members;

create policy "Users can read their own finance snapshot"
on public.finance_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Family children can read parent finance snapshot"
on public.finance_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members member
    where member.parent_user_id = public.finance_snapshots.user_id
      and member.status = 'active'
      and member.child_email = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "Users can insert their own finance snapshot"
on public.finance_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own finance snapshot"
on public.finance_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Parents can read their family members"
on public.family_members
for select
to authenticated
using ((select auth.uid()) = parent_user_id);

create policy "Children can read their own family access"
on public.family_members
for select
to authenticated
using (child_email = lower((select auth.jwt() ->> 'email')));

create policy "Parents can insert family members"
on public.family_members
for insert
to authenticated
with check ((select auth.uid()) = parent_user_id);

create policy "Parents can update family members"
on public.family_members
for update
to authenticated
using ((select auth.uid()) = parent_user_id)
with check ((select auth.uid()) = parent_user_id);

create policy "Parents can delete family members"
on public.family_members
for delete
to authenticated
using ((select auth.uid()) = parent_user_id);

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if current_user_id is null then
    raise exception 'Sesi login cloud tidak aktif.';
  end if;

  delete from public.family_members
  where parent_user_id = current_user_id
    or child_user_id = current_user_id
    or (current_user_email <> '' and child_email = current_user_email);

  delete from public.finance_snapshots
  where user_id = current_user_id;

  delete from auth.users
  where id = current_user_id;
end;
$$;

revoke all on function public.delete_current_user() from public;
revoke all on function public.delete_current_user() from anon;
grant execute on function public.delete_current_user() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'finance_snapshots'
  ) then
    alter publication supabase_realtime add table public.finance_snapshots;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_members'
  ) then
    alter publication supabase_realtime add table public.family_members;
  end if;
end $$;
