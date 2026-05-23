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
      async upsert() {
        saved = true;
        return { error: null };
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
