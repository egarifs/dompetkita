global.window = global;

await import("../js/core/state.js");
await import("../js/core/cloud.js");

const { mergeDeletedIds, normalizeState } = window.AppState;
if (!window.AppCloud.hasStateData({ wallets: [{ id: "wallet-cloud", name: "Cloud Wallet" }] })) {
  throw new Error("Wallet-only state must be treated as syncable cloud data.");
}

if (!window.AppCloud.hasStateData({ wallets: [], deleted: { wallets: ["wallet-cash"] } })) {
  throw new Error("Deleted wallet markers must be treated as syncable cloud data.");
}

const deletedIds = mergeDeletedIds(
  { deleted: { transactions: ["cloud-delete"] } },
  { deleted: { transactions: ["local-delete"] } },
  "transactions",
);

if (!deletedIds.includes("cloud-delete") || !deletedIds.includes("local-delete")) {
  throw new Error("Deleted transaction ids were not merged.");
}

const normalized = normalizeState(
  {
    transactions: [{ id: "local-delete" }, { id: "kept" }],
    deleted: { transactions: ["local-delete"] },
  },
  { defaultCategories: ["Lainnya"], translations: { id: {} } },
);

if (normalized.transactions.length !== 1 || normalized.transactions[0].id !== "kept") {
  throw new Error("Deleted transactions were not filtered during normalizeState.");
}

const transactionMetadata = normalizeState(
  {
    transactions: [
      { id: "manual", type: "expense", date: "2026-05-20", category: "Makanan", amount: 12000 },
      { id: "vehicle", type: "expense", date: "2026-05-21", category: "Kendaraan", amount: 50000, vehicleId: "car-1", vehicleRecordId: "service-1" },
      { id: "recurring", type: "expense", date: "2026-05-22", category: "Tagihan", amount: 300000, recurringId: "internet-1" },
    ],
  },
  { defaultCategories: ["Lainnya"], translations: { id: {} } },
).transactions;

const manualTransaction = transactionMetadata.find((item) => item.id === "manual");
const vehicleTransaction = transactionMetadata.find((item) => item.id === "vehicle");
const recurringTransaction = transactionMetadata.find((item) => item.id === "recurring");
const { loadCloudState, saveCloudState } = window.AppCloud;

if (
  manualTransaction.sourceModule !== "manual" ||
  manualTransaction.sourceId !== "" ||
  manualTransaction.subcategory !== "" ||
  !manualTransaction.createdAt ||
  !manualTransaction.updatedAt
) {
  throw new Error("Manual transaction metadata was not normalized.");
}

if (vehicleTransaction.sourceModule !== "vehicles" || vehicleTransaction.sourceId !== "service-1") {
  throw new Error("Vehicle transaction relation metadata was not normalized.");
}

if (recurringTransaction.sourceModule !== "recurring" || recurringTransaction.sourceId !== "internet-1") {
  throw new Error("Recurring transaction relation metadata was not normalized.");
}

function mergeWalletState(cloudData, localData) {
  const cloud = normalizeState(cloudData || {}, { defaultCategories: ["Lainnya"], translations: { id: {} } });
  const local = normalizeState(localData || {}, { defaultCategories: ["Lainnya"], translations: { id: {} } });
  const deleted = {
    wallets: mergeDeletedIds(cloud, local, "wallets"),
  };
  return normalizeState({
    ...cloud,
    wallets: window.AppState.withoutDeleted(window.AppState.mergeById(cloud.wallets, local.wallets), deleted.wallets),
    deleted: { ...cloud.deleted, ...local.deleted, ...deleted },
    localChangedAt: local.localChangedAt || cloud.localChangedAt,
    syncStatus: local.syncStatus === "pending" || local.syncStatus === "failed" ? local.syncStatus : cloud.syncStatus,
  }, { defaultCategories: ["Lainnya"], translations: { id: {} } });
}

function cloudSelectClient(remotePayload, remoteAt) {
  return {
    auth: {
      async getSession() {
        return { data: { session: { user: { id: "user-1" } } }, error: null };
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          return { data: { payload: remotePayload, updated_at: remoteAt }, error: null };
        },
      };
    },
  };
}

{
  let savedNewerLocal = false;
  const localWalletState = normalizeState({
    wallets: [{ id: "wallet-local-newer", name: "Dompet Local", initialBalance: 100000, type: "Cash" }],
    localChangedAt: "2026-05-25T10:00:00.000Z",
    syncStatus: "synced",
  }, { defaultCategories: ["Lainnya"], translations: { id: {} } });
  const ctx = {
    cloudSync: { enabled: true, loadedUsers: new Set(), isSaving: false, pendingSave: false, lastError: "" },
    setupCloudClient: () => cloudSelectClient({ wallets: [], localChangedAt: "2026-05-24T10:00:00.000Z" }, "2026-05-24T10:00:00.000Z"),
    cloudConfig: { table: "finance_snapshots" },
    cloudUserKey: () => "user-1",
    replaceState(nextState) {
      Object.assign(localWalletState, nextState);
    },
    mergeStateData: mergeWalletState,
    emptyState: () => normalizeState({}, { defaultCategories: ["Lainnya"], translations: { id: {} } }),
    state: localWalletState,
    saveAfterLoad: false,
    hasPendingLocalChanges: () => false,
    async saveCloudState() {
      savedNewerLocal = true;
      return true;
    },
  };
  await loadCloudState(ctx);
  if (!savedNewerLocal || !localWalletState.wallets.some((wallet) => wallet.id === "wallet-local-newer")) {
    throw new Error("Newer local wallet state must survive older cloud payload and be uploaded.");
  }
}

{
  const localWalletState = normalizeState({
    wallets: [{ id: "wallet-local-old", name: "Dompet Lama", initialBalance: 100000, type: "Cash" }],
    localChangedAt: "2026-05-24T10:00:00.000Z",
    syncStatus: "synced",
  }, { defaultCategories: ["Lainnya"], translations: { id: {} } });
  const ctx = {
    cloudSync: { enabled: true, loadedUsers: new Set(), isSaving: false, pendingSave: false, lastError: "" },
    setupCloudClient: () => cloudSelectClient({ wallets: [], localChangedAt: "2026-05-25T10:00:00.000Z" }, "2026-05-25T10:00:00.000Z"),
    cloudConfig: { table: "finance_snapshots" },
    cloudUserKey: () => "user-1",
    replaceState(nextState) {
      Object.assign(localWalletState, nextState);
    },
    mergeStateData: mergeWalletState,
    emptyState: () => normalizeState({}, { defaultCategories: ["Lainnya"], translations: { id: {} } }),
    state: localWalletState,
    saveAfterLoad: false,
    hasPendingLocalChanges: () => false,
    async saveCloudState() {
      throw new Error("Older local wallet state should not be uploaded over newer cloud payload.");
    },
  };
  await loadCloudState(ctx);
  if (localWalletState.wallets.some((wallet) => wallet.id === "wallet-local-old")) {
    throw new Error("Newer cloud payload must be allowed to replace older local wallet state.");
  }
}

let selected = false;
let saved = false;
let savedPayload = null;
const cloudSync = {
  enabled: true,
  loadedUsers: new Set(),
  isSaving: false,
  pendingSave: false,
  lastError: "",
};
const cloudConfig = { table: "finance_snapshots" };
const client = {
  auth: {
    async getSession() {
      return { data: { session: { user: { id: "user-1" } } }, error: null };
    },
  },
  from() {
    return {
      select() {
        selected = true;
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        return { data: null, error: null };
      },
      upsert(payload) {
        saved = true;
        savedPayload = payload?.payload || null;
        return this;
      },
      async single() {
        return { data: { updated_at: "2026-05-23T00:00:00.000Z" }, error: null };
      },
    };
  },
};

const state = normalizeState({}, { defaultCategories: ["Lainnya"], translations: { id: {} } });
state.transactions.push({
  id: "receipt-local",
  type: "expense",
  transactionType: "expense",
  date: "2026-05-24",
  category: "Makanan",
  description: "Struk lokal",
  amount: 10000,
  receiptImage: "data:image/png;base64,local-only",
  receiptUrl: "data:image/png;base64,local-url",
  strukUrl: "data:image/png;base64,local-struk",
});
const ctx = {
  cloudSync,
  setupCloudClient: () => client,
  cloudConfig,
  cloudUserKey: () => "user-1",
  replaceState(nextState) {
    Object.assign(state, nextState);
  },
  mergeStateData: (cloudData, localData) => normalizeState({ ...cloudData, ...localData }, { defaultCategories: ["Lainnya"], translations: { id: {} } }),
  emptyState: () => normalizeState({}, { defaultCategories: ["Lainnya"], translations: { id: {} } }),
  state,
  saveCloudState: () => saveCloudState(ctx),
  normalizeState: (data) => normalizeState(data, { defaultCategories: ["Lainnya"], translations: { id: {} } }),
  renderAccount() {},
};

await loadCloudState(ctx);

if (!selected || !saved || cloudSync.lastError) {
  throw new Error(`Cloud helper context regression failed: ${cloudSync.lastError}`);
}

const cloudReceipt = savedPayload?.transactions?.find((item) => item.id === "receipt-local");
if (!state.transactions[0].receiptImage || cloudReceipt?.receiptImage || cloudReceipt?.receiptUrl || cloudReceipt?.strukUrl) {
  throw new Error("Receipt image data must stay local and must not be uploaded to cloud payload.");
}

console.log("Sync helper context OK");
