# Dompify

Dompify adalah aplikasi pencatatan keuangan personal/keluarga berbasis web statis. Aplikasi ini mendukung pencatatan pemasukan, pengeluaran, budget, tabungan, reminder tagihan, hutang piutang, kendaraan, mode tamu, penyimpanan lokal, dan sinkronisasi cloud memakai Supabase.

## Teknologi Utama

- **HTML, CSS, JavaScript vanilla**: aplikasi dibuat sebagai static web app tanpa framework besar agar ringan dan mudah dideploy.
- **Supabase Auth + PostgreSQL**: dipakai untuk registrasi, login, reset password, login Google, dan penyimpanan snapshot data per user.
- **LocalStorage**: dipakai untuk data lokal, session, preferensi, dan mode offline/lokal.
- **Supabase Realtime**: dipakai agar data antar perangkat bisa saling update saat cloud sync aktif.
- **Netlify**: hosting static site dan build otomatis.
- **Playwright**: tersedia untuk test UI tertentu, walaupun critical flow test utama dibuat tanpa browser agar lebih stabil.

## Struktur Project

```text
.
├── index.html                 # Struktur halaman utama, view, modal, dan layout aplikasi
├── app.js                     # Logic utama aplikasi dan render UI
├── styles.css                 # Styling aplikasi
├── config.example.js          # Template konfigurasi Supabase
├── config.js                  # Konfigurasi lokal/deploy, jangan isi secret service-role
├── supabase-schema.sql        # SQL schema Supabase
├── netlify.toml               # Konfigurasi build Netlify
├── build.js                   # Validasi build dan generator app metadata
├── app-meta.js                # Metadata versi/changelog hasil build
├── quotes.js                  # Quote lokal untuk splash screen
├── manifest.webmanifest       # Manifest PWA
├── sw.js                      # Service worker/cache PWA
├── icons/                     # Icon aplikasi
├── js/
│   ├── constants.js           # Konstanta app, storage key, kategori default, timeout idle
│   ├── utils.js               # Helper tanggal, format uang, escape HTML, parsing angka
│   ├── state.js               # Normalisasi state, demo state, helper data
│   ├── storage.js             # Wrapper LocalStorage
│   ├── auth.js                # Helper auth lokal/session/remembered login
│   └── cloud.js               # Helper Supabase cloud sync dan realtime
└── test/
    ├── critical-flows.spec.mjs      # Test otomatis flow penting
    ├── sync-helper-context.spec.mjs # Test helper sync/cloud
    └── *.spec.mjs                  # Test UI/guest/auth tambahan
```

## Struktur Data Aplikasi

Data utama aplikasi disimpan sebagai satu snapshot JSON per user. Di sisi aplikasi, struktur besar state berisi:

- `transactions`: transaksi pemasukan/pengeluaran.
- `budgets`: budget per kategori.
- `debts`: hutang dan piutang.
- `savings`: tujuan tabungan dan riwayat setoran/tarik.
- `billReminders`: reminder tagihan.
- `recurring`: transaksi berulang.
- `vehicles`: data kendaraan.
- `vehicleServices`: riwayat service.
- `vehicleOilChanges`: jadwal ganti oli.
- `vehicleParts`: penggantian part.
- `vehicleTaxes`: pajak kendaraan.
- `categories`: daftar kategori.
- `wallets`: daftar dompet.
- `deleted`: daftar id data yang sudah dihapus agar sync tidak memunculkan data lama kembali.
- `settings`: preferensi user seperti dark mode, bahasa, urutan dashboard, dan cloud sync.
- `syncStatus`: `synced`, `pending`, atau `failed`.
- `localChangedAt`: waktu perubahan lokal terakhir.

Field penting pada transaksi:

```js
{
  id: "transaction-id",
  type: "income" | "expense",
  date: "2026-05-25",
  category: "Makanan",
  subcategory: "",
  description: "Belanja",
  amount: 25000,
  sourceModule: "manual" | "vehicles" | "recurring",
  sourceId: "",
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

Relasi kendaraan ke transaksi memakai:

- `sourceModule: "vehicles"`
- `sourceId`: id data service/oli/part/pajak/biaya kendaraan.
- `vehicleId`: id kendaraan.
- `vehicleRecordId`: id record kendaraan.
- `vehicleRecordType`: contoh `Service`, `Oli`, `Spare Part`, `Pajak`, `Bensin`.

## Struktur Database Supabase

Schema database ada di [supabase-schema.sql](./supabase-schema.sql). Saat ini database memakai tabel snapshot:

```sql
public.finance_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
)
```

Alasan memakai snapshot JSON:

- Lebih sederhana untuk static web app.
- Mudah menyimpan banyak modul tanpa migrasi tabel setiap ada fitur baru.
- Cocok untuk kebutuhan sync satu payload per user.

Keamanan database:

- Row Level Security aktif.
- User hanya bisa membaca, insert, dan update snapshot miliknya sendiri.
- `user_id` harus sama dengan `auth.uid()`.

Realtime:

- Tabel `finance_snapshots` dimasukkan ke publication `supabase_realtime`.
- Ini dipakai agar perubahan dari web bisa masuk ke app, dan sebaliknya.

## Setup Supabase

1. Buat project di Supabase.
2. Buka **SQL Editor**.
3. Jalankan seluruh isi file:

```text
supabase-schema.sql
```

4. Buka **Authentication > Providers**.
5. Aktifkan **Email**.
6. Jika ingin user baru langsung bisa login setelah registrasi, nonaktifkan email confirmation atau sesuaikan flow verifikasi email.
7. Untuk Google Login:
   - Aktifkan provider Google di Supabase.
   - Isi Client ID dan Client Secret dari Google Cloud Console.
   - Tambahkan URL aplikasi ke **Authentication > URL Configuration**.
   - Tambahkan redirect URL Supabase ke OAuth Google.
8. Buka **Project Settings > API**.
9. Salin:
   - Project URL
   - anon public key

## Konfigurasi `config.js`

Copy file contoh:

```bash
cp config.example.js config.js
```

Isi `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://PROJECT_ID.supabase.co",
  supabaseAnonKey: "ANON_PUBLIC_KEY",
  supabaseTable: "finance_snapshots",
  resetPasswordRedirectUrl: "https://dompify.netlify.app/",
};
```

Catatan penting:

- Gunakan **anon public key**, bukan service role key.
- Jangan pernah menaruh Supabase `service_role` di aplikasi frontend.
- Untuk deploy public, pastikan `resetPasswordRedirectUrl` mengarah ke domain Netlify.
- Jika `config.js` kosong/tidak valid, fitur cloud login/sync tidak aktif dan aplikasi berjalan lokal.

## Konfigurasi Netlify

File [netlify.toml](./netlify.toml) sudah tersedia:

```toml
[build]
  command = "npm run build"
  publish = "."

[build.environment]
  NODE_VERSION = "20"
```

Konfigurasi di dashboard Netlify:

- **Build command**: `npm run build`
- **Publish directory**: `.`
- **Node version**: `20`

Karena aplikasi ini static, publish directory adalah root project (`.`).

## Deploy Otomatis via Git

Cara umum:

1. Push project ke GitHub/GitLab/Bitbucket.
2. Buka Netlify.
3. Pilih **Add new site > Import an existing project**.
4. Hubungkan repository.
5. Pastikan build settings:

```text
Build command: npm run build
Publish directory: .
```

6. Setiap `git push origin main`, Netlify otomatis menjalankan build dan deploy.

## Deploy via Terminal

Install Netlify CLI:

```bash
npm install -g netlify-cli
```

Login:

```bash
netlify login
```

Hubungkan folder project ke site Netlify:

```bash
netlify init
```

Build lokal:

```bash
npm run build
```

Deploy preview:

```bash
netlify deploy --build --dir=.
```

Deploy production:

```bash
netlify deploy --prod --build --dir=.
```

Deploy otomatis lewat Git tetap direkomendasikan untuk workflow harian. Deploy terminal berguna untuk preview cepat atau publish manual.

## Menjalankan Project Lokal

Install dependency:

```bash
npm install
```

Build/validasi static files:

```bash
npm run build
```

Jalankan test utama:

```bash
npm test
```

Test critical flow saja:

```bash
npm run test:critical
```

Karena aplikasi static, file `index.html` bisa dibuka langsung. Untuk testing PWA/service worker, gunakan local server, misalnya:

```bash
npx serve .
```

## Testing Otomatis

Script penting:

- `npm run build`: validasi file wajib dan syntax JS.
- `npm test`: build + critical flow + sync context.
- `npm run test:critical`: test registrasi/login, tambah transaksi, hapus transaksi, tabungan, kendaraan ke transaksi, dan sync cloud mock.
- `npm run test:sync-context`: test helper sync/cloud dan normalisasi data.
- `npm run test:ui`: test UI splash dan guest flow.

## Catatan Arsitektur untuk Developer Berikutnya

1. **Jangan langsung edit banyak logic di `app.js` tanpa mencari helper yang sudah ada.** Beberapa logic sudah dipisah ke folder `js/`, terutama state, auth, storage, cloud, dan utils.

2. **Selalu normalisasi state lewat `window.AppState.normalizeState`.** Ini penting agar data lama tetap kompatibel setelah fitur baru ditambahkan.

3. **Setiap perubahan data harus memanggil flow persist/sync.** Pola utama di `app.js` adalah:
   - ubah `state`
   - panggil `persistChanges(...)`
   - data lokal tersimpan
   - cloud sync berjalan jika aktif

4. **Untuk delete data, gunakan deletion marker.** Data yang dihapus disimpan di `state.deleted` agar tidak muncul lagi setelah sync/refresh.

5. **Mode tamu berbeda dengan user login.** Mode tamu memakai demo state dan tidak menyimpan data ke cloud.

6. **Cloud sync event-based.** Sync tidak berjalan berdasarkan interval setiap menit. Sync dipicu saat ada perubahan data, manual sync, dan realtime update.

7. **Jangan hapus `config.example.js`.** File ini menjadi panduan konfigurasi aman untuk developer/deploy baru.

8. **Hati-hati dengan `app-meta.js`.** File ini digenerate oleh `npm run build` dari Git history. Kalau berubah saat development, pastikan memang ingin ikut dikomit.

9. **Jangan commit secret.** `config.js` hanya boleh berisi public anon key Supabase. Jika project dipublish open source, pertimbangkan memakai `config.example.js` saja dan atur `config.js` saat deploy.

10. **Jika menambah modul baru, update test.** Minimal tambahkan coverage di `test/critical-flows.spec.mjs` atau test baru yang tidak bergantung ke browser jika memungkinkan.

## Checklist Sebelum Deploy

```bash
npm install
npm test
git status
git add .
git commit -m "Your change"
git push origin main
```

Setelah push ke branch yang terhubung Netlify, deploy otomatis akan berjalan.
