window.AppStore = {
  loadState({ storageKey, normalizeState, emptyState }) {
    return window.AppStorage.loadState(storageKey, normalizeState, emptyState);
  },

  createStore(deps) {
    const {
      emptyState,
      getHasUnsyncedChanges,
      isChildUser,
      isGuest,
      normalizeState,
      persistChanges,
      queueCloudSave,
      setHasUnsyncedChanges,
      showSnackbar,
      state,
      storageKey,
    } = deps;

    function applyState(normalized) {
      state.transactions = normalized.transactions;
      state.budgets = normalized.budgets;
      state.debts = normalized.debts;
      state.savings = normalized.savings;
      state.billReminders = normalized.billReminders;
      state.recurring = normalized.recurring;
      state.vehicles = normalized.vehicles;
      state.vehicleServices = normalized.vehicleServices;
      state.vehicleOilChanges = normalized.vehicleOilChanges;
      state.vehicleParts = normalized.vehicleParts;
      state.vehicleTaxes = normalized.vehicleTaxes;
      state.familyMembers = normalized.familyMembers;
      state.categories = normalized.categories;
      state.wallets = normalized.wallets;
      state.deleted = normalized.deleted;
      state.settings = normalized.settings;
      state.syncStatus = normalized.syncStatus;
      state.localChangedAt = normalized.localChangedAt;
    }

    function loadState() {
      return window.AppStore.loadState({ storageKey, normalizeState, emptyState });
    }

    function saveState() {
      if (isGuest() || isChildUser()) return;
      window.AppStorage.saveState(storageKey, state);
      if (getHasUnsyncedChanges()) queueCloudSave();
    }

    function markDataChanged() {
      setHasUnsyncedChanges(true);
      state.syncStatus = "pending";
      state.localChangedAt = new Date().toISOString();
    }

    function setLocalSyncStatus(status) {
      state.syncStatus = status;
      if (isChildUser()) return;
      if (!isGuest()) window.AppStorage.saveState(storageKey, state);
    }

    function replaceState(nextState) {
      applyState(normalizeState(nextState));
      if (isGuest() || isChildUser()) return;
      window.AppStorage.saveState(storageKey, state);
    }

    function hydrateStoredStateForCurrentUser() {
      if (isGuest() || isChildUser()) return;
      const stored = loadState();
      applyState(stored);
      setHasUnsyncedChanges(stored.syncStatus === "pending" || stored.syncStatus === "failed");
    }

    function markDeleted(collection, itemId) {
      if (!itemId) return;
      if (!state.deleted) state.deleted = {};
      if (!Array.isArray(state.deleted[collection])) state.deleted[collection] = [];
      if (!state.deleted[collection].includes(itemId)) state.deleted[collection].push(itemId);
    }

    function unmarkDeleted(collection, itemIds) {
      const ids = new Set((Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean));
      if (!ids.size || !Array.isArray(state.deleted?.[collection])) return;
      state.deleted[collection] = state.deleted[collection].filter((itemId) => !ids.has(itemId));
    }

    function cloneData(value) {
      if (value === undefined || value === null) return value;
      return JSON.parse(JSON.stringify(value));
    }

    function restoreItems(collection, items) {
      const list = Array.isArray(items) ? items : [items];
      if (!Array.isArray(state[collection])) return;
      const existing = new Map(state[collection].map((item) => [item.id, item]));
      list.filter(Boolean).forEach((item) => {
        const restored = cloneData(item);
        if (existing.has(restored.id)) Object.assign(existing.get(restored.id), restored);
        else state[collection].push(restored);
      });
      unmarkDeleted(collection, list.map((item) => item?.id));
    }

    async function deleteWithUndo(options) {
      const {
        confirmMessage,
        deleteMessage = "Data dihapus.",
        failedMessage = "Data sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
        undoMessage = "Penghapusan dibatalkan.",
        deleteFn,
        undoFn,
        afterDelete,
      } = options;
      if (confirmMessage && !confirm(confirmMessage)) return false;
      deleteFn();
      if (typeof afterDelete === "function") afterDelete();
      await persistChanges(failedMessage);
      showSnackbar(deleteMessage, "success", {
        label: "Undo",
        onClick: async () => {
          undoFn();
          await persistChanges("Undo tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar(undoMessage);
        },
      });
      return true;
    }

    return {
      applyState,
      cloneData,
      deleteWithUndo,
      hydrateStoredStateForCurrentUser,
      loadState,
      markDataChanged,
      markDeleted,
      replaceState,
      restoreItems,
      saveState,
      setLocalSyncStatus,
      unmarkDeleted,
    };
  },
};
