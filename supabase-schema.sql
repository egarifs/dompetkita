create table if not exists public.finance_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.finance_snapshots enable row level security;

drop policy if exists "Users can read their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can insert their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can update their own finance snapshot" on public.finance_snapshots;

create policy "Users can read their own finance snapshot"
on public.finance_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own finance snapshot"
on public.finance_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own finance snapshot"
on public.finance_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
