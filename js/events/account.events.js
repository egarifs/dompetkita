window.AppAccountEvents = {
  register(deps) {
    const {
      applyRecurringThisMonth,
      applyState,
      cloudSync,
      copyText,
      deleteCurrentAccount,
      demoState,
      exportCsv,
      exportExcel,
      exportJson,
      getCategories,
      getCurrentUser,
      getHasUnsyncedChanges,
      getState,
      id,
      importJson,
      isCloudSyncAllowed,
      isGuest,
      loadCloudState,
      normalizeState,
      openDebtHistory,
      openSavingsHistory,
      openView,
      persistChanges,
      renderAll,
      renderDailyExpenses,
      renderStats,
      requireAdmin,
      requirePrimaryAccount,
      requireSignedIn,
      saveState,
      setGuestTransactionAdds,
      setHasUnsyncedChanges,
      setLocalSyncStatus,
      shareApp,
      showSnackbar,
      startCloudRealtimeSync,
      stopCloudRealtimeSync,
      syncCloudState,
    } = deps;

    document.querySelector("#copyBcaButton").addEventListener("click", async () => {
      await copyText(document.querySelector("#bcaAccountNumber").textContent.trim());
      alert("Nomor rekening BCA berhasil disalin.");
    });
    document.querySelector("#shareAppButton").addEventListener("click", shareApp);
    document.querySelector("#viewAllSavingsButton").addEventListener("click", () => openView("savings"));
    document.querySelector("#homeSavingsHistoryButton").addEventListener("click", openSavingsHistory);
    document.querySelector("#savingsHistoryButton").addEventListener("click", openSavingsHistory);
    document.querySelector("#showAllDailyExpensesButton").addEventListener("click", () => {
      deps.setShowAllDailyExpenses(true);
      renderDailyExpenses();
    });
    document.querySelector("#toggleTotalBalanceVisibilityButton").addEventListener("click", (event) => {
      event.stopPropagation();
      if (!requirePrimaryAccount()) return;
      const state = getState();
      state.settings.totalBalanceVisible = !state.settings.totalBalanceVisible;
      renderStats();
      saveState();
    });

    document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
    document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
    document.querySelector("#importJsonFile").addEventListener("change", importJson);
    document.querySelector("#exportExcelButton").addEventListener("click", exportExcel);
    document.querySelector("#debtHistoryButton").addEventListener("click", openDebtHistory);
    document.querySelector("#syncNowButton").addEventListener("click", async () => {
      if (!requireSignedIn()) return;
      if (!isCloudSyncAllowed()) {
        alert("Sinkronisasi cloud sedang nonaktif. Aktifkan toggle Sinkronisasi Cloud untuk mengirim data ke cloud.");
        return;
      }
      const synced = await syncCloudState();
      alert(synced ? "Data berhasil disinkronkan dari cloud." : `Cloud belum bisa disinkronkan.${cloudSync.lastError ? `\n\nDetail: ${cloudSync.lastError}` : ""}`);
    });
    document.querySelector("#applyRecurringButton").addEventListener("click", async () => {
      if (!requirePrimaryAccount()) return;
      await applyRecurringThisMonth();
    });
    document.querySelector("#darkModeToggle").addEventListener("change", (event) => {
      const state = getState();
      if (!requirePrimaryAccount()) {
        event.target.checked = Boolean(state.settings.darkMode);
        return;
      }
      state.settings.darkMode = event.target.checked;
      persistChanges("Pengaturan tampilan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
    });
    document.querySelector("#cloudSyncToggle").addEventListener("change", async (event) => {
      const state = getState();
      if (!requirePrimaryAccount()) {
        event.target.checked = state.settings.cloudSyncEnabled !== false;
        return;
      }
      state.settings.cloudSyncEnabled = event.target.checked;
      cloudSync.lastError = "";
      if (state.settings.cloudSyncEnabled) {
        renderAll();
        if (!isGuest() && isCloudSyncAllowed()) {
          const hasUnsyncedChanges = getHasUnsyncedChanges();
          await loadCloudState({ saveAfterLoad: hasUnsyncedChanges });
          if (!cloudSync.lastError) {
            setHasUnsyncedChanges(false);
            setLocalSyncStatus("synced");
          } else if (hasUnsyncedChanges) {
            setLocalSyncStatus("failed");
            showSnackbar("Data lokal belum berhasil tersinkron ke cloud.", "error");
          }
          startCloudRealtimeSync();
        }
      } else {
        stopCloudRealtimeSync();
        clearTimeout(cloudSync.saveTimer);
        renderAll();
        showSnackbar("Sinkronisasi cloud nonaktif. Data hanya disimpan lokal.");
      }
    });
    document.querySelector("#languageSelect").addEventListener("change", (event) => {
      const state = getState();
      if (!requirePrimaryAccount()) {
        event.target.value = state.settings.language || "id";
        return;
      }
      state.settings.language = event.target.value;
      persistChanges("Pengaturan bahasa tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
    });
    document.querySelector("#logoutButton").addEventListener("click", deps.logout);
    document.querySelector("#deleteAccountButton").addEventListener("click", deleteCurrentAccount);
    document.querySelector("#loadDemoButton").addEventListener("click", () => {
      if (!isGuest()) {
        alert("Data contoh hanya tersedia saat masuk sebagai tamu.");
        return;
      }
      if (confirm("Muat ulang data contoh? Data saat ini akan diganti.")) {
        setGuestTransactionAdds(0);
        const normalized = normalizeState(demoState());
        applyState({
          ...normalized,
          deleted: { transactions: [], debts: [], budgets: [], savings: [], billReminders: [], recurring: [], wallets: [], vehicles: [], vehicleServices: [], vehicleOilChanges: [], vehicleParts: [], vehicleTaxes: [], familyMembers: [] },
        });
        renderAll();
      }
    });
    document.querySelector("#clearDataButton").addEventListener("click", () => {
      if (!requireAdmin()) return;
      if (!confirm("Kosongkan semua data transaksi, anggaran, dan hutang piutang?")) return;
      const state = getState();
      const currentUser = getCurrentUser();
      state.transactions = [];
      state.budgets = getCategories().map((category) => ({
        id: id(),
        userId: currentUser?.id || "",
        name: category,
        category,
        type: "expense",
        parentId: null,
        budgetLimit: 0,
        limit: 0,
        usedAmount: 0,
        remainingAmount: 0,
        period: "monthly",
        icon: "",
        color: "",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      state.debts = [];
      state.savings = [];
      state.billReminders = [];
      state.recurring = [];
      state.vehicles = [];
      state.vehicleServices = [];
      state.vehicleOilChanges = [];
      state.vehicleParts = [];
      state.vehicleTaxes = [];
      state.deleted = { transactions: [], debts: [], budgets: [], savings: [], billReminders: [], recurring: [], wallets: [], vehicles: [], vehicleServices: [], vehicleOilChanges: [], vehicleParts: [], vehicleTaxes: [], familyMembers: [] };
      persistChanges("Data sudah dikosongkan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
    });
  },
};
