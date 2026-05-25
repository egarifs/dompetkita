global.window = global;

await import("../js/state.js");
await import("../js/cloud.js");

const { mergeDeletedIds, normalizeState } = window.AppState;
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

let selected = false;
let saved = false;
const { loadCloudState, saveCloudState } = window.AppCloud;
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
      upsert() {
        saved = true;
        return this;
      },
      async single() {
        return { data: { updated_at: "2026-05-23T00:00:00.000Z" }, error: null };
      },
    };
  },
};

const state = normalizeState({}, { defaultCategories: ["Lainnya"], translations: { id: {} } });
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

console.log("Sync helper context OK");
