# PRD Dompify

## 1. Ringkasan Produk

Dompify adalah aplikasi pencatatan keuangan personal dan keluarga berbasis web statis/PWA. Produk membantu pengguna mencatat transaksi harian, memantau saldo dompet, mengatur anggaran, mengelola tabungan, hutang/piutang, reminder tagihan, transaksi berulang, biaya kendaraan, serta melihat ringkasan kesehatan keuangan.

Produk dirancang ringan, mudah dipasang di perangkat mobile, tetap bisa berjalan secara lokal, dan mendukung sinkronisasi cloud menggunakan Supabase saat konfigurasi tersedia.

## 2. Latar Belakang

Banyak pengguna mencatat keuangan secara terpisah di catatan, spreadsheet, aplikasi dompet digital, atau ingatan. Akibatnya, mereka sulit menjawab pertanyaan sederhana seperti:

- Uang bulan ini paling banyak habis untuk apa?
- Sisa saldo semua dompet berapa?
- Anggaran kategori tertentu sudah aman atau lewat batas?
- Hutang/piutang mana yang belum selesai?
- Target tabungan sudah sampai mana?
- Biaya kendaraan bulan ini dan tahun ini berapa?

Dompify menyatukan kebutuhan tersebut dalam satu aplikasi sederhana yang fokus pada pencatatan rutin, visibilitas saldo, dan keputusan keuangan yang lebih tenang.

## 3. Tujuan Produk

Tujuan utama:

- Memudahkan pengguna mencatat pemasukan dan pengeluaran harian.
- Memberikan ringkasan saldo, pengeluaran, pemasukan, anggaran, hutang/piutang, dan net worth.
- Membantu pengguna menjalankan kebiasaan budgeting, menabung, membayar hutang, dan memantau tagihan.
- Menyediakan mode lokal/offline-friendly serta opsi cloud sync.
- Menjadi PWA ringan yang bisa dipakai di mobile maupun desktop.

Tujuan non-produk:

- Tidak menjadi aplikasi akuntansi kompleks.
- Tidak menggantikan layanan bank atau dompet digital.
- Tidak memproses pembayaran langsung.
- Tidak menyimpan credential rahasia di frontend.

## 4. Target Pengguna

### Pengguna Utama

Individu yang ingin mencatat keuangan pribadi secara rutin, terutama pemasukan, pengeluaran, saldo dompet, budget, tabungan, dan hutang/piutang.

### Pengguna Keluarga

Keluarga kecil yang ingin memantau keuangan bersama, dengan parent account sebagai pemilik data dan child account untuk akses baca atau akses terbatas.

### Pengguna Evaluasi

Pengguna baru yang ingin mencoba aplikasi tanpa registrasi melalui mode tamu.

## 5. Persona

### Persona 1: Pencatat Harian

- Membuka aplikasi beberapa kali seminggu.
- Butuh input transaksi cepat.
- Butuh ringkasan saldo dan pengeluaran bulan ini.
- Sensitif terhadap form yang terlalu panjang atau lambat.

### Persona 2: Pengelola Keuangan Keluarga

- Mengatur budget kategori, hutang/piutang, tagihan, dan tabungan.
- Butuh data sinkron antar perangkat.
- Butuh export data untuk arsip atau analisis lanjutan.

### Persona 3: Pemilik Kendaraan

- Ingin melacak biaya service, oli, part, pajak, dan bensin.
- Ingin biaya kendaraan otomatis masuk ke transaksi agar laporan tetap akurat.

## 6. Masalah Pengguna

- Pencatatan transaksi sering tertunda karena input terasa ribet.
- Data saldo terpencar di beberapa dompet.
- Budget sulit dipantau jika transaksi tidak langsung terkait kategori.
- Hutang/piutang sering lupa nominal sisa dan riwayat pembayarannya.
- Tagihan dan transaksi rutin mudah terlewat.
- Biaya kendaraan jarang dihitung sebagai bagian dari pengeluaran rutin.
- Pengguna ingin data aman secara lokal, tetapi tetap punya opsi sinkronisasi.

## 7. Prinsip Produk

- Cepat untuk input harian.
- Data nominal selalu disimpan sebagai angka, bukan string tampilan.
- Local-first: aplikasi tetap berguna meski cloud sync tidak aktif.
- Sinkronisasi harus menjaga data yang dihapus agar tidak muncul kembali.
- UI mobile-first, tetapi tetap nyaman di desktop.
- Fitur kompleks harus tetap terasa ringan melalui progressive disclosure.
- Data keuangan harus mudah diekspor.

## 8. Ruang Lingkup Fitur

### 8.1 Autentikasi dan Akses

Fitur:

- Login email/password.
- Registrasi akun.
- Reset password.
- Login Google jika Supabase OAuth dikonfigurasi.
- Remember login.
- Mode tamu untuk mencoba aplikasi.
- Role admin, user, guest, dan child.
- PIN lokal untuk proteksi akses aplikasi.
- Idle auto logout.

Acceptance criteria:

- User login dapat membuka data miliknya.
- Guest dapat mencoba aplikasi dengan data demo dan batas transaksi.
- Child account tidak dapat mengubah data utama jika aksesnya read-only.
- Reset password mengikuti flow Supabase saat cloud aktif.

### 8.2 Dashboard

Fitur:

- Ringkasan total saldo.
- Ringkasan pemasukan dan pengeluaran bulan ini.
- Ringkasan sisa anggaran.
- Ringkasan hutang/piutang.
- Insight otomatis dari pola transaksi.
- Transaksi terakhir.
- Ringkasan tabungan.
- Ringkasan kendaraan.
- Pengaturan urutan section dashboard.

Acceptance criteria:

- Dashboard menampilkan angka berdasarkan data state terbaru.
- Total saldo dapat disembunyikan/ditampilkan.
- Ringkasan berubah setelah transaksi, dompet, budget, hutang/piutang, atau tabungan berubah.

### 8.3 Dompet

Fitur:

- Tambah/edit/hapus dompet.
- Tipe dompet: Cash, Bank, E-Wallet, Savings.
- Saldo awal.
- Saldo berjalan dihitung dari saldo awal dan transaksi.
- Detail dompet dan mutasi transaksi.

Acceptance criteria:

- Saldo dompet bertambah untuk income dan berkurang untuk expense.
- Dompet yang sudah dipakai transaksi tidak boleh dihapus sembarangan.
- Saldo awal disimpan sebagai number.

### 8.4 Transaksi

Fitur:

- Tambah/edit/hapus transaksi.
- Tipe transaksi: pemasukan, pengeluaran, bayar hutang, terima piutang.
- Tanggal, kategori, subkategori, deskripsi, dompet, budget, dan nominal.
- Filter transaksi berdasarkan bulan, tipe, dompet, dan pencarian.
- Detail transaksi.
- Foto struk lokal/preview/hapus.
- Undo untuk penghapusan penting.

Acceptance criteria:

- Nominal transaksi wajib lebih dari 0.
- Transaksi expense mengurangi saldo dompet.
- Transaksi income menambah saldo dompet.
- Pembayaran hutang/piutang tidak boleh melebihi sisa.
- Foto struk tidak merusak struktur snapshot.

### 8.5 Input Nominal

Fitur:

- MoneyInput reusable untuk seluruh field nominal.
- User dapat mengetik nominal langsung.
- Format otomatis Rupiah dengan prefix `Rp` dan titik ribuan.
- Tombol/link kecil "Gunakan Kalkulator".
- MoneyCalculator muncul hanya saat link diklik.
- Calculator mendukung angka 0-9, 000, operator +, -, x, /, =, C, backspace, Batal, dan Gunakan.

Acceptance criteria:

- Input `150000` tampil sebagai `Rp150.000`.
- Nilai state/database tetap number `150000`.
- Calculator tidak muncul saat field fokus.
- Klik Batal tidak mengubah nilai field.
- Klik Gunakan memasukkan hasil akhir ke field.
- NaN, pembagian dengan 0, dan hasil negatif tidak diizinkan untuk nominal umum.

### 8.6 Anggaran

Fitur:

- Tambah/edit/hapus anggaran.
- Budget per kategori.
- Tipe income/expense.
- Periode daily, weekly, monthly, yearly.
- Parent dan sub kategori.
- Validasi total sub budget tidak melebihi parent.
- Progress pemakaian budget.

Acceptance criteria:

- Budget usage dihitung dari transaksi yang sesuai kategori/budget.
- Remaining amount dihitung dari limit dikurangi pemakaian.
- Parent-child budget tidak boleh melingkar.
- Limit budget disimpan sebagai number.

### 8.7 Hutang dan Piutang

Fitur:

- Tambah hutang/piutang.
- Status belum lunas, sebagian, lunas.
- Tanggal, jatuh tempo, orang, deskripsi, nominal.
- Pembayaran hutang melalui transaksi.
- Penerimaan piutang melalui transaksi.
- Riwayat pembayaran.
- Riwayat hutang/piutang lunas.

Acceptance criteria:

- Nominal hutang/piutang wajib lebih dari 0.
- Sisa hutang/piutang dihitung dari total dikurangi pembayaran terkait.
- Pembayaran tidak boleh melebihi sisa.
- Status mengikuti riwayat pembayaran.

### 8.8 Tabungan

Fitur:

- Tambah/edit/hapus tujuan tabungan.
- Kategori tabungan.
- Nominal target.
- Target tanggal.
- Setoran dan penarikan.
- Riwayat tabungan.
- Progress pencapaian.

Acceptance criteria:

- Target tabungan wajib lebih dari 0.
- Setoran menambah saldo goal.
- Penarikan mengurangi saldo goal.
- Progress dihitung akurat dari entries.

### 8.9 Reminder Tagihan

Fitur:

- Tambah/edit/hapus reminder tagihan.
- Nama tagihan, kategori, nominal, jatuh tempo, catatan, status.
- Pengingat harian dengan jam reminder.

Acceptance criteria:

- Nominal reminder wajib lebih dari 0.
- Reminder tampil pada area yang relevan.
- Status dapat digunakan untuk membedakan tagihan aktif/terbayar.

### 8.10 Transaksi Berulang

Fitur:

- Tambah/hapus transaksi berulang.
- Tipe income/expense.
- Kategori, dompet, nominal, tanggal bulanan, deskripsi.
- Terapkan transaksi berulang ke bulan berjalan.

Acceptance criteria:

- Nominal transaksi berulang wajib lebih dari 0.
- Apply recurring tidak membuat duplikasi untuk periode yang sama.
- Transaksi hasil recurring mencatat `sourceModule: "recurring"`.

### 8.11 Kendaraan

Fitur:

- Tambah/edit/hapus kendaraan.
- Data kendaraan: nama, plat, merk, model, tahun, jenis, transmisi, kilometer, tanggal pembelian, catatan.
- Service kendaraan.
- Jadwal ganti oli.
- Penggantian part.
- Pajak kendaraan.
- Biaya kendaraan umum seperti bensin.
- Biaya kendaraan otomatis membuat/menyesuaikan transaksi.

Acceptance criteria:

- Biaya kendaraan tidak boleh negatif.
- Biaya kendaraan yang valid masuk ke transaksi dengan `sourceModule: "vehicles"`.
- Hapus record kendaraan ikut menjaga transaksi terkait agar laporan tetap konsisten.

### 8.12 Laporan dan Analitik

Fitur:

- Grafik saldo dan anggaran.
- Pengeluaran per kategori.
- Pengeluaran harian.
- Summary pemasukan, pengeluaran, sisa anggaran, hutang/piutang.
- Net worth atau neraca keuangan.

Acceptance criteria:

- Laporan menghitung data dari transaksi, dompet, hutang/piutang, dan tabungan terbaru.
- Net worth memperhitungkan aset dan kewajiban.
- Angka laporan memakai format Rupiah.

### 8.13 Sinkronisasi Cloud

Fitur:

- LocalStorage sebagai penyimpanan utama lokal.
- Supabase snapshot per user.
- Sync manual.
- Event-based cloud sync setelah perubahan data.
- Realtime update.
- Conflict detection sederhana.
- Retry sync saat gagal.
- Deletion marker agar data terhapus tidak muncul lagi.

Acceptance criteria:

- Jika cloud tidak aktif, aplikasi tetap dapat berjalan lokal.
- Jika cloud aktif, perubahan lokal dikirim ke Supabase.
- Jika sync gagal, status pending/failed terlihat dan user dapat retry.
- Data child/read-only tidak menulis snapshot parent.

### 8.14 Export dan Backup

Fitur:

- Export CSV transaksi.
- Export JSON backup.
- Import JSON.
- Export Excel untuk transaksi, anggaran, hutang/piutang, reminder, recurring, dan data terkait.

Acceptance criteria:

- Export menghasilkan file yang dapat dibuka kembali.
- Import JSON menormalisasi state agar kompatibel dengan versi terbaru.
- Export tidak mengubah data aplikasi.

### 8.15 PWA

Fitur:

- Manifest PWA.
- Service worker/cache.
- Install app dari browser.
- Standalone display.

Acceptance criteria:

- App dapat di-install pada browser yang mendukung.
- App tetap memuat aset utama setelah cache tersedia.
- Build statis lolos validasi.

## 9. Data dan Model

Data utama disimpan sebagai snapshot JSON per user.

Koleksi utama:

- `transactions`
- `wallets`
- `budgets`
- `debts`
- `savings`
- `billReminders`
- `recurring`
- `vehicles`
- `vehicleServices`
- `vehicleOilChanges`
- `vehicleParts`
- `vehicleTaxes`
- `familyMembers`
- `categories`
- `deleted`
- `settings`

Aturan data:

- Semua nominal disimpan sebagai number.
- Semua tanggal form utama memakai format `YYYY-MM-DD`.
- Semua record utama memiliki `id`.
- Record yang bisa dihapus harus memiliki deletion marker saat sync aktif.
- State lama harus melewati normalisasi sebelum dipakai.

## 10. Non-Functional Requirements

### Performance

- App harus ringan dan cepat dibuka sebagai static web app.
- Operasi render umum harus responsif untuk ratusan transaksi.
- Tidak menggunakan framework berat tanpa alasan kuat.

### Reliability

- Data lokal tidak boleh hilang saat cloud sync gagal.
- Operasi perubahan data harus memanggil persist/sync flow.
- Build harus gagal jika file utama tidak valid.

### Security

- Jangan simpan Supabase service role di frontend.
- Gunakan anon public key.
- RLS Supabase wajib aktif.
- User hanya dapat membaca/menulis snapshot miliknya.
- PIN lokal bukan pengganti auth cloud, hanya proteksi akses perangkat.

### Accessibility

- Form input memiliki label.
- Modal memakai role dialog dan `aria-modal`.
- Tombol penting harus memiliki label yang jelas.
- UI harus tetap bisa digunakan dengan keyboard dasar.

### Responsiveness

- Mobile-first.
- Modal panjang harus scrollable.
- Calculator nominal tampil sebagai bottom sheet di mobile dan modal di desktop.
- Text tidak boleh overlap pada viewport kecil.

## 11. UX Requirements

- Navigasi utama harus jelas: Beranda, Transaksi, Keuangan, Kendaraan, Akun.
- Input transaksi harus cepat.
- Field nominal harus mendukung input langsung dan calculator opsional.
- Form panjang kendaraan memakai step/details untuk mengurangi beban visual.
- Status sync harus terlihat dan mudah dipahami.
- Empty state harus memberi aksi berikutnya.
- Undo tersedia untuk penghapusan penting.

## 12. Metrik Keberhasilan

Metrik produk:

- User berhasil menambah transaksi pertama dalam kurang dari 1 menit.
- User dapat melihat saldo total setelah membuat dompet dan transaksi.
- User dapat membuat budget dan melihat pemakaian kategori.
- User dapat menyelesaikan pembayaran hutang/piutang tanpa nominal melebihi sisa.
- User dapat export backup JSON.

Metrik kualitas:

- `npm run build` berhasil.
- Critical flow tests berhasil.
- Tidak ada error console pada flow utama.
- Data nominal di snapshot selalu number.
- Tidak ada regresi saldo, budget, hutang/piutang, laporan, dan net worth setelah perubahan input nominal.

## 13. Prioritas Roadmap

### P0

- Stabilitas pencatatan transaksi.
- Akurasi saldo dompet.
- Akurasi parse/format nominal.
- Persist lokal dan cloud sync dasar.
- Validasi hutang/piutang dan budget.
- Build dan test critical flow.

### P1

- UX input nominal fleksibel.
- Dashboard insight.
- Export Excel/CSV/JSON.
- Kendaraan terintegrasi ke transaksi.
- Net worth balance sheet.
- Undo delete.

### P2

- Family access yang lebih granular.
- Reminder tagihan yang lebih proaktif.
- Import bank statement.
- Dashboard analytics yang lebih detail.
- Peningkatan accessibility dan keyboard workflow.

### P3

- Multi-currency.
- OCR struk.
- Integrasi bank/e-wallet.
- Rule otomatis kategorisasi transaksi.

## 14. Risiko dan Mitigasi

Risiko: Snapshot JSON makin besar.

Mitigasi: Optimasi render, pagination/limit tampilan, dan pertimbangkan migrasi tabel terstruktur jika kebutuhan multi-user semakin kompleks.

Risiko: Conflict sync antar perangkat.

Mitigasi: Pertahankan merge by id, deletion marker, conflict notice, dan manual sync.

Risiko: Nominal salah tersimpan karena formatting UI.

Mitigasi: Centralize MoneyInput, `formatRupiah()`, `parseRupiahToNumber()`, dan test parse/format.

Risiko: `app.js` terlalu besar.

Mitigasi: Ekstrak helper bertahap ke `js/` tanpa rewrite besar.

Risiko: Supabase config salah.

Mitigasi: App tetap local-first, tampilkan status cloud jelas, dokumentasikan setup.

## 15. QA Plan

### Smoke Test

- App dapat dibuka.
- Login/guest flow berjalan.
- Dashboard tidak blank.
- Tidak ada console error pada load awal.

### Critical Flow

- Tambah dompet.
- Tambah transaksi income.
- Tambah transaksi expense.
- Edit transaksi.
- Hapus transaksi dan undo.
- Buat budget dan cek usage.
- Buat hutang/piutang.
- Bayar hutang/terima piutang.
- Buat tujuan tabungan dan entry setoran.
- Tambah biaya kendaraan dan cek transaksi terkait.
- Export JSON/CSV/Excel.

### Money Input Test

- Ketik `150000`, tampil `Rp150.000`.
- Pastikan parser menghasilkan number `150000`.
- Klik "Gunakan Kalkulator".
- Hitung `100000 + 50000`.
- Klik Gunakan.
- Field berisi `Rp150.000`.
- Klik Batal setelah mengubah ekspresi, nilai field lama tidak berubah.
- Coba pembagian dengan 0 dan pastikan ditolak.

### Sync Test

- Ubah data saat cloud sync aktif.
- Pastikan status menjadi pending lalu synced.
- Simulasikan gagal sync dan pastikan data lokal tetap ada.
- Hapus data lalu sync dan pastikan tidak muncul kembali.

## 16. Dependencies

- Browser modern dengan LocalStorage.
- Supabase Auth dan PostgreSQL untuk cloud mode.
- Supabase Realtime untuk update antar perangkat.
- Netlify untuk deployment static site.
- Playwright untuk test tertentu.

## 17. Open Questions

- Apakah child account hanya read-only, atau perlu permission per modul?
- Apakah reminder tagihan perlu push notification PWA?
- Apakah foto struk akan tetap lokal atau perlu storage cloud opsional?
- Apakah snapshot JSON masih cukup untuk target jumlah transaksi jangka panjang?
- Apakah perlu multi-profile keluarga dalam satu akun utama?

## 18. Definisi Selesai

Sebuah fitur dianggap selesai jika:

- User flow utama dapat dijalankan dari UI.
- Data tersimpan dan muncul kembali setelah reload.
- Validasi dasar mencegah data invalid.
- State/database memakai tipe data yang benar.
- Build berhasil.
- Critical test yang relevan berhasil.
- Tidak ada regresi pada saldo, budget, hutang/piutang, laporan, dan net worth.
- Dokumentasi README/PRD diperbarui jika perilaku produk berubah.
