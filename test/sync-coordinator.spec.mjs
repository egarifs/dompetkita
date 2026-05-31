global.window = global;
global.alert = () => {};

await import("../js/core/sync.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function blankState() {
  return {
    transactions: [],
    budgets: [],
    debts: [],
    savings: [],
    billReminders: [],
    recurring: [],
    wallets: [],
    vehicles: [],
    vehicleServices: [],
    vehicleOilChanges: [],
    vehicleParts: [],
    vehicleTaxes: [],
    familyMembers: [],
    categories: [],
    deleted: {},
    settings: { cloudSyncEnabled: true },
    syncStatus: "synced",
    localChangedAt: "",
  };
}

function normalizeState(value = {}) {
  const base = blankState();
  const normalized = {
    ...base,
    ...value,
    deleted: { ...base.deleted, ...(value.deleted || {}) },
    settings: { ...base.settings, ...(value.settings || {}) },
  };
  Object.keys(base).forEach((key) => {
    if (Array.isArray(base[key]) && !Array.isArray(normalized[key])) normalized[key] = [];
  });
  return normalized;
}

function mergeById(primary = [], secondary = []) {
  return [...new Map([...primary, ...secondary].map((item) => [item.id, item])).values()];
}

function mergeDeletedIds(cloud, local, collection) {
  return [...new Set([...(cloud.deleted?.[collection] || []), ...(local.deleted?.[collection] || [])])];
}

function withoutDeleted(items, deletedIds) {
  const deleted = new Set(deletedIds);
  return items.filter((item) => !deleted.has(item.id));
}

const state = normalizeState();
let hasUnsyncedChanges = false;
let markChangedCount = 0;
let saveStateCount = 0;
let renderAllCount = 0;

window.AppCloud = {
  setupCloudClient: () => ({}),
  cloudUserKey: (user) => user?.cloudId || "",
  flushCloudSave: async () => true,
  loadCloudState: async () => {},
  saveCloudState: async () => true,
  syncStatusText: () => "cloud-ok",
  isTimestampAfter: () => false,
  startRealtimeSync: () => {},
  stopRealtimeSync: () => {},
};

const coordinator = window.AppSync.createCoordinator({
  cloudConfig: {},
  cloudSync: { enabled: true, retryCount: 0 },
  emptyState: blankState,
  getCurrentUser: () => ({ cloudId: "cloud-user" }),
  getHasUnsyncedChanges: () => hasUnsyncedChanges,
  isChildUser: () => false,
  isCloudSyncAllowed: () => true,
  isGuest: () => false,
  markDataChanged: () => {
    hasUnsyncedChanges = true;
    markChangedCount += 1;
  },
  mergeById,
  mergeDeletedIds,
  mergeSavingsGoals: mergeById,
  normalizeState,
  renderAccount: () => {},
  renderAll: () => {
    renderAllCount += 1;
  },
  replaceState: (nextState) => Object.assign(state, normalizeState(nextState)),
  saveState: () => {
    saveStateCount += 1;
  },
  setHasUnsyncedChanges: (value) => {
    hasUnsyncedChanges = value;
  },
  setLocalSyncStatus: (status) => {
    state.syncStatus = status;
  },
  showSnackbar: () => {},
  state,
  withoutDeleted,
});

const merged = coordinator.mergeStateData(
  { transactions: [{ id: "keep" }, { id: "deleted" }] },
  { transactions: [{ id: "local" }], deleted: { transactions: ["deleted"] } },
);
assert(merged.transactions.map((item) => item.id).sort().join(",") === "keep,local", "Merge snapshot tidak menerapkan tombstone.");

await coordinator.persistChanges();
assert(markChangedCount === 1, "Persist tidak menandai perubahan lokal.");
assert(saveStateCount === 1, "Persist tidak menyimpan state lokal.");
assert(renderAllCount === 1, "Persist tidak merender ulang UI.");
assert(!hasUnsyncedChanges && state.syncStatus === "synced", "Flush sukses tidak memperbarui status sinkronisasi.");

hasUnsyncedChanges = true;
coordinator.applyCloudPayload({ transactions: [{ id: "remote" }] }, "2026-05-31T00:00:00.000Z");
assert(state.transactions.some((item) => item.id === "remote"), "Payload realtime tidak diterapkan.");

console.log("Sync coordinator OK");
