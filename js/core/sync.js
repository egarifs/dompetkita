window.AppSync = {
  createCoordinator(deps) {
    const {
      cloudConfig,
      cloudSync,
      emptyState,
      getCurrentUser,
      getHasUnsyncedChanges,
      isChildUser,
      isCloudSyncAllowed,
      isGuest,
      markDataChanged,
      mergeById,
      mergeDeletedIds,
      mergeSavingsGoals,
      normalizeState,
      renderAccount,
      renderAll,
      replaceState,
      saveState,
      setHasUnsyncedChanges,
      setLocalSyncStatus,
      showSnackbar,
      state,
      withoutDeleted,
    } = deps;

    function mergeStateData(cloudData, localData) {
      const cloud = normalizeState(cloudData || {});
      const local = normalizeState(localData || {});
      const deleted = {
        transactions: mergeDeletedIds(cloud, local, "transactions"),
        debts: mergeDeletedIds(cloud, local, "debts"),
        budgets: mergeDeletedIds(cloud, local, "budgets"),
        savings: mergeDeletedIds(cloud, local, "savings"),
        billReminders: mergeDeletedIds(cloud, local, "billReminders"),
        recurring: mergeDeletedIds(cloud, local, "recurring"),
        wallets: mergeDeletedIds(cloud, local, "wallets"),
        vehicles: mergeDeletedIds(cloud, local, "vehicles"),
        vehicleServices: mergeDeletedIds(cloud, local, "vehicleServices"),
        vehicleOilChanges: mergeDeletedIds(cloud, local, "vehicleOilChanges"),
        vehicleParts: mergeDeletedIds(cloud, local, "vehicleParts"),
        vehicleTaxes: mergeDeletedIds(cloud, local, "vehicleTaxes"),
        familyMembers: mergeDeletedIds(cloud, local, "familyMembers"),
      };
      return normalizeState({
        transactions: withoutDeleted(mergeById(cloud.transactions, local.transactions), deleted.transactions),
        budgets: withoutDeleted(mergeById(cloud.budgets, local.budgets), deleted.budgets),
        debts: withoutDeleted(mergeById(cloud.debts, local.debts), deleted.debts),
        savings: withoutDeleted(mergeSavingsGoals(cloud.savings, local.savings), deleted.savings),
        billReminders: withoutDeleted(mergeById(cloud.billReminders, local.billReminders), deleted.billReminders),
        recurring: withoutDeleted(mergeById(cloud.recurring, local.recurring), deleted.recurring),
        wallets: withoutDeleted(mergeById(cloud.wallets, local.wallets), deleted.wallets),
        vehicles: withoutDeleted(mergeById(cloud.vehicles, local.vehicles), deleted.vehicles),
        vehicleServices: withoutDeleted(mergeById(cloud.vehicleServices, local.vehicleServices), deleted.vehicleServices),
        vehicleOilChanges: withoutDeleted(mergeById(cloud.vehicleOilChanges, local.vehicleOilChanges), deleted.vehicleOilChanges),
        vehicleParts: withoutDeleted(mergeById(cloud.vehicleParts, local.vehicleParts), deleted.vehicleParts),
        vehicleTaxes: withoutDeleted(mergeById(cloud.vehicleTaxes, local.vehicleTaxes), deleted.vehicleTaxes),
        familyMembers: withoutDeleted(mergeById(cloud.familyMembers, local.familyMembers), deleted.familyMembers),
        categories: [...new Set([...cloud.categories, ...local.categories])],
        settings: { ...cloud.settings, ...local.settings },
        syncStatus: local.syncStatus === "pending" || local.syncStatus === "failed" ? local.syncStatus : cloud.syncStatus,
        localChangedAt: local.localChangedAt || cloud.localChangedAt,
        deleted,
      });
    }

    function setupCloudClient() {
      return window.AppCloud.setupCloudClient(cloudSync, cloudConfig);
    }

    function cloudUserKey() {
      return window.AppCloud.cloudUserKey(getCurrentUser());
    }

    function queueCloudSave() {
      if (isChildUser() || !isCloudSyncAllowed()) return;
      return window.AppCloud.queueCloudSave({
        cloudSync,
        currentUser: getCurrentUser(),
        cloudUserKey,
        saveCloudState: savePendingCloudChanges,
      });
    }

    function clearSyncRetry() {
      clearTimeout(cloudSync.retryTimer);
      cloudSync.retryTimer = null;
      cloudSync.retryCount = 0;
      cloudSync.nextRetryAt = null;
    }

    function scheduleSyncRetry() {
      if (!getHasUnsyncedChanges() || !isCloudSyncAllowed() || isGuest() || isChildUser()) return;
      clearTimeout(cloudSync.retryTimer);
      const delay = Math.min(60000, 5000 * (2 ** cloudSync.retryCount));
      cloudSync.retryCount += 1;
      cloudSync.nextRetryAt = new Date(Date.now() + delay).toISOString();
      renderAccount();
      cloudSync.retryTimer = setTimeout(async () => {
        cloudSync.retryTimer = null;
        if (!getHasUnsyncedChanges() || !isCloudSyncAllowed() || isGuest() || isChildUser()) return;
        const saved = await savePendingCloudChanges();
        if (!saved) showSnackbar("Sinkronisasi cloud masih gagal. Data tetap aman di lokal.", "error");
        renderAccount();
      }, delay);
    }

    function handleCloudSaveResult(saved) {
      if (saved) {
        setHasUnsyncedChanges(false);
        cloudSync.conflictDetected = false;
        cloudSync.conflictMessage = "";
        clearSyncRetry();
        setLocalSyncStatus("synced");
      } else {
        setLocalSyncStatus("failed");
        scheduleSyncRetry();
      }
      return saved;
    }

    async function savePendingCloudChanges() {
      if (isChildUser() || !getHasUnsyncedChanges() || !isCloudSyncAllowed()) return true;
      return handleCloudSaveResult(await saveCloudState());
    }

    async function flushCloudSave() {
      if (isChildUser() || !getHasUnsyncedChanges() || !isCloudSyncAllowed()) return true;
      const saved = await window.AppCloud.flushCloudSave({
        cloudSync,
        isGuest,
        cloudUserKey,
        saveCloudState,
      });
      return handleCloudSaveResult(saved);
    }

    async function persistChanges(failedMessage = "Perubahan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.") {
      if (isChildUser()) {
        alert("Akses ini hanya tersedia untuk akun utama.");
        return false;
      }
      markDataChanged();
      saveState();
      renderAll();
      const saved = await flushCloudSave();
      if (!saved && isCloudSyncAllowed()) alert(failedMessage);
      return saved;
    }

    async function syncCloudState(options = {}) {
      if (isGuest()) return false;
      if (!cloudSync.enabled) {
        cloudSync.lastError = "Konfigurasi Supabase belum aktif.";
        return false;
      }
      if (!isCloudSyncAllowed()) {
        cloudSync.lastError = "";
        return false;
      }
      if (!cloudUserKey()) {
        cloudSync.lastError = "Akun belum terhubung ke Supabase. Silakan logout lalu login kembali.";
        return false;
      }
      await loadCloudState(options);
      if (!cloudSync.lastError && options.markSynced !== false) {
        setHasUnsyncedChanges(false);
        setLocalSyncStatus("synced");
      }
      renderAll();
      return !cloudSync.lastError;
    }

    async function loadCloudState(options = {}) {
      if (!isCloudSyncAllowed()) return;
      return window.AppCloud.loadCloudState({
        cloudSync,
        setupCloudClient,
        cloudConfig,
        cloudUserKey,
        replaceState,
        mergeStateData,
        emptyState,
        state,
        saveCloudState,
        saveAfterLoad: options.saveAfterLoad,
        hasPendingLocalChanges: getHasUnsyncedChanges,
        markConflict: markCloudConflict,
      });
    }

    async function saveCloudState() {
      if (!isCloudSyncAllowed()) return true;
      return window.AppCloud.saveCloudState({
        cloudSync,
        setupCloudClient,
        cloudConfig,
        cloudUserKey,
        normalizeState,
        state,
        renderAccount,
      });
    }

    function syncStatusText() {
      if (isChildUser()) return "Akses keluarga aktif. Data dibaca dari akun utama.";
      if (cloudSync.conflictDetected) return cloudSync.conflictMessage || "Potensi konflik sync terdeteksi. Data sudah digabung, cek kembali perubahan terbaru.";
      if (state.settings.cloudSyncEnabled === false) {
        return getHasUnsyncedChanges()
          ? "Sinkronisasi cloud nonaktif. Perubahan tersimpan lokal dan menunggu sync."
          : "Sinkronisasi cloud nonaktif. Data hanya disimpan di perangkat ini.";
      }
      if (cloudSync.nextRetryAt && getHasUnsyncedChanges()) {
        const retryLabel = new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(cloudSync.nextRetryAt));
        return `Perubahan lokal belum tersinkron. Retry otomatis pukul ${retryLabel}.`;
      }
      if (state.syncStatus === "failed") return "Perubahan lokal belum berhasil tersinkron. Coba tekan Sync.";
      if (state.syncStatus === "pending") return "Ada perubahan lokal yang menunggu sinkronisasi.";
      return window.AppCloud.syncStatusText(cloudSync);
    }

    function markCloudConflict(remoteAt) {
      cloudSync.conflictDetected = true;
      const label = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(remoteAt));
      cloudSync.conflictMessage = `Potensi konflik sync: data juga berubah di perangkat lain pada ${label}. Data digabung otomatis, cek kembali sebelum lanjut.`;
    }

    function applyCloudPayload(payload, updatedAt) {
      if (isGuest() || !payload || !isCloudSyncAllowed()) return;
      if (!getHasUnsyncedChanges() && window.AppCloud.isTimestampAfter(state.localChangedAt, updatedAt)) return;
      if (getHasUnsyncedChanges()) markCloudConflict(updatedAt || new Date().toISOString());
      replaceState(getHasUnsyncedChanges() ? mergeStateData(payload, state) : payload);
      cloudSync.lastSyncedAt = updatedAt || new Date().toISOString();
      cloudSync.lastError = "";
      renderAll();
    }

    function startCloudRealtimeSync() {
      if (!isCloudSyncAllowed()) return;
      window.AppCloud.startRealtimeSync({
        cloudSync,
        setupCloudClient,
        cloudConfig,
        cloudUserKey,
        applyCloudPayload,
        loadCloudState,
      });
    }

    function stopCloudRealtimeSync() {
      window.AppCloud.stopRealtimeSync(cloudSync);
    }

    return {
      applyCloudPayload,
      clearSyncRetry,
      cloudUserKey,
      flushCloudSave,
      loadCloudState,
      markCloudConflict,
      mergeStateData,
      persistChanges,
      queueCloudSave,
      saveCloudState,
      savePendingCloudChanges,
      setupCloudClient,
      startCloudRealtimeSync,
      stopCloudRealtimeSync,
      syncCloudState,
      syncStatusText,
    };
  },
};
