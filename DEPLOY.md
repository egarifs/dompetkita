# Deploy Aplikasi Pencatatan Keuangan

## Pilihan hosting

Aplikasi ini adalah web statis, jadi bisa di-host di layanan gratis seperti Cloudflare Pages, Netlify, atau GitHub Pages. Upload seluruh isi folder ini sebagai static site.

Rekomendasi paling simpel:

1. Cloudflare Pages atau Netlify untuk hosting.
2. Supabase untuk database PostgreSQL gratis/hosted, atau self-host Supabase kalau ingin sepenuhnya dikelola sendiri.

## Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `supabase-schema.sql`.
   Jalankan ulang file ini pada project lama agar RPC `delete_current_user()` untuk penghapusan akun permanen tersedia.
4. Buka Authentication > Providers, lalu pastikan Email aktif agar user bisa registrasi dari halaman login.
5. Buka Project Settings, lalu API.
6. Salin Project URL dan anon public key.
7. Isi `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://PROJECT_ID.supabase.co",
  supabaseAnonKey: "ANON_PUBLIC_KEY",
  supabaseTable: "finance_snapshots",
};
```

Setelah `config.js` diisi, halaman login memakai email/password Supabase dan user bisa membuat akun sendiri lewat tombol Registrasi. Data otomatis tersimpan ke database per akun login.

## Login Google

Untuk memakai tombol Masuk Google:

1. Buka Authentication > Providers > Google di Supabase.
2. Aktifkan provider Google.
3. Isi Client ID dan Client Secret dari Google Cloud Console.
4. Masukkan domain hosting aplikasi ke Authentication > URL Configuration sebagai Site URL.
5. Tambahkan URL redirect yang diminta Supabase ke konfigurasi OAuth Google.

Jika Google provider belum aktif, tombol Masuk Google akan gagal dari Supabase meskipun tombolnya sudah muncul di aplikasi.

## Deploy cepat

Upload file berikut ke hosting statis:

- `index.html`
- `config.js`
- `manifest.webmanifest`
- `sw.js`
- folder `icons`

Kalau belum ingin memakai database, biarkan `config.js` kosong. Aplikasi tetap berjalan dengan data lokal di perangkat.
