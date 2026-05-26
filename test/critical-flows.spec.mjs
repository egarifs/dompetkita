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
await import("../js/constants.js");
await import("../js/state.js");
await import("../js/storage.js");
await import("../js/auth.js");
await import("../js/cloud.js");

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

const out = [];

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

const state = normalizeState({});
const cashWallet = state.wallets[0];
const bankWallet = state.wallets[1];
assert(cashWallet?.id && bankWallet?.id, "Dompet default tidak tersedia.");
const optionalBalanceWallet = window.AppState.normalizeWallet({ id: "wallet-optional", name: "Dompet Opsional", initialBalance: "" });
assert(optionalBalanceWallet.initialBalance === 0 && optionalBalanceWallet.currentBalance === 0, "Saldo awal kosong harus dianggap 0.");

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
