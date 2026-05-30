window.AppConstants = {
  storageKey: "finance-tracker-v2",
  authStorageKey: "finance-tracker-users-v1",
  sessionStorageKey: "finance-tracker-session-v1",
  rememberedLoginKey: "finance-tracker-remembered-login-v1",
  failedLoginKey: "finance-tracker-failed-login-v1",
  deletedAccountsKey: "finance-tracker-deleted-accounts-v1",
  IDLE_TIMEOUT_MINUTES: 15,
  WARNING_BEFORE_LOGOUT_MINUTES: 1,
  splashReadDelay: 5000,
  localSplashQuotes: [
    { quote: "Uang yang dicatat akan lebih mudah diarahkan.", author: "Catatan Keuangan" },
    { quote: "Mencatat pengeluaran adalah langkah pertama untuk mengendalikan kebiasaan belanja.", author: "Catatan Keuangan" },
    { quote: "Keuangan yang sehat dimulai dari tahu ke mana uang pergi.", author: "Catatan Keuangan" },
    { quote: "Anggaran bukan batasan, tapi peta agar tujuan keuangan lebih dekat.", author: "Catatan Keuangan" },
  ],
  savingCategories: ["Dana Darurat", "Pendidikan", "Pernikahan", "Rumah", "Liburan", "Kendaraan", "Dana Pensiun", "Kesehatan", "Ibadah", "Lainnya"],
  defaultCategories: ["Makanan", "Transportasi", "Tagihan", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Kendaraan", "Lainnya"],
  rupiah: new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }),
};
