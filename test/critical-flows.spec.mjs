global.window = global;

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

global.localStorage = createStorage();
global.sessionStorage = createStorage();
await import("../js/core/constants.js");
await import("../js/core/state.js");
await import("../js/core/storage.js");
await import("../js/core/auth.js");
await import("../js/core/cloud.js");
await import("../js/utils/categoryUtils.js");
await import("../js/features/account/account.service.js");
await import("../js/features/wallets/wallet.service.js");

const { authStorageKey, sessionStorageKey, storageKey, defaultCategories } = window.AppConstants;
const translations = { id: {}, en: {} };
const normalizeState = (data) => window.AppState.normalizeState(data || {}, { defaultCategories, translations });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function markDeleted(state, collection, itemId) {
  if (!state.deleted) state.deleted = {};
  if (!Array.isArray(state.deleted[collection])) state.deleted[collection] = [];
  if (!state.deleted[collection].includes(itemId)) state.deleted[collection].push(itemId);
}

function registerLocal({ name, phone, email, password }) {
  const users = window.AppAuth.loadUsers(authStorageKey);
  if (users.some((user) => user.username.toLowerCase() === email.toLowerCase())) return { ok: false };
  const user = { id: "registered-user", username: email, password, role: "user", name, email, phone };
  users.push(user);
  window.AppAuth.saveUsers(authStorageKey, users);
  localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
  return { ok: true, user };
}

function loginLocal(email, password) {
  const user = window.AppAuth.loadUsers(authStorageKey).find((item) => item.username === email && item.password === password);
  if (!user) return null;
  localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
  return user;
}

function upsertVehicleTransaction(state, record, subcategory, amount, date, description) {
  const value = Number(amount || 0);
  if (value <= 0) return "";
  const existing = record.transactionId ? state.transactions.find((item) => item.id === record.transactionId) : null;
  const payload = {
    type: "expense",
    date,
    category: "Kendaraan",
    subcategory,
    amount: value,
    description,
    sourceModule: "vehicles",
    sourceId: record.id,
    vehicleId: record.vehicleId,
    vehicleRecordId: record.id,
    vehicleRecordType: subcategory,
    walletId: record.walletId || state.wallets[0]?.id || "",
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    Object.assign(existing, window.AppState.normalizeTransaction({ ...existing, ...payload }));
    return existing.id;
  }
  const transaction = window.AppState.tx("vehicle-transaction", "expense", date, "Kendaraan", description, value, payload);
  state.transactions.push(transaction);
  return transaction.id;
}

function recalculateWalletBalances(state) {
  state.wallets.forEach((wallet) => {
    wallet.currentBalance = Number(wallet.initialBalance || 0);
  });
  state.transactions.forEach((transaction) => {
    const wallet = state.wallets.find((item) => item.id === transaction.walletId);
    if (!wallet) return;
    wallet.currentBalance += transaction.type === "income" ? Number(transaction.amount || 0) : -Number(transaction.amount || 0);
  });
}

function syncDebtPaymentState(state) {
  state.debts.forEach((debt) => {
    const payments = state.transactions.filter((transaction) => (transaction.debtId || transaction.receivableId) === debt.id);
    const paidAmount = payments.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    debt.totalAmount = Number(debt.totalAmount ?? debt.amount ?? 0);
    debt.paidAmount = paidAmount;
    debt.remainingAmount = Math.max(0, debt.totalAmount - paidAmount);
    debt.status = debt.remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
  });
}

const out = [];

const categoryTree = window.AppCategoryUtils.buildCategoryTree({
  categories: ["Tagihan", "Internet", "Kendaraan", "Bensin Motor", "Makanan"],
  budgets: [
    { id: "budget-tagihan", name: "Tagihan", category: "Tagihan", parentId: null, isActive: true },
    { id: "budget-internet", name: "Internet", category: "Internet", parentId: "budget-tagihan", isActive: true },
    { id: "budget-kendaraan", name: "Kendaraan", category: "Kendaraan", parentId: null, isActive: true },
    { id: "budget-bensin", name: "Bensin Motor", category: "Bensin Motor", parentId: "budget-kendaraan", isActive: true },
  ],
});
const flattenedCategories = window.AppCategoryUtils.flattenCategoryTreeForSelect(categoryTree);
assert(flattenedCategories.map((item) => `${item.depth}:${item.name}`).join("|") === "0:Kendaraan|1:Bensin Motor|0:Tagihan|1:Internet|0:Makanan", "Kategori parent-child dari budget tidak tersusun benar.");
assert(flattenedCategories.filter((item) => item.name === "Internet").length === 1, "Subkategori budget tampil terpisah dari parent.");

const categoryTreeFromParentId = window.AppCategoryUtils.buildCategoryTree({
  categories: [
    { id: "category-tagihan", name: "Tagihan" },
    { id: "category-kosan", name: "Kosan", parentId: "category-tagihan" },
  ],
});
const flattenedCategoryObjects = window.AppCategoryUtils.flattenCategoryTreeForSelect(categoryTreeFromParentId);
assert(flattenedCategoryObjects.map((item) => `${item.depth}:${item.name}`).join("|") === "0:Tagihan|1:Kosan", "Field parentId kategori object tidak terbaca.");
out.push("hierarki kategori:ok");

const registration = registerLocal({
  name: "User Test",
  phone: "081200000000",
  email: "test@dompify.local",
  password: "Password123",
});
assert(registration.ok, "Registrasi lokal gagal.");
assert(loginLocal("test@dompify.local", "Password123")?.email === "test@dompify.local", "Login lokal gagal setelah registrasi.");
assert(window.AppAuth.loadSessionUser(sessionStorageKey, window.AppAuth.loadUsers(authStorageKey))?.email === "test@dompify.local", "Session user tidak tersimpan.");
out.push("registrasi/login:ok");

const deletedLocalAuthKey = "test-deleted-local-users";
const deletedLocalAccountsKey = "test-deleted-local-tombstones";
const deletedLocalSessionKey = "test-deleted-local-session";
const deletedLocalRememberedKey = "test-deleted-local-remembered";
const deletedLocalSnapshotKey = "test-deleted-local-snapshot";
localStorage.setItem(deletedLocalAuthKey, JSON.stringify([{ username: "user@keuangan.local", password: "user123", role: "user" }]));
localStorage.setItem(deletedLocalSessionKey, JSON.stringify({ username: "user@keuangan.local" }));
localStorage.setItem(deletedLocalRememberedKey, JSON.stringify({ email: "user@keuangan.local", password: "user123" }));
localStorage.setItem(deletedLocalSnapshotKey, JSON.stringify({ wallets: [{ id: "wallet-delete-test" }] }));
window.AppAuth.deleteLocalAccountData({
  authStorageKey: deletedLocalAuthKey,
  deletedAccountsKey: deletedLocalAccountsKey,
  rememberedLoginKey: deletedLocalRememberedKey,
  sessionStorageKey: deletedLocalSessionKey,
  storageKey: deletedLocalSnapshotKey,
  username: "user@keuangan.local",
});
assert(window.AppAuth.isAccountDeleted(deletedLocalAccountsKey, "user@keuangan.local"), "Tombstone akun lokal yang dihapus tidak tersimpan.");
assert(window.AppAuth.loadUsers(deletedLocalAuthKey, deletedLocalAccountsKey).length === 0, "Akun lokal yang dihapus masih tersedia untuk login.");
localStorage.removeItem(deletedLocalAuthKey);
assert(!window.AppAuth.loadUsers(deletedLocalAuthKey, deletedLocalAccountsKey).some((user) => user.username === "user@keuangan.local"), "Akun bawaan lokal yang sudah dihapus muncul kembali.");
assert(localStorage.getItem(deletedLocalSnapshotKey) === null, "Snapshot lokal akun yang dihapus masih tersimpan.");
assert(localStorage.getItem(deletedLocalSessionKey) === null, "Sesi akun lokal yang dihapus masih tersimpan.");
assert(localStorage.getItem(deletedLocalRememberedKey) === null, "Remembered login akun yang dihapus masih tersimpan.");

let deletedAccountRpc = "";
const accountService = window.AppAccountService.createService({
  dataOwnerId: () => "cloud-user-delete",
  familyMember: window.AppState.familyMember,
  getCurrentUser: () => ({ cloudId: "cloud-user-delete", username: "cloud-delete@dompify.local" }),
  id: () => "family-delete-test",
  isGuest: () => false,
  setupCloudClient: () => ({
    async rpc(name) {
      deletedAccountRpc = name;
      return { error: null };
    },
  }),
});
const deletedCloudAccount = await accountService.deleteCurrentAccountPermanently();
assert(deletedCloudAccount.ok && deletedCloudAccount.mode === "cloud", "Service hapus akun cloud tidak berhasil.");
assert(deletedAccountRpc === "delete_current_user", "Service hapus akun cloud tidak memanggil RPC delete_current_user.");
const failedCloudAccountDelete = await window.AppAccountService.createService({
  dataOwnerId: () => "cloud-user-delete",
  familyMember: window.AppState.familyMember,
  getCurrentUser: () => ({ cloudId: "cloud-user-delete", username: "cloud-delete@dompify.local" }),
  id: () => "family-delete-test",
  isGuest: () => false,
  setupCloudClient: () => ({
    async rpc() {
      return { error: { message: "RPC belum tersedia" } };
    },
  }),
}).deleteCurrentAccountPermanently();
assert(!failedCloudAccountDelete.ok && failedCloudAccountDelete.message.includes("supabase-schema.sql"), "Kegagalan RPC hapus akun cloud tidak dijelaskan dengan aman.");
out.push("hapus akun permanen:ok");

const state = normalizeState({});
assert(state.wallets.length === 0, "User baru tidak boleh mendapat default dompet.");
const cashWallet = window.AppState.normalizeWallet({ id: "wallet-cash-manual", name: "Cash Manual", initialBalance: 500000, type: "Cash" });
const bankWallet = window.AppState.normalizeWallet({ id: "wallet-bank-manual", name: "Bank Manual", initialBalance: 2000000, type: "Bank" });
state.wallets.push(cashWallet, bankWallet);
const optionalBalanceWallet = window.AppState.normalizeWallet({ id: "wallet-optional", name: "Dompet Opsional", initialBalance: "" });
assert(optionalBalanceWallet.initialBalance === 0 && optionalBalanceWallet.currentBalance === 0, "Saldo awal kosong harus dianggap 0.");
const walletGuardState = normalizeState({ wallets: [{ id: "wallet-single", name: "Dompet Utama", initialBalance: 0, currentBalance: 0, type: "Cash" }] });
const walletGuardService = window.AppWalletService.createService({
  getState: () => walletGuardState,
  currentUserId: () => "user-test",
  escapeHtml: (value) => String(value ?? ""),
  id: () => "wallet-new",
  money: (value) => String(value),
  normalizeWallet: window.AppState.normalizeWallet,
});
assert(walletGuardService.deleteBlockReason("wallet-single") === "", "Dompet terakhir tetap boleh dihapus jika belum dipakai transaksi.");
const emptyWalletState = normalizeState({ wallets: [], deleted: { wallets: ["wallet-cash", "wallet-bank"] } });
assert(emptyWalletState.wallets.length === 0, "State dompet kosong eksplisit tidak boleh memunculkan dompet default setelah refresh.");
const walletCrudState = normalizeState({ wallets: [] });
const walletCrudService = window.AppWalletService.createService({
  getState: () => walletCrudState,
  currentUserId: () => "user-test",
  escapeHtml: (value) => String(value ?? ""),
  id: () => "wallet-crud",
  markDeleted: (collection, itemId) => markDeleted(walletCrudState, collection, itemId),
  money: (value) => String(value),
  normalizeWallet: window.AppState.normalizeWallet,
});
walletCrudService.createWallet({ name: "Operasional", initialBalance: 100000, type: "Cash" });
assert(walletCrudState.wallets.some((wallet) => wallet.id === "wallet-crud" && wallet.name === "Operasional"), "Tambah dompet tidak mengubah state.wallets.");
walletCrudService.updateWallet("wallet-crud", { name: "Operasional Edit", initialBalance: 150000, type: "Bank" });
assert(walletCrudState.wallets.some((wallet) => wallet.name === "Operasional Edit" && wallet.initialBalance === 150000), "Edit dompet tidak mengubah state.wallets.");
assert(walletCrudService.deleteWallet("wallet-crud").ok, "Hapus dompet yang belum dipakai transaksi harus berhasil.");
assert(!walletCrudState.wallets.some((wallet) => wallet.id === "wallet-crud") && walletCrudState.deleted.wallets.includes("wallet-crud"), "Hapus dompet tidak memperbarui state.wallets atau deleted wallet marker.");
window.AppStorage.saveState(storageKey, walletCrudState);
const storedWalletCrudState = window.AppStorage.loadState(storageKey, normalizeState, () => normalizeState({}));
assert(!storedWalletCrudState.wallets.some((wallet) => wallet.id === "wallet-crud") && storedWalletCrudState.deleted.wallets.includes("wallet-crud"), "Snapshot hapus dompet tidak tersimpan setelah reload storage.");

const familyMember = window.AppState.familyMember("family-1", "parent-user-1", "child@dompify.local", "Anak Test", "0812", "active");
state.familyMembers.push(familyMember);
const normalizedFamily = normalizeState(state).familyMembers[0];
assert(normalizedFamily.childEmail === "child@dompify.local" && normalizedFamily.role === "child", "Data anggota keluarga tidak ternormalisasi.");
assert(window.AppCloud.cloudUserKey({ cloudId: "child-user-1", dataOwnerId: "parent-user-1" }) === "parent-user-1", "Child harus membaca data owner parent.");
out.push("anggota keluarga:ok");

const transaction = window.AppState.tx("transaction-1", "expense", "2026-05-25", "Makanan", "Sarapan", 25000, { walletId: cashWallet.id });
state.transactions.push(transaction);
window.AppStorage.saveState(storageKey, state);
const storedAfterAdd = window.AppStorage.loadState(storageKey, normalizeState, () => normalizeState({}));
assert(storedAfterAdd.transactions.some((item) => item.id === "transaction-1" && item.amount === 25000 && item.walletId === cashWallet.id), "Tambah transaksi tidak tersimpan dengan dompet.");
out.push("tambah transaksi:ok");

const incomeToCash = window.AppState.tx("transaction-income-cash", "income", "2026-05-25", "Gaji", "Gaji", 100000, { walletId: cashWallet.id });
const incomeToBank = window.AppState.tx("transaction-income-bank", "income", "2026-05-25", "Transfer", "Masuk bank", 200000, { walletId: bankWallet.id });
state.transactions.push(incomeToCash, incomeToBank);
recalculateWalletBalances(state);
assert(cashWallet.currentBalance === Number(cashWallet.initialBalance || 0) + 75000, "Saldo Cash tidak sesuai setelah pemasukan dan pengeluaran.");
assert(bankWallet.currentBalance === Number(bankWallet.initialBalance || 0) + 200000, "Saldo Bank tidak sesuai setelah pemasukan.");

Object.assign(transaction, window.AppState.normalizeTransaction({ ...transaction, walletId: bankWallet.id, amount: 50000, updatedAt: new Date().toISOString() }));
recalculateWalletBalances(state);
assert(cashWallet.currentBalance === Number(cashWallet.initialBalance || 0) + 100000, "Saldo Cash tidak kembali benar setelah transaksi dipindah.");
assert(bankWallet.currentBalance === Number(bankWallet.initialBalance || 0) + 150000, "Saldo Bank tidak sesuai setelah transaksi dipindah.");
out.push("saldo dompet:ok");

markDeleted(state, "transactions", "transaction-1");
state.transactions = state.transactions.filter((item) => item.id !== "transaction-1");
recalculateWalletBalances(state);
const normalizedAfterDelete = normalizeState(state);
assert(!normalizedAfterDelete.transactions.some((item) => item.id === "transaction-1"), "Hapus transaksi masih menampilkan data.");
assert(normalizedAfterDelete.deleted.transactions.includes("transaction-1"), "Hapus transaksi tidak menyimpan deletion marker.");
assert(bankWallet.currentBalance === Number(bankWallet.initialBalance || 0) + 200000, "Saldo dompet tidak kembali benar setelah transaksi dihapus.");
out.push("hapus transaksi:ok");

const payableDebt = window.AppState.normalizeDebt({ id: "debt-1", kind: "payable", person: "Koperasi", amount: 1000000, status: "unpaid" });
state.debts.push(payableDebt);
const debtPayment = window.AppState.tx("debt-payment-1", "expense", "2026-05-25", "Hutang Piutang", "Bayar hutang koperasi", 300000, {
  walletId: cashWallet.id,
  transactionType: "debt_payment",
  debtPaymentType: "debt_payment",
  debtId: payableDebt.id,
  sourceModule: "debts",
  sourceId: payableDebt.id,
});
state.transactions.push(debtPayment);
syncDebtPaymentState(state);
recalculateWalletBalances(state);
assert(payableDebt.paidAmount === 300000 && payableDebt.remainingAmount === 700000 && payableDebt.status === "partial", "Pembayaran hutang sebagian tidak menghitung sisa dengan benar.");
state.transactions.push(window.AppState.tx("debt-payment-2", "expense", "2026-05-25", "Hutang Piutang", "Lunasi hutang koperasi", 700000, {
  walletId: cashWallet.id,
  transactionType: "debt_payment",
  debtPaymentType: "debt_payment",
  debtId: payableDebt.id,
  sourceModule: "debts",
  sourceId: payableDebt.id,
}));
syncDebtPaymentState(state);
assert(payableDebt.remainingAmount === 0 && payableDebt.status === "paid", "Pelunasan hutang tidak mengubah status menjadi lunas.");

const receivableDebt = window.AppState.normalizeDebt({ id: "receivable-1", kind: "receivable", person: "Teman", amount: 500000, status: "unpaid" });
state.debts.push(receivableDebt);
state.transactions.push(window.AppState.tx("receivable-payment-1", "income", "2026-05-25", "Hutang Piutang", "Terima piutang", 200000, {
  walletId: bankWallet.id,
  transactionType: "receivable_payment",
  debtPaymentType: "receivable_payment",
  receivableId: receivableDebt.id,
  sourceModule: "debts",
  sourceId: receivableDebt.id,
}));
syncDebtPaymentState(state);
recalculateWalletBalances(state);
assert(receivableDebt.paidAmount === 200000 && receivableDebt.remainingAmount === 300000 && receivableDebt.status === "partial", "Penerimaan piutang sebagian tidak menghitung sisa dengan benar.");
out.push("pembayaran hutang piutang:ok");

const savingsGoal = window.AppState.savingsGoal("savings-1", "2026-05-25", "Dana Darurat", 10000000, "2027-05-25", [
  window.AppState.savingsEntry("saving-entry-1", "deposit", "2026-05-25", 500000, "Setoran awal"),
]);
state.savings.push(savingsGoal);
const normalizedSavings = normalizeState(state);
assert(normalizedSavings.savings[0].entries[0].amount === 500000, "Tambah tabungan tidak menyimpan entry.");
out.push("tambah tabungan:ok");

state.vehicles.push({ id: "vehicle-1", name: "Motor Test", plate: "B 1234 TST", currentKm: 12000, type: "Motor" });
const serviceRecord = { id: "service-1", vehicleId: "vehicle-1", walletId: cashWallet.id };
serviceRecord.transactionId = upsertVehicleTransaction(state, serviceRecord, "Service", 150000, "2026-05-25", "Service rutin");
state.vehicleServices.push({ ...serviceRecord, serviceDate: "2026-05-25", serviceKm: 12000, serviceType: "Service rutin", cost: 150000 });
const vehicleTransaction = state.transactions.find((item) => item.id === serviceRecord.transactionId);
assert(vehicleTransaction?.category === "Kendaraan", "Biaya kendaraan tidak masuk transaksi kategori Kendaraan.");
assert(vehicleTransaction?.sourceModule === "vehicles" && vehicleTransaction?.sourceId === "service-1", "Relasi transaksi kendaraan tidak lengkap.");
assert(vehicleTransaction?.walletId === cashWallet.id, "Transaksi kendaraan tidak menyimpan dompet.");
out.push("kendaraan otomatis transaksi:ok");

let upsertPayload = null;
const cloudSync = {
  enabled: true,
  loadedUsers: new Set(["cloud-user-1"]),
  isSaving: false,
  pendingSave: false,
  lastError: "",
};
const cloudClient = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: "cloud-user-1" } } }, error: null };
    },
  },
  from() {
    return {
      upsert(payload) {
        upsertPayload = payload;
        return this;
      },
      select() {
        return this;
      },
      async single() {
        return { data: { updated_at: "2026-05-25T00:00:00.000Z" }, error: null };
      },
    };
  },
};
const saved = await window.AppCloud.saveCloudState({
  cloudSync,
  setupCloudClient: () => cloudClient,
  cloudConfig: { table: "finance_snapshots" },
  cloudUserKey: () => "cloud-user-1",
  normalizeState,
  state,
  renderAccount() {},
});
assert(saved, "Sync cloud mock gagal.");
assert(upsertPayload?.user_id === "cloud-user-1", "Sync cloud tidak mengirim user_id.");
assert(upsertPayload?.payload?.syncStatus === "synced", "Sync cloud tidak menandai payload synced.");
assert(upsertPayload?.payload?.transactions.some((item) => item.category === "Kendaraan"), "Sync cloud tidak membawa data transaksi.");
assert(upsertPayload?.payload?.wallets.some((item) => item.id === cashWallet.id), "Sync cloud tidak membawa data dompet.");
out.push("sync cloud:ok");

upsertPayload = null;
const readOnlySaved = await window.AppCloud.saveCloudState({
  cloudSync: { ...cloudSync, readOnly: true },
  setupCloudClient: () => cloudClient,
  cloudConfig: { table: "finance_snapshots" },
  cloudUserKey: () => "parent-user-1",
  normalizeState,
  state,
  renderAccount() {},
});
assert(readOnlySaved, "Mode child read-only tidak boleh dianggap gagal sync.");
assert(upsertPayload === null, "Mode child read-only tidak boleh menulis snapshot cloud.");
out.push("child read-only sync:ok");

console.log(JSON.stringify({ out }, null, 2));
