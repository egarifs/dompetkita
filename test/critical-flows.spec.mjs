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
const transaction = window.AppState.tx("transaction-1", "expense", "2026-05-25", "Makanan", "Sarapan", 25000);
state.transactions.push(transaction);
window.AppStorage.saveState(storageKey, state);
const storedAfterAdd = window.AppStorage.loadState(storageKey, normalizeState, () => normalizeState({}));
assert(storedAfterAdd.transactions.some((item) => item.id === "transaction-1" && item.amount === 25000), "Tambah transaksi tidak tersimpan.");
out.push("tambah transaksi:ok");

markDeleted(state, "transactions", "transaction-1");
state.transactions = state.transactions.filter((item) => item.id !== "transaction-1");
const normalizedAfterDelete = normalizeState(state);
assert(!normalizedAfterDelete.transactions.some((item) => item.id === "transaction-1"), "Hapus transaksi masih menampilkan data.");
assert(normalizedAfterDelete.deleted.transactions.includes("transaction-1"), "Hapus transaksi tidak menyimpan deletion marker.");
out.push("hapus transaksi:ok");

const savingsGoal = window.AppState.savingsGoal("savings-1", "2026-05-25", "Dana Darurat", 10000000, "2027-05-25", [
  window.AppState.savingsEntry("saving-entry-1", "deposit", "2026-05-25", 500000, "Setoran awal"),
]);
state.savings.push(savingsGoal);
const normalizedSavings = normalizeState(state);
assert(normalizedSavings.savings[0].entries[0].amount === 500000, "Tambah tabungan tidak menyimpan entry.");
out.push("tambah tabungan:ok");

state.vehicles.push({ id: "vehicle-1", name: "Motor Test", plate: "B 1234 TST", currentKm: 12000, type: "Motor" });
const serviceRecord = { id: "service-1", vehicleId: "vehicle-1" };
serviceRecord.transactionId = upsertVehicleTransaction(state, serviceRecord, "Service", 150000, "2026-05-25", "Service rutin");
state.vehicleServices.push({ ...serviceRecord, serviceDate: "2026-05-25", serviceKm: 12000, serviceType: "Service rutin", cost: 150000 });
const vehicleTransaction = state.transactions.find((item) => item.id === serviceRecord.transactionId);
assert(vehicleTransaction?.category === "Kendaraan", "Biaya kendaraan tidak masuk transaksi kategori Kendaraan.");
assert(vehicleTransaction?.sourceModule === "vehicles" && vehicleTransaction?.sourceId === "service-1", "Relasi transaksi kendaraan tidak lengkap.");
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

console.log(JSON.stringify({ out }, null, 2));
