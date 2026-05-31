      const {
        storageKey,
        authStorageKey,
        sessionStorageKey,
        rememberedLoginKey,
        failedLoginKey,
        deletedAccountsKey,
        IDLE_TIMEOUT_MINUTES,
        WARNING_BEFORE_LOGOUT_MINUTES,
        splashReadDelay,
        localSplashQuotes,
        savingCategories,
        defaultCategories,
        rupiah,
      } = window.AppConstants;
      const appConfig = globalThis.APP_CONFIG || {};
      const appMeta = globalThis.APP_META || {};
      const appVersion = appMeta.version || "1.0.0";
      const appShareUrl = appMeta.shareUrl || "https://dompify.netlify.app/";
      const cloudConfig = {
        url: appConfig.supabaseUrl || "",
        anonKey: appConfig.supabaseAnonKey || "",
        table: appConfig.supabaseTable || "finance_snapshots",
      };
      const cloudSync = {
        enabled: Boolean(cloudConfig.url && cloudConfig.anonKey && globalThis.supabase?.createClient),
        client: null,
        loadedUsers: new Set(),
        saveTimer: null,
        isSaving: false,
        pendingSave: false,
        savePromise: null,
        channel: null,
        realtimeUserKey: "",
        realtimeStatus: "",
        pollTimer: null,
        lastSyncedAt: null,
        lastError: "",
        retryTimer: null,
        retryCount: 0,
        nextRetryAt: null,
        conflictDetected: false,
        conflictMessage: "",
        readOnly: false,
      };
      let deferredInstallPrompt = null;

      const {
        todayDate,
        currentMonthKey,
        previousMonthKey,
        monthLabel,
        id,
        money,
        formatRupiah,
        parseRupiahToNumber,
        formatNumber,
        parseFormattedNumber,
        escapeHtml,
      } = window.AppUtils;

      const {
        mergeById,
        deletionList,
        mergeDeletedIds,
        withoutDeleted,
      } = window.AppState;

      const appIcon = (name, size = 20, className = "lucide-icon") => window.AppIcons.icon(name, size, className);

      const translations = {
        id: {
          "nav.home": "Beranda",
          "nav.reports": "Transaksi",
          "nav.analytics": "Analitik",
          "nav.add": "Tambah",
          "nav.addTransaction": "Tambah Transaksi",
          "nav.addDebt": "Tambah Hutang Piutang",
          "nav.budgets": "Anggaran",
          "nav.account": "Akun",
          "common.add": "Tambah",
          "account.title": "Akun",
          "account.subtitle": "Profil, sinkronisasi, bahasa, dan tampilan aplikasi.",
          "account.cloudSync": "Sinkronisasi Cloud",
          "account.exportExcel": "Export Data ke Excel",
          "account.exportExcelDesc": "Unduh transaksi, anggaran, hutang piutang, dan transaksi berulang.",
          "account.recurring": "Transaksi Berulang",
          "account.language": "Bahasa",
          "account.languageDesc": "Ubah bahasa tampilan aplikasi.",
          "account.darkMode": "Dark Mode",
          "account.darkModeDesc": "Ubah tampilan menjadi mode gelap.",
        },
        en: {
          "nav.home": "Home",
          "nav.reports": "Transactions",
          "nav.analytics": "Analytics",
          "nav.add": "Add",
          "nav.addTransaction": "Add Transaction",
          "nav.addDebt": "Add Debt",
          "nav.budgets": "Budget",
          "nav.account": "Account",
          "common.add": "Add",
          "account.title": "Account",
          "account.subtitle": "Profile, sync, language, and app appearance.",
          "account.cloudSync": "Cloud Sync",
          "account.exportExcel": "Export Data to Excel",
          "account.exportExcelDesc": "Download transactions, budgets, debts, and recurring transactions.",
          "account.recurring": "Recurring Transactions",
          "account.language": "Language",
          "account.languageDesc": "Change the app display language.",
          "account.darkMode": "Dark Mode",
          "account.darkModeDesc": "Switch the display to dark mode.",
        },
      };

      const pageCopy = {
        id: {
          home: ["Beranda Keuangan", "Pantau pengeluaran bulan berjalan, saldo, dan sisa anggaran."],
          reports: ["Transaksi", "Lihat dan filter seluruh catatan pemasukan maupun pengeluaran."],
          finance: ["Keuangan", "Kelola dompet, anggaran, tabungan, hutang piutang, dan laporan."],
          analytics: ["Analitik", "Pantau pola pengeluaran per kategori dan per hari."],
          budgets: ["Anggaran", "Atur batas pengeluaran bulanan per kategori."],
          debts: ["Hutang & Piutang", "Pantau kewajiban, piutang, pembayaran, dan riwayat pelunasan."],
          billReminders: ["Tagihan Jatuh Tempo", "Pantau tagihan sebelum jatuh tempo."],
          wallets: ["Dompet", "Kelola saldo Cash, Bank, E-Wallet, dan sumber uang lainnya."],
          walletDetail: ["Detail Dompet", "Lihat saldo dan mutasi transaksi pada dompet yang dipilih."],
          balanceSheet: ["Neraca Keuangan", "Lihat total aset, kewajiban, dan kekayaan bersih keluarga."],
          vehicles: ["Kendaraan", "Pantau service, oli, part, pajak, dan biaya kendaraan."],
          account: ["Akun", "Kelola profil, akses, ekspor data, dan pengaturan aplikasi."],
          thanks: ["Thanks", "Dukung pengembangan aplikasi melalui rekening yang tersedia."],
          savings: ["Tabungan", "Kelola tujuan tabungan dan progres pencapaiannya."],
        },
        en: {
          home: ["Finance Dashboard", "Track this month's spending, balance, and remaining budget."],
          reports: ["Transactions", "View and filter all income and expense records."],
          finance: ["Finance", "Manage wallets, budgets, savings, debts, and reports."],
          analytics: ["Analytics", "Monitor spending patterns by category and by day."],
          budgets: ["Budget", "Set monthly spending limits by category."],
          debts: ["Debts & Receivables", "Track obligations, receivables, payments, and settlement history."],
          billReminders: ["Due Bills", "Track bills before their due date."],
          wallets: ["Wallets", "Manage Cash, Bank, E-Wallet, and other money sources."],
          walletDetail: ["Wallet Detail", "Review balance and transaction mutations for the selected wallet."],
          balanceSheet: ["Balance Sheet", "Review total assets, liabilities, and family net worth."],
          vehicles: ["Vehicles", "Track service, oil, parts, taxes, and vehicle costs."],
          account: ["Account", "Manage profile, access, exports, and app settings."],
          thanks: ["Thanks", "Support app development through the available bank account."],
          savings: ["Savings", "Manage savings goals and progress."],
        },
      };

      const defaultHomeSectionOrder = ["wallets", "insight", "latestTransactions"];
      const state = loadState();
      let categories = state.categories?.length ? state.categories : [...defaultCategories];
      state.categories = categories;
      state.settings.homeSectionOrder = normalizeHomeSectionOrder(state.settings?.homeSectionOrder);
      let users = window.AppAuth.loadUsers(authStorageKey, deletedAccountsKey);
      let currentUser = loadSessionUser();
      let guestTransactionAdds = 0;
      let hasUnsyncedChanges = state.syncStatus === "pending" || state.syncStatus === "failed";
      let quickTransactionRange = "month";
      let selectedCategoryFilter = "all";
      let showAllDailyExpenses = false;
      let selectedWalletDetailId = "";
      const idleTimeoutMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
      const idleWarningMs = WARNING_BEFORE_LOGOUT_MINUTES * 60 * 1000;
      const idleWarningDelayMs = Math.max(0, idleTimeoutMs - idleWarningMs);
      let idleWarningTimer = null;
      let idleLogoutTimer = null;
      let idleTrackingActive = false;
      let idleWarningOpen = false;
      const idleActivityEvents = ["click", "scroll", "keydown", "touchstart", "pointerdown"];


      function loadUsers() {
        return window.AppAuth.loadUsers(authStorageKey, deletedAccountsKey);
      }

      function saveUsers(nextUsers) {
        users = nextUsers;
        window.AppAuth.saveUsers(authStorageKey, users);
      }

      function showSnackbar(message, tone = "success", action = null) {
        window.AppToast.show(message, tone, action);
      }

      function loadRememberedLogin() {
        return window.AppAuth.loadRememberedLogin(rememberedLoginKey);
      }

      function saveRememberedLogin(email, password) {
        window.AppAuth.saveRememberedLogin(rememberedLoginKey, email, password);
      }

      function clearRememberedLogin() {
        window.AppAuth.clearRememberedLogin(rememberedLoginKey);
      }

      function applyRememberedLogin() {
        const saved = loadRememberedLogin();
        if (!saved) return;
        document.querySelector("#loginUsername").value = saved.email;
        document.querySelector("#loginPassword").value = saved.password;
        document.querySelector("#rememberLogin").checked = true;
      }

      function failedLoginCount() {
        return window.AppAuth.failedLoginCount(failedLoginKey);
      }

      function updateForgotPasswordVisibility() {
        document.querySelector("#forgotPasswordButton").classList.toggle("hidden", failedLoginCount() < 3);
      }

      function recordFailedLogin() {
        window.AppAuth.recordFailedLogin(failedLoginKey);
        updateForgotPasswordVisibility();
      }

      function resetFailedLogin() {
        window.AppAuth.resetFailedLogin(failedLoginKey);
        updateForgotPasswordVisibility();
      }

      function loadSessionUser() {
        return window.AppAuth.loadSessionUser(sessionStorageKey, users || loadUsers());
      }

      function clearIdleLogoutTimers() {
        clearTimeout(idleWarningTimer);
        clearTimeout(idleLogoutTimer);
        idleWarningTimer = null;
        idleLogoutTimer = null;
      }

      function isIdleLogoutEligible() {
        return Boolean(currentUser && document.querySelector("#appShell:not(.hidden)"));
      }

      function hideIdleWarning() {
        if (!idleWarningOpen) return;
        idleWarningOpen = false;
        closeModal();
      }

      function handleUserActivity() {
        if (!idleTrackingActive || !isIdleLogoutEligible()) return;
        if (idleWarningOpen) return;
        resetIdleLogoutTimer();
      }

      function startIdleActivityListeners() {
        if (idleTrackingActive) return;
        idleActivityEvents.forEach((eventName) => {
          document.addEventListener(eventName, handleUserActivity, { passive: true, capture: eventName === "scroll" });
        });
        idleTrackingActive = true;
      }

      function stopIdleActivityListeners() {
        if (!idleTrackingActive) return;
        idleActivityEvents.forEach((eventName) => {
          document.removeEventListener(eventName, handleUserActivity, { capture: eventName === "scroll" });
        });
        idleTrackingActive = false;
      }

      function showIdleWarning() {
        if (!isIdleLogoutEligible()) {
          hideIdleWarning();
          clearIdleLogoutTimers();
          return;
        }
        idleWarningOpen = true;
        document.querySelector("#modalTitle").textContent = "Sesi Hampir Berakhir";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <p style="color: var(--muted); line-height: 1.55">Anda akan keluar otomatis karena tidak ada aktivitas.</p>
            <div class="row-actions">
              <button class="button" type="button" id="idleStayButton">Tetap Masuk</button>
              <button class="button danger" type="button" id="idleLogoutNowButton">Logout Sekarang</button>
            </div>
          </div>
        `;
        showModal();
        document.querySelector("#idleStayButton").addEventListener("click", () => {
          hideIdleWarning();
          resetIdleLogoutTimer();
        });
        document.querySelector("#idleLogoutNowButton").addEventListener("click", () => {
          logout("Sesi Anda berakhir karena tidak ada aktivitas.");
        });
      }

      function resetIdleLogoutTimer() {
        if (!isIdleLogoutEligible()) {
          clearIdleLogoutTimers();
          hideIdleWarning();
          return;
        }
        clearIdleLogoutTimers();
        hideIdleWarning();
        idleWarningTimer = setTimeout(showIdleWarning, idleWarningDelayMs);
        idleLogoutTimer = setTimeout(() => {
          logout("Sesi Anda berakhir karena tidak ada aktivitas.");
        }, idleTimeoutMs);
      }

      function startIdleLogoutTimer() {
        if (!isIdleLogoutEligible()) return;
        startIdleActivityListeners();
        resetIdleLogoutTimer();
      }

      function stopIdleLogoutTimer() {
        clearIdleLogoutTimers();
        hideIdleWarning();
        stopIdleActivityListeners();
        idleWarningOpen = false;
      }


      function isAdmin() {
        return currentUser?.role === "admin";
      }

      function isGuest() {
        return currentUser?.role === "guest";
      }

      function isChildUser() {
        return currentUser?.role === "child";
      }

      function requirePrimaryAccount() {
        if (!requireSignedIn()) return false;
        if (!isChildUser()) return true;
        alert("Akses ini hanya tersedia untuk akun utama.");
        return false;
      }

      function requireAdmin() {
        if (isGuest()) return requireSignedIn();
        if (isAdmin()) return true;
        alert("Fitur ini hanya bisa digunakan oleh akun admin.");
        return false;
      }

      function requireSignedIn() {
        if (currentUser && !isGuest()) return true;
        openAuthRequiredModal();
        return false;
      }

      function currentLanguage() {
        return translations[state.settings?.language] ? state.settings.language : "id";
      }

      function textFor(key) {
        const language = currentLanguage();
        return translations[language]?.[key] || translations.id[key] || key;
      }

      function currentPageCopy(view) {
        const language = currentLanguage();
        return pageCopy[language]?.[view] || pageCopy.id[view];
      }

      const router = window.AppRouter.createRouter({ currentPageCopy });
      const dashboardFeature = window.AppDashboard.createDashboard({
        getCurrentUser: () => currentUser,
        getState: () => state,
        activeDebts,
        appIcon,
        currentBudgetTotal,
        currentMonthKey,
        defaultHomeSectionOrder,
        money,
        monthLabel,
        monthOf,
        previousMonthKey,
        sumTransactions,
        totalBalanceUntil,
        transactionsByMonth,
      });
      const walletService = window.AppWalletService.createService({
        getState: () => state,
        currentUserId,
        escapeHtml,
        id,
        markDeleted,
        money,
        normalizeWallet: window.AppState.normalizeWallet,
      });
      const walletRenderer = window.AppWalletRender.createRenderer({
        clearSelectedWalletDetailId: () => {
          selectedWalletDetailId = "";
        },
        escapeHtml,
        getSelectedWalletDetailId: () => selectedWalletDetailId,
        getState: () => state,
        money,
        monthLabel,
        monthOf,
        openView,
        recalculateWalletBalances,
        requireSignedIn,
        setSelectedWalletDetailId: (walletId) => {
          selectedWalletDetailId = walletId;
        },
        transactionDateLabel,
        transactionTypeLabel,
        editIcon,
        trashIcon,
      });
      const transactionService = window.AppTransactionService.createService({
        id,
        normalizeTransaction: window.AppState.normalizeTransaction,
        tx: window.AppState.tx,
      });
      const transactionRenderer = window.AppTransactionRender.createRenderer({
        editIcon,
        escapeHtml,
        getQuickTransactionRange: () => quickTransactionRange,
        getSelectedCategoryFilter: () => selectedCategoryFilter,
        getState: () => state,
        isChildUser,
        money,
        monthOf,
        quickRangeMatch,
        requireSignedIn,
        showModal,
        transactionDateLabel,
        transactionDateTimeLabel,
        transactionTypeLabel,
        trashIcon,
        walletName,
      });
      const budgetService = window.AppBudgetService.createService({
        escapeHtml,
        getCategories: () => categories,
        getState: () => state,
        setCategories: (nextCategories) => {
          categories = nextCategories;
        },
        currentMonthKey,
        transactionsByMonth,
      });
      const budgetRenderer = window.AppBudgetRender.createRenderer({
        activeBudgets,
        budgetRemainingAmount,
        budgetTypeLabel,
        budgetUsedAmount,
        childBudgets,
        currentMonthKey,
        editIcon,
        escapeHtml,
        money,
        trashIcon,
      });
      const billReminderService = window.AppBillReminderService.createService({
        currentMonthKey,
        getState: () => state,
        todayDate,
      });
      const billReminderRenderer = window.AppBillReminderRender.createRenderer({
        appIcon,
        editIcon,
        escapeHtml,
        money,
        service: billReminderService,
        trashIcon,
      });
      const savingsService = window.AppSavingsService.createService({
        id,
        savingsEntry: window.AppState.savingsEntry,
        savingsGoal: window.AppState.savingsGoal,
        todayDate,
      });
      const savingsRenderer = window.AppSavingsRender.createRenderer({
        escapeHtml,
        getState: () => state,
        isSavingsAchieved,
        money,
        savingsBalance,
        savingsPercent,
        trashIcon,
      });
      const debtService = window.AppDebtService.createService({
        getState: () => state,
      });
      const debtRenderer = window.AppDebtRender.createRenderer({
        appIcon,
        debtPaymentTransactions,
        escapeHtml,
        getState: () => state,
        money,
        transactionDateLabel,
        trashIcon,
        walletName,
      });
      const accountService = window.AppAccountService.createService({
        dataOwnerId,
        familyMember: window.AppState.familyMember,
        getCurrentUser: () => currentUser,
        id,
        isGuest,
        setupCloudClient,
      });
      const accountRenderer = window.AppAccountRender.createRenderer({
        appVersion,
        cloudSync,
        currentLanguage,
        dashboardSectionLabel,
        escapeHtml,
        getCategories: () => categories,
        getCurrentUser: () => currentUser,
        getState: () => state,
        isAdmin,
        isChildUser,
        isCloudSyncAllowed,
        isGuest,
        money,
        syncStatusText,
      });
      const vehicleService = window.AppVehicleService.createService({
        defaultWalletId,
        escapeHtml,
        getState: () => state,
        markDeleted,
        setCategories: (nextCategories) => {
          categories = nextCategories;
        },
        todayDate,
        transactionRecord,
        updateTransactionRecord,
      });
      const vehicleRenderer = window.AppVehicleRender.createRenderer({
        addMonths,
        appIcon,
        currentMonthKey,
        editIcon,
        escapeHtml,
        formatNumber,
        getState: () => state,
        money,
        monthOf,
        todayDate,
        trashIcon,
        vehicleName,
        vehicleOptions,
        vehicleStatusBySchedule,
        vehicleTransactions,
      });
      const analyticsService = window.AppAnalyticsService.createService({
        budgetDisplayName,
        getState: () => state,
        transactionMatchesBudget,
        transactionTypeMatchesBudget,
      });
      const analyticsRenderer = window.AppAnalyticsRender.createRenderer({
        activeBudgets,
        analyticsService,
        appIcon,
        budgetTypeLabel,
        budgetUsedAmount,
        currentMonthKey,
        escapeHtml,
        expenseForCategory,
        getCategories: () => categories,
        getShowAllDailyExpenses: () => showAllDailyExpenses,
        getState: () => state,
        latestVehicleOil,
        money,
        monthLabel,
        monthOf,
        nearestVehiclePart,
        oilNextDate,
        oilNextKm,
        partNextDate,
        partNextKm,
        previousMonthKey,
        sumTransactions,
        todayDate,
        transactionsByMonth,
        vehicleStatusBySchedule,
        vehicleTax,
        walletName,
        showModal,
      });

      function activeView() {
        return router.activeView();
      }

      function applyLanguage() {
        document.documentElement.lang = currentLanguage();
        document.querySelectorAll("[data-i18n]").forEach((element) => {
          element.textContent = textFor(element.dataset.i18n);
        });
        const copy = currentPageCopy(activeView());
        if (copy) {
          document.querySelector("#pageHeading").textContent = copy[0];
          document.querySelector("#pageSubtitle").textContent = copy[1];
        }
      }

      function attachRupiahInput(selector) {
        window.AppMoneyInput.attach(selector);
      }

      function attachRupiahInputs(selectors = []) {
        window.AppMoneyInput.attachAll(selectors);
      }

      function rupiahInputHtml(id, value = "", attributes = "") {
        return window.AppMoneyInput.html(id, value, attributes);
      }

      function calculateMoneyExpression(expression) {
        return window.AppMoneyCalculator.calculate(expression);
      }

      function ensureMoneyCalculator() {
        return window.AppMoneyCalculator.ensure();
      }

      function openMoneyCalculator(input) {
        window.AppMoneyCalculator.open(input);
      }

      function closeMoneyCalculator() {
        window.AppMoneyCalculator.close();
      }

      function updateMoneyCalculatorResult() {
        window.AppMoneyCalculator.updateResult();
      }

      function loadState() {
        return window.AppStore.loadState({ storageKey, normalizeState, emptyState });
      }

      function emptyState() {
        return normalizeState({});
      }

      const store = window.AppStore.createStore({
        emptyState,
        getHasUnsyncedChanges: () => hasUnsyncedChanges,
        isChildUser,
        isGuest,
        normalizeState,
        persistChanges,
        queueCloudSave,
        setHasUnsyncedChanges: (value) => {
          hasUnsyncedChanges = value;
        },
        showSnackbar,
        state,
        storageKey,
      });

      function saveState() {
        store.saveState();
      }

      function markDataChanged() {
        store.markDataChanged();
      }

      function setLocalSyncStatus(status) {
        store.setLocalSyncStatus(status);
      }

      function isCloudSyncAllowed() {
        return Boolean(cloudSync.enabled && state.settings.cloudSyncEnabled !== false);
      }

      function applyState(normalized) {
        store.applyState(normalized);
      }

      function replaceState(nextState) {
        store.replaceState(nextState);
      }

      function hydrateStoredStateForCurrentUser() {
        store.hydrateStoredStateForCurrentUser();
      }

      function markDeleted(collection, itemId) {
        store.markDeleted(collection, itemId);
      }

      function unmarkDeleted(collection, itemIds) {
        store.unmarkDeleted(collection, itemIds);
      }

      function cloneData(value) {
        return store.cloneData(value);
      }

      function restoreItems(collection, items) {
        store.restoreItems(collection, items);
      }

      async function deleteWithUndo(options) {
        return store.deleteWithUndo(options);
      }

      const syncCoordinator = window.AppSync.createCoordinator({
        cloudConfig,
        cloudSync,
        emptyState,
        getCurrentUser: () => currentUser,
        getHasUnsyncedChanges: () => hasUnsyncedChanges,
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
        setHasUnsyncedChanges: (value) => {
          hasUnsyncedChanges = value;
        },
        setLocalSyncStatus,
        showSnackbar,
        state,
        withoutDeleted,
      });

      function mergeStateData(cloudData, localData) {
        return syncCoordinator.mergeStateData(cloudData, localData);
      }

      function setupCloudClient() {
        return syncCoordinator.setupCloudClient();
      }

      function cloudUserKey() {
        return syncCoordinator.cloudUserKey();
      }

      function queueCloudSave() {
        return syncCoordinator.queueCloudSave();
      }

      function clearSyncRetry() {
        syncCoordinator.clearSyncRetry();
      }

      async function savePendingCloudChanges() {
        return syncCoordinator.savePendingCloudChanges();
      }

      async function flushCloudSave() {
        return syncCoordinator.flushCloudSave();
      }

      async function persistChanges(failedMessage) {
        return syncCoordinator.persistChanges(failedMessage);
      }

      async function syncCloudState(options = {}) {
        return syncCoordinator.syncCloudState(options);
      }

      async function loadCloudState(options = {}) {
        return syncCoordinator.loadCloudState(options);
      }

      async function saveCloudState() {
        return syncCoordinator.saveCloudState();
      }

      function syncStatusText() {
        return syncCoordinator.syncStatusText();
      }

      function startCloudRealtimeSync() {
        syncCoordinator.startCloudRealtimeSync();
      }

      function stopCloudRealtimeSync() {
        syncCoordinator.stopCloudRealtimeSync();
      }

      function normalizeState(data) {
        return window.AppState.normalizeState(data, { defaultCategories, translations });
      }

      function demoState() {
        return window.AppState.demoState({
          currentMonthKey,
          previousMonthKey,
          tx,
          savingsGoal,
          savingsEntry,
          billReminder,
          id,
          defaultCategories,
        });
      }

      function tx(type, date, category, description, amount) {
        return window.AppState.tx(id(), type, date, category, description, amount);
      }

      function transactionRecord(type, date, category, description, amount, meta = {}) {
        return transactionService.record(type, date, category, description, amount, meta);
      }

      function updateTransactionRecord(target, values) {
        transactionService.updateRecord(target, values);
      }

      function savingsEntry(type, date, amount, note) {
        return savingsService.entry(type, date, amount, note);
      }

      function savingsGoal(category, target, targetDate, entries = []) {
        return savingsService.goal(category, target, targetDate, entries);
      }

      function touchSavingsGoal(goal) {
        if (!goal) return;
        goal.updatedAt = new Date().toISOString();
      }

      function mergeSavingsEntries(primaryEntries = [], secondaryEntries = []) {
        const map = new Map();
        [...primaryEntries, ...secondaryEntries].forEach((entry) => {
          if (!entry?.id) return;
          const existing = map.get(entry.id);
          if (!existing || String(entry.updatedAt || "") >= String(existing.updatedAt || "")) {
            map.set(entry.id, entry);
          }
        });
        return [...map.values()].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      }

      function mergeSavingsGoals(primary = [], secondary = []) {
        const map = new Map();
        primary.forEach((goal) => map.set(goal.id, { ...goal, entries: [...(goal.entries || [])] }));
        secondary.forEach((goal) => {
          const existing = map.get(goal.id);
          if (!existing) {
            map.set(goal.id, { ...goal, entries: [...(goal.entries || [])] });
            return;
          }
          const newerGoal = String(goal.updatedAt || "") >= String(existing.updatedAt || "") ? goal : existing;
          map.set(goal.id, {
            ...existing,
            ...newerGoal,
            entries: mergeSavingsEntries(existing.entries || [], goal.entries || []),
          });
        });
        return [...map.values()];
      }

      function billReminder(title, category, amount, dueDate, note = "", status = "unpaid") {
        return window.AppState.billReminder(id(), title, category, amount, dueDate, note, status);
      }

      function currentUserId() {
        return currentUser?.cloudId || currentUser?.id || currentUser?.username || "";
      }

      function dataOwnerId() {
        return currentUser?.dataOwnerId || currentUserId();
      }

      function familyMemberRecord({ childName, childEmail, phone = "", childUserId = "", status = "active" }) {
        return accountService.familyMemberRecord({ childName, childEmail, phone, childUserId, status });
      }

      async function upsertFamilyMemberAccess(member) {
        return accountService.upsertFamilyMemberAccess(member);
      }

      async function deleteFamilyMemberAccess(member) {
        return accountService.deleteFamilyMemberAccess(member);
      }

      function walletName(walletId) {
        return walletService.name(walletId);
      }

      function walletInUse(walletId) {
        return walletService.inUse(walletId);
      }

      function walletHasDuplicateName(name, editingId = "") {
        return walletService.hasDuplicateName(name, editingId);
      }

      function createWallet(values) {
        return walletService.createWallet(values);
      }

      function updateWallet(walletId, values) {
        return walletService.updateWallet(walletId, values);
      }

      function walletDeleteBlockReason(walletId) {
        return walletService.deleteBlockReason(walletId);
      }

      function deleteWallet(walletId) {
        return walletService.deleteWallet(walletId);
      }

      function walletOptions(selectedId = "") {
        return walletService.options(selectedId);
      }

      function defaultWalletId() {
        return walletService.defaultId();
      }

      function ensureTransactionWallets() {
        walletService.ensureTransactionWallets();
      }

      function recalculateWalletBalances() {
        walletService.recalculateBalances();
      }

      function debtPaymentTransactionTypeForDebt(debt) {
        return debtService.paymentTransactionTypeForDebt(debt);
      }

      function transactionPaymentDebtId(transaction) {
        return debtService.transactionPaymentDebtId(transaction);
      }

      function isDebtPaymentTransaction(transaction) {
        return debtService.isPaymentTransaction(transaction);
      }

      function debtPaymentTransactions(debtId, options = {}) {
        return debtService.paymentTransactions(debtId, options);
      }

      function debtPaidAmount(debt, options = {}) {
        return debtService.paidAmount(debt, options);
      }

      function debtRemainingAmount(debt, options = {}) {
        return debtService.remainingAmount(debt, options);
      }

      function syncDebtPaymentState() {
        debtService.syncPaymentState();
      }

      function vehicleName(vehicleId) {
        return vehicleService.vehicleName(vehicleId);
      }

      function ensureVehicleCategory() {
        vehicleService.ensureVehicleCategory();
      }

      function ensureDebtCategory() {
        if (!state.categories.includes("Hutang Piutang")) {
          state.categories.push("Hutang Piutang");
          categories = state.categories;
        }
      }

      function addMonths(dateValue, months) {
        return vehicleService.addMonths(dateValue, months);
      }

      function daysUntil(dateValue) {
        return vehicleService.daysUntil(dateValue);
      }

      function vehicleStatusBySchedule(dateValue, kmLeft = Infinity) {
        return vehicleService.vehicleStatusBySchedule(dateValue, kmLeft);
      }

      function vehicleOptions(selectedId = "") {
        return vehicleService.vehicleOptions(selectedId);
      }

      function vehicleTransactions() {
        return vehicleService.vehicleTransactions();
      }

      function upsertVehicleTransaction(record, subcategory, amount, date, description) {
        return vehicleService.upsertVehicleTransaction(record, subcategory, amount, date, description);
      }

      function removeVehicleTransaction(record) {
        vehicleService.removeVehicleTransaction(record);
      }

      function monthOf(item) {
        return item.date.slice(0, 7);
      }

      function transactionsByMonth(month = currentMonthKey()) {
        return state.transactions.filter((item) => monthOf(item) === month);
      }

      function sumTransactions(items, type) {
        return items.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      function totalBalanceUntil(dateLimit = "9999-12-31") {
        return state.transactions
          .filter((item) => item.date <= dateLimit)
          .reduce((sum, item) => sum + (item.type === "income" ? Number(item.amount) : -Number(item.amount)), 0);
      }

      function currentBudgetTotal() {
        return activeBudgets()
          .filter((item) => !item.parentId)
          .reduce((sum, item) => sum + Number(item.budgetLimit ?? item.limit ?? 0), 0);
      }

      function expenseForCategory(category, month = currentMonthKey()) {
        return transactionsByMonth(month)
          .filter((item) => item.type === "expense" && item.category === category)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      function activeBudgets(type = "") {
        return budgetService.active(type);
      }

      function budgetById(budgetId) {
        return budgetService.byId(budgetId);
      }

      function childBudgets(parentId) {
        return budgetService.children(parentId);
      }

      function budgetDisplayName(budget) {
        return budgetService.displayName(budget);
      }

      function budgetTypeLabel(type) {
        return budgetService.typeLabel(type);
      }

      function transactionMatchesBudget(transaction, budget) {
        return budgetService.transactionMatches(transaction, budget);
      }

      function transactionTypeMatchesBudget(transaction, budget) {
        return budgetService.transactionTypeMatches(transaction, budget);
      }

      function budgetUsedAmount(budget, month = currentMonthKey()) {
        return budgetService.usedAmount(budget, month);
      }

      function budgetRemainingAmount(budget, month = currentMonthKey()) {
        return budgetService.remainingAmount(budget, month);
      }

      function budgetOptions(type = "expense", selectedId = "") {
        return budgetService.options(type, selectedId);
      }

      function syncCategoriesFromBudgets() {
        budgetService.syncCategoriesFromBudgets();
      }

      function budgetHasCircularParent(budgetId, parentId) {
        return budgetService.hasCircularParent(budgetId, parentId);
      }

      function validateSubBudgetLimit({ parentId, budgetLimit, editingId = "" }) {
        return budgetService.validateSubLimit({ parentId, budgetLimit, editingId });
      }

      function syncBudgetUsageState(month = currentMonthKey()) {
        budgetService.syncUsageState(month);
      }

      function savingsBalance(goal) {
        return savingsService.balance(goal);
      }

      function savingsPercent(goal) {
        return savingsService.percent(goal);
      }

      function isSavingsAchieved(goal) {
        return savingsService.isAchieved(goal);
      }

      function activeDebts(kind) {
        return debtService.active(kind);
      }

      function netWorthStatus(netWorth, totalAssets) {
        if (netWorth < 0) {
          return {
            label: "Perlu Perhatian",
            className: "expense",
            message: "Kewajiban lebih besar dari aset. Prioritaskan pelunasan hutang aktif.",
          };
        }
        if (!totalAssets || netWorth < totalAssets * 0.1) {
          return {
            label: "Waspada",
            className: "debt",
            message: "Kekayaan bersih masih tipis dibanding aset. Perkuat saldo dan kurangi kewajiban.",
          };
        }
        return {
          label: "Sehat",
          className: "income",
          message: "Aset lebih kuat dari kewajiban. Pertahankan arus kas positif keluarga.",
        };
      }

      function netWorthSummary() {
        const walletAssets = state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0);
        const receivables = activeDebts("receivable");
        const liabilities = activeDebts("payable");
        const receivableAssets = receivables.reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);
        const totalLiabilities = liabilities.reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);
        const totalAssets = walletAssets + receivableAssets;
        const netWorth = totalAssets - totalLiabilities;
        const savingsTotal = state.savings.reduce((sum, goal) => sum + savingsBalance(goal), 0);
        return {
          walletAssets,
          receivableAssets,
          totalAssets,
          totalLiabilities,
          netWorth,
          savingsTotal,
          receivables,
          liabilities,
          status: netWorthStatus(netWorth, totalAssets),
        };
      }

      function balanceSheetRow(title, subtitle, amount, tone = "") {
        return `
          <article class="debt-row">
            <div class="debt-row-top">
              <div>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(subtitle || "-")}</span>
              </div>
              <strong class="${tone}">${money(amount)}</strong>
            </div>
          </article>
        `;
      }

      function renderNetWorth() {
        const summary = netWorthSummary();
        const statusClass = `pill ${summary.status.className}`;
        const dashboardStatus = document.querySelector("#netWorthStatus");
        const sheetStatus = document.querySelector("#balanceSheetStatus");

        document.querySelector("#netWorthValue").textContent = money(summary.netWorth);
        document.querySelector("#netWorthAssets").textContent = money(summary.totalAssets);
        document.querySelector("#netWorthLiabilities").textContent = money(summary.totalLiabilities);
        document.querySelector("#netWorthMessage").textContent = summary.status.message;
        if (dashboardStatus) {
          dashboardStatus.textContent = summary.status.label;
          dashboardStatus.className = statusClass;
        }

        document.querySelector("#balanceSheetAssets").textContent = money(summary.totalAssets);
        document.querySelector("#balanceSheetLiabilities").textContent = money(summary.totalLiabilities);
        document.querySelector("#balanceSheetNetWorth").textContent = money(summary.netWorth);
        document.querySelector("#balanceSheetMessage").textContent = summary.status.message;
        if (sheetStatus) {
          sheetStatus.textContent = summary.status.label;
          sheetStatus.className = statusClass;
        }

        const assetRows = [
          ...state.wallets.map((wallet) => balanceSheetRow(wallet.name, wallet.type || "Dompet", Number(wallet.currentBalance || 0), Number(wallet.currentBalance || 0) < 0 ? "expense-text" : "income-text")),
          ...summary.receivables.map((item) => balanceSheetRow(`Piutang - ${item.person || "Tanpa nama"}`, `${item.description || "Piutang aktif"} - sisa ${money(item.remainingAmount ?? item.amount ?? 0)}`, Number(item.remainingAmount ?? item.amount ?? 0), "income-text")),
          ...state.savings.map((goal) => balanceSheetRow(`Tabungan - ${goal.title || goal.category}`, "Rincian, tidak dihitung ganda sebagai aset", savingsBalance(goal), "income-text")),
        ];
        const liabilityRows = summary.liabilities.map((item) => balanceSheetRow(`Hutang - ${item.person || "Tanpa nama"}`, `${item.description || "Hutang aktif"} - sisa ${money(item.remainingAmount ?? item.amount ?? 0)}`, Number(item.remainingAmount ?? item.amount ?? 0), "expense-text"));

        document.querySelector("#assetBreakdownList").innerHTML = assetRows.length
          ? assetRows.join("")
          : `<div class="empty"><p>Belum ada aset. Tambahkan dompet, saldo, atau piutang aktif.</p></div>`;
        document.querySelector("#liabilityBreakdownList").innerHTML = liabilityRows.length
          ? liabilityRows.join("")
          : `<div class="empty"><p>Belum ada hutang aktif.</p></div>`;
      }

      function trashIcon() {
        return appIcon("trash-2", 18);
      }

      function renderStats() {
        dashboardFeature.renderStats();
      }

      function renderChart() {
        dashboardFeature.renderChart();
      }

      function editIcon() {
        return appIcon("pencil", 17);
      }

      function updateTotalBalanceVisibility(total) {
        dashboardFeature.updateTotalBalanceVisibility(total);
      }

      function transactionDateLabel(dateValue) {
        if (!dateValue) return "-";
        const date = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(date.getTime())) return dateValue;
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "short",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(date);
      }

      function transactionDateTimeLabel(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      }

      function transactionTypeLabel(item) {
        if (item.transactionType === "debt_payment" || item.debtPaymentType === "debt_payment") return "Bayar Hutang";
        if (item.transactionType === "receivable_payment" || item.debtPaymentType === "receivable_payment") return "Terima Piutang";
        return item.type === "income" ? "Pemasukan" : "Pengeluaran";
      }

      function quickRangeMatch(item, range) {
        return dashboardFeature.quickRangeMatch(item, range);
      }

      function renderWalletDetail() {
        walletRenderer.renderDetail();
      }

      function openWalletDetail(walletId) {
        walletRenderer.openDetail(walletId);
      }

      function openTransactionDetail(transactionId) {
        transactionRenderer.openDetail(transactionId);
      }

      function openReceiptPreview(transactionId) {
        transactionRenderer.openReceiptPreview(transactionId);
      }

      function renderTransactions() {
        transactionRenderer.renderTransactions();
      }

      function renderBudgets() {
        budgetRenderer.renderBudgets();
      }

      function savingsRows(limit = null) {
        return savingsRenderer.rows(limit);
      }

      function savingsHistoryRows() {
        return savingsRenderer.historyRows();
      }

      function renderSavings() {
        savingsRenderer.renderSavings();
      }

      function latestVehicleOil(vehicleId) {
        return vehicleRenderer.latestVehicleOil(vehicleId);
      }

      function nearestVehiclePart(vehicleId) {
        return vehicleRenderer.nearestVehiclePart(vehicleId);
      }

      function nearestVehicleService(vehicleId) {
        return vehicleRenderer.nearestVehicleService(vehicleId);
      }

      function vehicleTax(vehicleId) {
        return vehicleRenderer.vehicleTax(vehicleId);
      }

      function oilNextDate(item) {
        return vehicleRenderer.oilNextDate(item);
      }

      function oilNextKm(item) {
        return vehicleRenderer.oilNextKm(item);
      }

      function partNextDate(item) {
        return vehicleRenderer.partNextDate(item);
      }

      function partNextKm(item) {
        return vehicleRenderer.partNextKm(item);
      }

      function vehicleMonthlyTotal(vehicleId = "", month = currentMonthKey()) {
        return vehicleRenderer.vehicleMonthlyTotal(vehicleId, month);
      }

      function vehicleYearTotal(vehicleId = "", year = todayDate().slice(0, 4)) {
        return vehicleRenderer.vehicleYearTotal(vehicleId, year);
      }

      function vehicleBadge(status) {
        return vehicleRenderer.vehicleBadge(status);
      }

      function renderVehicles() {
        vehicleRenderer.renderVehicles();
      }

      function renderWallets() {
        walletRenderer.renderWallets();
      }

      function renderFamilyMembers() {
        accountRenderer.renderFamilyMembers();
      }

      function renderVehicleDashboard() {
        vehicleRenderer.renderVehicleDashboard();
      }

      function renderVehicleList() {
        vehicleRenderer.renderVehicleList();
      }

      function renderVehicleServices() {
        vehicleRenderer.renderVehicleServices();
      }

      function renderVehicleOilChanges() {
        vehicleRenderer.renderVehicleOilChanges();
      }

      function renderVehicleParts() {
        vehicleRenderer.renderVehicleParts();
      }

      function renderVehicleTaxes() {
        vehicleRenderer.renderVehicleTaxes();
      }

      function renderVehicleExpenseFilters() {
        vehicleRenderer.renderVehicleExpenseFilters();
      }

      function renderVehicleExpenses() {
        vehicleRenderer.renderVehicleExpenses();
      }

      function renderInsights() {
        analyticsRenderer.renderInsights();
      }

      function renderActionSummary() {
        analyticsRenderer.renderActionSummary();
      }

      function renderBillReminders() {
        billReminderRenderer.render();
      }

      function renderDebts() {
        debtRenderer.renderDebts();
      }

      function debtPaymentHistoryHtml(debt) {
        return debtRenderer.paymentHistoryHtml(debt);
      }

      function renderMonthOptions() {
        analyticsRenderer.renderMonthOptions();
      }

      function renderCategoryOptions() {
        categories = state.categories?.length ? state.categories : [...defaultCategories];
        const budgetType = document.querySelector("#budgetType")?.value || "expense";
        const budgetParent = document.querySelector("#budgetParent");
        const editingId = document.querySelector("#budgetId")?.value || "";
        if (budgetParent) {
          const parents = activeBudgets(budgetType).filter((budget) => !budget.parentId && budget.id !== editingId);
          budgetParent.innerHTML = `<option value="">Jadikan parent utama</option>${parents.map((budget) => `<option value="${budget.id}">${escapeHtml(budget.name)}</option>`).join("")}`;
        }
      }

      function categoryTree() {
        return window.AppCategoryUtils.buildCategoryTree({
          categories,
          budgets: state.budgets,
        });
      }

      function categorySelectOptions(selectedCategory = "") {
        const options = window.AppCategoryUtils.flattenCategoryTreeForSelect(categoryTree())
          .map((item) => {
            const prefix = item.depth > 0 ? `${"&mdash; ".repeat(item.depth)}` : "";
            return `<option value="${escapeHtml(item.value)}" ${item.value === selectedCategory ? "selected" : ""}>${prefix}${escapeHtml(item.name)}</option>`;
          })
          .join("");
        return options || `<option value="Lainnya" ${selectedCategory === "Lainnya" ? "selected" : ""}>Lainnya</option>`;
      }

      function categoryTreeRows() {
        function row(item, depth = 0, parentName = "") {
          return `
            <article class="debt-item category-tree-item ${depth > 0 ? "category-tree-child" : "category-tree-parent"}" style="--category-depth:${depth}">
              <div>
                <strong>${depth > 0 ? "&mdash; " : ""}${escapeHtml(item.name)}</strong>
                ${depth > 0 ? `<span>Subkategori dari ${escapeHtml(parentName || "kategori utama")}</span>` : `<span>Kategori utama</span>`}
              </div>
              <button class="icon-button" type="button" title="Hapus kategori" data-delete-category="${escapeHtml(item.value)}">
                ${trashIcon()}
              </button>
            </article>
            ${(item.children || []).map((child) => row(child, depth + 1, item.name)).join("")}
          `;
        }
        return categoryTree().map((item) => row(item)).join("");
      }

      function resetBudgetForm(parentId = "") {
        const form = document.querySelector("#budgetForm");
        if (!form) return;
        form.reset();
        document.querySelector("#budgetId").value = "";
        document.querySelector("#budgetPeriod").value = "monthly";
        document.querySelector("#budgetLimit").value = "";
        if (parentId) {
          const parent = budgetById(parentId);
          if (parent) {
            document.querySelector("#budgetType").value = parent.type;
            renderCategoryOptions();
            document.querySelector("#budgetParent").value = parent.id;
            document.querySelector("#budgetName").focus();
            return;
          }
        }
        renderCategoryOptions();
      }

      function editBudgetForm(budgetId) {
        const budget = budgetById(budgetId);
        if (!budget) return;
        document.querySelector("#budgetId").value = budget.id;
        document.querySelector("#budgetName").value = budget.name;
        document.querySelector("#budgetType").value = budget.type;
        document.querySelector("#budgetPeriod").value = budget.period || "monthly";
        renderCategoryOptions();
        document.querySelector("#budgetParent").value = budget.parentId || "";
        document.querySelector("#budgetLimit").value = formatRupiah(budget.budgetLimit ?? budget.limit ?? 0);
        openView("budgets");
        document.querySelector("#budgetName").focus();
      }

      function renderCategoryBreakdown() {
        analyticsRenderer.renderCategoryBreakdown();
      }

      function renderDailyExpenses() {
        analyticsRenderer.renderDailyExpenses();
      }

      function renderBudgetProgress() {
        analyticsRenderer.renderBudgetProgress();
      }

      function renderRecurring() {
        const list = document.querySelector("#recurringList");
        const summary = document.querySelector("#recurringSummary");
        if (!list || !summary) return;
        summary.textContent = state.recurring.length ? `${state.recurring.length} transaksi berulang tersimpan.` : "Belum ada transaksi berulang.";

        if (!state.recurring.length) {
          list.innerHTML = `<div class="empty"><p>Belum ada transaksi berulang.</p></div>`;
          return;
        }

        list.innerHTML = state.recurring.map((item) => `
          <article class="debt-row">
            <div class="debt-row-top">
              <strong>${escapeHtml(item.description)}</strong>
              <span>${money(item.amount)}</span>
            </div>
            <div class="compact-list">
              <span class="pill ${item.type}">${item.type === "income" ? "Pemasukan" : "Pengeluaran"}</span>
              <span class="pill">${escapeHtml(item.category)}</span>
              <span class="pill">${item.frequency === "monthly" ? `Bulanan tanggal ${item.day}` : item.frequency}</span>
              <span class="pill ${item.active ? "income" : "expense"}">${item.active ? "Aktif" : "Nonaktif"}</span>
              <button class="icon-button" type="button" title="Hapus transaksi berulang" data-delete-recurring="${item.id}">
                ${trashIcon()}
              </button>
            </div>
          </article>
        `).join("");
      }

      function normalizeHomeSectionOrder(order) {
        return window.AppDashboard.normalizeHomeSectionOrder(order, defaultHomeSectionOrder);
      }

      function renderDashboardMenuOrder() {
        dashboardFeature.renderMenuOrder();
      }

      function dashboardSectionLabel(section) {
        return window.AppDashboard.sectionLabel(section);
      }

      function renderAccount() {
        accountRenderer.renderAccount();
      }

      function applyDarkMode() {
        document.body.classList.toggle("dark", Boolean(state.settings.darkMode));
      }

      function renderAll() {
        categories = state.categories?.length ? state.categories : [...defaultCategories];
        state.categories = categories;
        ensureVehicleCategory();
        ensureDebtCategory();
        syncCategoriesFromBudgets();
        ensureTransactionWallets();
        recalculateWalletBalances();
        syncDebtPaymentState();
        syncBudgetUsageState();
        renderDashboardMenuOrder();
        applyDarkMode();
        saveState();
        applyLanguage();
        renderCategoryOptions();
        renderWallets();
        renderStats();
        renderNetWorth();
        renderChart();
        renderMonthOptions();
        renderTransactions();
        renderBudgets();
        renderSavings();
        renderWalletDetail();
        renderVehicles();
        renderInsights();
        renderActionSummary();
        renderBillReminders();
        renderDebts();
        renderCategoryBreakdown();
        renderBudgetProgress();
        renderDailyExpenses();
        renderRecurring();
        renderAccount();
      }

      function updateBackButton(view) {
        router.updateBackButton(view);
      }

      function navViewFor(view) {
        return router.navViewFor(view);
      }

      function openView(view, options = {}) {
        router.openView(view, options);
      }

      function goBackView() {
        router.goBackView();
      }

      function openTransactionForm(transactionId = "", options = {}) {
        if (isChildUser()) return requirePrimaryAccount();
        if (!currentUser) {
          requireSignedIn();
          return;
        }
        const editingTransaction = transactionId ? state.transactions.find((item) => item.id === transactionId) : null;
        if (!editingTransaction && isGuest() && guestTransactionAdds >= 3) {
          alert("Mode tamu hanya bisa menambahkan 3 transaksi. Silakan login atau daftar akun untuk melanjutkan.");
          openAuthRequiredModal();
          return;
        }
        if (!state.wallets.length) {
          document.querySelector("#modalTitle").textContent = "Dompet Diperlukan";
          document.querySelector("#modalBody").innerHTML = `
            <div class="form">
              <div class="empty">
                <p>Buat dompet terlebih dahulu sebelum menambahkan transaksi.</p>
                <button class="button primary" type="button" data-open-form="wallet">Tambah Dompet</button>
              </div>
            </div>
          `;
          showModal();
          return;
        }
        ensureDebtCategory();
        document.querySelector("#modalTitle").textContent = editingTransaction ? "Edit Transaksi" : "Tambah Transaksi";
        const selectedType = editingTransaction?.transactionType || editingTransaction?.debtPaymentType || editingTransaction?.type || options.presetType || "expense";
        const selectedCategory = editingTransaction?.category || categories[0] || "Lainnya";
        const selectedBudgetId = editingTransaction?.budgetId || activeBudgets(editingTransaction?.type || selectedType).find((budget) => budget.category === editingTransaction?.category || budget.name === editingTransaction?.category)?.id || "";
        const selectedWallet = editingTransaction?.walletId || defaultWalletId();
        const payableOptions = state.debts
          .filter((debt) => debt.kind === "payable" && (debt.status !== "paid" || debt.id === editingTransaction?.debtId))
          .map((debt) => `<option value="${debt.id}" ${debt.id === editingTransaction?.debtId ? "selected" : ""}>${escapeHtml(debt.person || "Hutang")} - sisa ${money(debtRemainingAmount(debt, { excludeTransactionId: editingTransaction?.id }) + (debt.id === editingTransaction?.debtId ? Number(editingTransaction?.amount || 0) : 0))}</option>`)
          .join("");
        const receivableOptions = state.debts
          .filter((debt) => debt.kind === "receivable" && (debt.status !== "paid" || debt.id === editingTransaction?.receivableId))
          .map((debt) => `<option value="${debt.id}" ${debt.id === editingTransaction?.receivableId ? "selected" : ""}>${escapeHtml(debt.person || "Piutang")} - sisa ${money(debtRemainingAmount(debt, { excludeTransactionId: editingTransaction?.id }) + (debt.id === editingTransaction?.receivableId ? Number(editingTransaction?.amount || 0) : 0))}</option>`)
          .join("");
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="transactionForm">
            <div class="form-grid">
              <div class="field">
                <label for="transactionType">Tipe</label>
                <select id="transactionType" required>
                  <option value="expense" ${selectedType === "expense" ? "selected" : ""}>Pengeluaran</option>
                  <option value="income" ${selectedType === "income" ? "selected" : ""}>Pemasukan</option>
                  <option value="debt_payment" ${selectedType === "debt_payment" ? "selected" : ""}>Bayar Hutang</option>
                  <option value="receivable_payment" ${selectedType === "receivable_payment" ? "selected" : ""}>Terima Piutang</option>
                </select>
              </div>
              <div class="field">
                <label for="transactionDate">Tanggal</label>
                <input id="transactionDate" type="date" value="${editingTransaction?.date || todayDate()}" required />
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="transactionCategory">Kategori</label>
                <select id="transactionCategory">${categorySelectOptions(selectedCategory)}</select>
              </div>
              <div class="field">
                <label for="transactionBudget">Anggaran</label>
                <select id="transactionBudget">
                  <option value="">Tidak terkait anggaran</option>
                </select>
                <p class="field-helper">Pilih sub kategori agar laporan budget lebih detail.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="transactionAmount">Nominal</label>
                ${rupiahInputHtml("transactionAmount", editingTransaction?.amount ?? "", "required")}
              </div>
            </div>
            <div class="field">
              <label for="transactionWallet">Dompet</label>
              <select id="transactionWallet" required>
                <option value="">Pilih dompet</option>
                ${walletOptions(selectedWallet)}
              </select>
            </div>
            <div class="field hidden" id="debtPaymentField">
              <label for="transactionDebt">Hutang yang dibayar</label>
              <select id="transactionDebt">
                <option value="">Pilih hutang aktif</option>
                ${payableOptions}
              </select>
              <p class="field-helper" id="debtPaymentHelper">Pilih hutang untuk melihat sisa.</p>
            </div>
            <div class="field hidden" id="receivablePaymentField">
              <label for="transactionReceivable">Piutang yang diterima</label>
              <select id="transactionReceivable">
                <option value="">Pilih piutang aktif</option>
                ${receivableOptions}
              </select>
              <p class="field-helper" id="receivablePaymentHelper">Pilih piutang untuk melihat sisa.</p>
            </div>
            <div class="field">
              <label for="transactionDescription">Deskripsi (opsional)</label>
              <textarea id="transactionDescription" placeholder="Contoh: belanja mingguan">${escapeHtml(editingTransaction?.description || "")}</textarea>
            </div>
            <p class="form-status hidden" id="transactionStatus"></p>
            <div class="row-actions">
              <label class="remember-row ${editingTransaction ? "hidden" : ""}" for="addAnotherTransaction">
                <input id="addAnotherTransaction" type="checkbox" />
                Tambah Lagi
              </label>
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">${editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi"}</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#transactionAmount");
        const typeInput = document.querySelector("#transactionType");
        const categoryInput = document.querySelector("#transactionCategory");
        const budgetInput = document.querySelector("#transactionBudget");
        const descriptionInput = document.querySelector("#transactionDescription");
        const debtInput = document.querySelector("#transactionDebt");
        const receivableInput = document.querySelector("#transactionReceivable");
        const paymentRemainingFor = (debtId, excludeCurrent = true) => {
          const debt = state.debts.find((item) => item.id === debtId);
          if (!debt) return 0;
          return debtRemainingAmount(debt, { excludeTransactionId: excludeCurrent ? editingTransaction?.id : "" });
        };
        const updatePaymentFields = () => {
          const selected = typeInput.value;
          const isDebtPayment = selected === "debt_payment";
          const isReceivablePayment = selected === "receivable_payment";
          const budgetType = isDebtPayment || isReceivablePayment ? selected : selected === "income" ? "income" : "expense";
          budgetInput.innerHTML = `<option value="">Tidak terkait anggaran</option>${budgetOptions(budgetType, budgetInput.value || selectedBudgetId)}`;
          document.querySelector("#debtPaymentField").classList.toggle("hidden", !isDebtPayment);
          document.querySelector("#receivablePaymentField").classList.toggle("hidden", !isReceivablePayment);
          categoryInput.disabled = isDebtPayment || isReceivablePayment;
          budgetInput.disabled = isDebtPayment || isReceivablePayment;
          if (isDebtPayment) {
            categoryInput.value = categories.includes("Hutang Piutang") ? "Hutang Piutang" : categoryInput.value;
            const debt = state.debts.find((item) => item.id === debtInput.value);
            document.querySelector("#debtPaymentHelper").textContent = debt ? `Sisa hutang: ${money(paymentRemainingFor(debt.id))}` : "Pilih hutang untuk melihat sisa.";
            if (!descriptionInput.value.trim() && debt) descriptionInput.value = `Bayar hutang ${debt.person || ""}`.trim();
          } else if (isReceivablePayment) {
            categoryInput.value = categories.includes("Hutang Piutang") ? "Hutang Piutang" : categoryInput.value;
            const debt = state.debts.find((item) => item.id === receivableInput.value);
            document.querySelector("#receivablePaymentHelper").textContent = debt ? `Sisa piutang: ${money(paymentRemainingFor(debt.id))}` : "Pilih piutang untuk melihat sisa.";
            if (!descriptionInput.value.trim() && debt) descriptionInput.value = `Terima piutang ${debt.person || ""}`.trim();
          }
        };
        budgetInput.addEventListener("change", () => {
          const budget = budgetById(budgetInput.value);
          if (budget && !categoryInput.disabled) categoryInput.value = budget.category || budget.name;
        });
        typeInput.addEventListener("change", updatePaymentFields);
        debtInput.addEventListener("change", updatePaymentFields);
        receivableInput.addEventListener("change", updatePaymentFields);
        updatePaymentFields();
        document.querySelector("#transactionForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!editingTransaction && isGuest() && guestTransactionAdds >= 3) {
            alert("Mode tamu hanya bisa menambahkan 3 transaksi. Silakan login atau daftar akun untuk melanjutkan.");
            closeModal();
            openAuthRequiredModal();
            return;
          }
          const form = event.currentTarget;
          const addAnother = !editingTransaction && document.querySelector("#addAnotherTransaction").checked;
          const status = document.querySelector("#transactionStatus");
          const submitButton = event.submitter || document.querySelector("#transactionForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          status.className = "form-status hidden";
          status.textContent = "";
          const selectedTransactionType = document.querySelector("#transactionType").value;
          const isDebtPayment = selectedTransactionType === "debt_payment";
          const isReceivablePayment = selectedTransactionType === "receivable_payment";
          const relatedDebtId = isDebtPayment ? document.querySelector("#transactionDebt").value : isReceivablePayment ? document.querySelector("#transactionReceivable").value : "";
          const relatedDebt = relatedDebtId ? state.debts.find((debt) => debt.id === relatedDebtId) : null;
          const values = {
            type: isDebtPayment ? "expense" : isReceivablePayment ? "income" : selectedTransactionType,
            transactionType: selectedTransactionType,
            date: document.querySelector("#transactionDate").value,
            category: isDebtPayment || isReceivablePayment ? "Hutang Piutang" : (budgetById(document.querySelector("#transactionBudget").value)?.category || document.querySelector("#transactionCategory").value),
            amount: parseFormattedNumber(document.querySelector("#transactionAmount").value),
            description: document.querySelector("#transactionDescription").value.trim(),
            walletId: document.querySelector("#transactionWallet").value,
            sourceModule: isDebtPayment || isReceivablePayment ? "debts" : editingTransaction?.sourceModule || "manual",
            sourceId: relatedDebtId || editingTransaction?.sourceId || "",
            subcategory: isDebtPayment ? "Bayar Hutang" : isReceivablePayment ? "Terima Piutang" : editingTransaction?.subcategory || "",
            budgetId: isDebtPayment || isReceivablePayment ? "" : document.querySelector("#transactionBudget").value,
            debtId: isDebtPayment ? relatedDebtId : "",
            receivableId: isReceivablePayment ? relatedDebtId : "",
            debtPaymentType: isDebtPayment ? "debt_payment" : isReceivablePayment ? "receivable_payment" : "",
          };
          if (!values.walletId) {
            alert("Dompet wajib dipilih.");
            submitButton.disabled = false;
            submitButton.textContent = editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi";
            return;
          }
          if (values.amount <= 0) {
            alert("Nominal transaksi wajib lebih dari 0.");
            submitButton.disabled = false;
            submitButton.textContent = editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi";
            return;
          }
          if ((isDebtPayment || isReceivablePayment) && !relatedDebt) {
            alert(isDebtPayment ? "Hutang aktif wajib dipilih." : "Piutang aktif wajib dipilih.");
            submitButton.disabled = false;
            submitButton.textContent = editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi";
            return;
          }
          if (relatedDebt) {
            const remaining = debtRemainingAmount(relatedDebt, { excludeTransactionId: editingTransaction?.id });
            if (values.amount > remaining) {
              alert(isDebtPayment ? "Nominal pembayaran tidak boleh melebihi sisa hutang." : "Nominal penerimaan tidak boleh melebihi sisa piutang.");
              submitButton.disabled = false;
              submitButton.textContent = editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi";
              return;
            }
          }
          if (editingTransaction) {
            updateTransactionRecord(editingTransaction, values);
          } else {
            state.transactions.push(transactionRecord(values.type, values.date, values.category, values.description, values.amount, values));
          }
          syncDebtPaymentState();
          if (!editingTransaction && isGuest()) guestTransactionAdds += 1;
          markDataChanged();
          saveState();
          const saved = await flushCloudSave();
          renderAll();
          submitButton.disabled = false;
          submitButton.textContent = editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi";

          if (addAnother && !(isGuest() && guestTransactionAdds >= 3)) {
            form.reset();
            document.querySelector("#transactionDate").value = todayDate();
            document.querySelector("#transactionAmount").value = "";
            document.querySelector("#transactionDescription").value = "";
            updatePaymentFields();
            status.className = saved || !isCloudSyncAllowed() ? "form-status success" : "form-status error";
            status.textContent = saved || !isCloudSyncAllowed()
              ? "Transaksi berhasil disimpan. Silakan tambah transaksi berikutnya."
              : "Transaksi tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.";
            document.querySelector("#transactionAmount").focus();
            return;
          }

          closeModal();
          if (editingTransaction) {
            showSnackbar(saved || !isCloudSyncAllowed() ? "Transaksi berhasil diperbarui." : "Transaksi diperbarui di perangkat, sinkronisasi belum berhasil.", saved || !isCloudSyncAllowed() ? "success" : "error");
          } else if (isGuest() && guestTransactionAdds >= 3) {
            showSnackbar("Transaksi berhasil disimpan.");
            alert("Mode tamu sudah mencapai batas 3 transaksi. Silakan login atau daftar akun untuk melanjutkan.");
            openAuthRequiredModal();
          } else if (!saved && isCloudSyncAllowed()) {
            showSnackbar("Transaksi tersimpan di perangkat, sinkronisasi belum berhasil.", "error");
            alert("Transaksi tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          } else {
            showSnackbar("Transaksi berhasil disimpan.");
          }
        });
      }

      function openDebtForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Hutang Piutang";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="debtForm">
            <div class="form-grid">
              <div class="field">
                <label for="debtKind">Jenis</label>
                <select id="debtKind">
                  <option value="payable">Hutang</option>
                  <option value="receivable">Piutang</option>
                </select>
              </div>
              <div class="field">
                <label for="debtStatus">Status</label>
                <select id="debtStatus">
                  <option value="unpaid">Belum lunas</option>
                  <option value="paid">Lunas</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="debtPerson">Nama orang</label>
              <input id="debtPerson" type="text" required />
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="debtDate">Tanggal</label>
                <input id="debtDate" type="date" value="${todayDate()}" required />
              </div>
              <div class="field">
                <label for="debtDueDate">Jatuh tempo</label>
                <input id="debtDueDate" type="date" />
              </div>
            </div>
            <div class="field">
              <label for="debtAmount">Nominal</label>
              ${rupiahInputHtml("debtAmount", "", "required")}
            </div>
            <div class="field">
              <label for="debtDescription">Deskripsi</label>
              <textarea id="debtDescription" required></textarea>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan Catatan</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#debtAmount");
        document.querySelector("#debtForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#debtForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          const amount = parseFormattedNumber(document.querySelector("#debtAmount").value);
          if (amount <= 0) {
            submitButton.disabled = false;
            submitButton.textContent = "Simpan Catatan";
            return alert("Nominal hutang/piutang wajib lebih dari 0.");
          }
          state.debts.push({
            id: id(),
            kind: document.querySelector("#debtKind").value,
            status: document.querySelector("#debtStatus").value,
            person: document.querySelector("#debtPerson").value.trim(),
            date: document.querySelector("#debtDate").value,
            dueDate: document.querySelector("#debtDueDate").value,
            amount,
            totalAmount: amount,
            paidAmount: document.querySelector("#debtStatus").value === "paid" ? amount : 0,
            remainingAmount: document.querySelector("#debtStatus").value === "paid" ? 0 : amount,
            paymentHistory: [],
            relatedTransactionIds: [],
            description: document.querySelector("#debtDescription").value.trim(),
          });
          syncDebtPaymentState();
          closeModal();
          await persistChanges("Hutang/piutang tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openView("debts");
        });
      }

      function openDebtHistory() {
        if (!requireSignedIn()) return;
        const paidDebts = state.debts
          .filter((item) => item.status === "paid")
          .sort((a, b) => b.date.localeCompare(a.date));
        document.querySelector("#modalTitle").textContent = "Riwayat Hutang Piutang";
        document.querySelector("#modalBody").innerHTML = paidDebts.length
          ? `
            <div class="debt-list">
              ${paidDebts.map((item) => `
                <article class="debt-row">
                  <div class="debt-row-top">
                    <strong>${escapeHtml(item.person)} - ${item.kind === "receivable" ? "Piutang" : "Hutang"}</strong>
                    <span>${money(item.totalAmount ?? item.amount)}</span>
                  </div>
                  <p style="margin-top: 7px; color: var(--muted); font-size: .9rem">${escapeHtml(item.description)}</p>
                  <div class="debt-payment-summary">
                    <span>Total ${money(item.totalAmount ?? item.amount)}</span>
                    <span>${item.kind === "receivable" ? "Sudah diterima" : "Sudah dibayar"} ${money(item.paidAmount || 0)}</span>
                    <span>Sisa ${money(item.remainingAmount || 0)}</span>
                  </div>
                  ${debtPaymentHistoryHtml(item)}
                  <div class="tags" style="display:flex; flex-wrap:wrap; gap:7px; margin-top:10px">
                    <span class="pill debt">Tanggal ${escapeHtml(item.date)}</span>
                    <span class="pill debt">Jatuh tempo ${escapeHtml(item.dueDate || "-")}</span>
                    <span class="pill income">Lunas</span>
                    <button class="icon-button" type="button" title="Kembalikan ke belum lunas" data-toggle-debt="${item.id}">
                      ${appIcon("rotate-ccw", 17)}
                    </button>
                    <button class="icon-button" type="button" title="Hapus hutang piutang" data-delete-debt="${item.id}">
                      ${trashIcon()}
                    </button>
                  </div>
                </article>
              `).join("")}
            </div>
          `
          : `<div class="empty"><p>Belum ada riwayat hutang piutang lunas.</p></div>`;
        showModal();
      }

      function openRecurringForm() {
        if (!requirePrimaryAccount()) return;
        if (!state.wallets.length) return openTransactionForm();
        document.querySelector("#modalTitle").textContent = "Tambah Transaksi Berulang";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="recurringForm">
            <div class="form-grid">
              <div class="field">
                <label for="recurringType">Tipe</label>
                <select id="recurringType">
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </div>
              <div class="field">
                <label for="recurringCategory">Kategori</label>
                <select id="recurringCategory">${categorySelectOptions()}</select>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="recurringAmount">Nominal</label>
                ${rupiahInputHtml("recurringAmount", "", "required")}
              </div>
              <div class="field">
                <label for="recurringDay">Tanggal setiap bulan</label>
                <input id="recurringDay" type="number" min="1" max="28" value="1" required />
              </div>
            </div>
            <div class="field">
              <label for="recurringWallet">Dompet</label>
              <select id="recurringWallet" required>
                <option value="">Pilih dompet</option>
                ${walletOptions(defaultWalletId())}
              </select>
            </div>
            <div class="field">
              <label for="recurringDescription">Deskripsi</label>
              <textarea id="recurringDescription" required></textarea>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#recurringAmount");
        document.querySelector("#recurringForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#recurringForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          const amount = parseFormattedNumber(document.querySelector("#recurringAmount").value);
          if (amount <= 0) {
            submitButton.disabled = false;
            submitButton.textContent = "Simpan";
            return alert("Nominal transaksi berulang wajib lebih dari 0.");
          }
          state.recurring.push({
            id: id(),
            type: document.querySelector("#recurringType").value,
            category: document.querySelector("#recurringCategory").value,
            amount,
            walletId: document.querySelector("#recurringWallet").value,
            day: Number(document.querySelector("#recurringDay").value),
            description: document.querySelector("#recurringDescription").value.trim(),
            frequency: "monthly",
            active: true,
          });
          closeModal();
          await persistChanges("Transaksi berulang tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openView("reports");
        });
      }

      function openReminderForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Pengingat Harian";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="reminderForm">
            <div class="field">
              <label for="reminderEnabled">Status</label>
              <select id="reminderEnabled">
                <option value="true" ${state.settings.reminderEnabled ? "selected" : ""}>Aktif</option>
                <option value="false" ${!state.settings.reminderEnabled ? "selected" : ""}>Nonaktif</option>
              </select>
            </div>
            <div class="field">
              <label for="reminderTime">Jam pengingat</label>
              <input id="reminderTime" type="time" value="${state.settings.reminderTime}" />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#reminderForm").addEventListener("submit", (event) => {
          event.preventDefault();
          state.settings.reminderEnabled = document.querySelector("#reminderEnabled").value === "true";
          state.settings.reminderTime = document.querySelector("#reminderTime").value || "20:00";
          closeModal();
          renderAll();
        });
      }

      const billReminderFormController = window.AppBillReminderForm.createController({
        attachRupiahInput,
        billReminder,
        categorySelectOptions,
        closeModal,
        escapeHtml,
        formatRupiah,
        openView,
        parseFormattedNumber,
        persistChanges,
        requirePrimaryAccount,
        rupiahInputHtml,
        service: billReminderService,
        showModal,
        state,
        todayDate,
      });

      function openBillReminderForm(reminderId = "") {
        billReminderFormController.openBillReminderForm(reminderId);
      }

      const walletFormController = window.AppWalletForm.createController({
        attachRupiahInput,
        closeModal,
        createWallet,
        escapeHtml,
        parseFormattedNumber,
        persistChanges,
        requirePrimaryAccount,
        rupiahInputHtml,
        showModal,
        showSnackbar,
        state,
        updateWallet,
        walletHasDuplicateName,
      });

      function openWalletForm(walletId = "") {
        walletFormController.openWalletForm(walletId);
      }
      function openFamilyMemberForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Anggota Keluarga";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="familyMemberForm">
            <div class="form-grid">
              <div class="field">
                <label for="familyName">Nama anggota</label>
                <input id="familyName" type="text" autocomplete="name" required />
              </div>
              <div class="field">
                <label for="familyEmail">Email</label>
                <input id="familyEmail" type="email" autocomplete="email" required />
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="familyPhone">Nomor HP</label>
                <input id="familyPhone" type="tel" autocomplete="tel" />
              </div>
              <div class="field">
                <label for="familyStatus">Status</label>
                <select id="familyStatus">
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </div>
            <p class="form-status">Anggota keluarga memiliki role child dan hanya bisa melihat data akun utama.</p>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Tambah Anggota</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#familyMemberForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const childName = document.querySelector("#familyName").value.trim();
          const childEmail = document.querySelector("#familyEmail").value.trim().toLowerCase();
          const phone = document.querySelector("#familyPhone").value.trim();
          const status = document.querySelector("#familyStatus").value;
          if (!childName || !childEmail) return alert("Nama dan email anggota wajib diisi.");
          if (childEmail === (currentUser.email || currentUser.username || "").toLowerCase()) return alert("Email anggota tidak boleh sama dengan akun utama.");
          const duplicate = state.familyMembers.some((member) => member.childEmail.toLowerCase() === childEmail);
          if (duplicate) return alert("Anggota keluarga dengan email ini sudah ada.");
          const member = familyMemberRecord({ childName, childEmail, phone, status });
          const cloudResult = await upsertFamilyMemberAccess(member);
          if (!cloudResult.ok) return alert(`${cloudResult.message}\n\nPastikan SQL family_members sudah dijalankan di Supabase.`);
          state.familyMembers.push(member);
          closeModal();
          await persistChanges("Anggota keluarga tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar("Anggota keluarga berhasil ditambahkan.");
        });
      }

      function categoryInUse(category) {
        return state.transactions.some((item) => item.category === category)
          || state.debts.some((item) => item.category === category)
          || state.billReminders.some((item) => item.category === category)
          || state.recurring.some((item) => item.category === category)
          || state.budgets.some((item) => item.category === category);
      }

      function openDashboardMenuForm() {
        if (!requirePrimaryAccount()) return;
        const order = normalizeHomeSectionOrder(state.settings.homeSectionOrder);
        document.querySelector("#modalTitle").textContent = "Urutan Menu Dashboard";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="dashboardMenuForm">
            <div class="field">
              <label>Urutan tampilan dashboard</label>
              <div class="debt-list">
                ${order.map((section, index) => `
                  <article class="debt-item">
                    <div>
                      <strong>${escapeHtml(dashboardSectionLabel(section))}</strong>
                    </div>
                    <div class="row-actions">
                      <button class="button" type="button" data-menu-up="${section}" ${index === 0 ? "disabled" : ""}>${appIcon("chevron-up", 18)}</button>
                      <button class="button" type="button" data-menu-down="${section}" ${index === order.length - 1 ? "disabled" : ""}>${appIcon("chevron-down", 18)}</button>
                    </div>
                  </article>
                `).join("")}
              </div>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan Urutan</button>
            </div>
          </form>
        `;
        showModal();

        const move = (section, direction) => {
          const idx = order.indexOf(section);
          if (idx < 0) return;
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= order.length) return;
          [order[idx], order[target]] = [order[target], order[idx]];
          state.settings.homeSectionOrder = [...order];
          openDashboardMenuForm();
        };

        document.querySelectorAll("[data-menu-up]").forEach((button) => {
          button.addEventListener("click", () => move(button.dataset.menuUp, "up"));
        });
        document.querySelectorAll("[data-menu-down]").forEach((button) => {
          button.addEventListener("click", () => move(button.dataset.menuDown, "down"));
        });

        document.querySelector("#dashboardMenuForm").addEventListener("submit", (event) => {
          event.preventDefault();
          state.settings.homeSectionOrder = [...order];
          closeModal();
          renderAll();
        });
      }

      function openCategoryForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Kelola Kategori";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="categoryForm">
            <div class="field">
              <label>Kategori saat ini</label>
              <div class="debt-list category-tree">
                ${categoryTreeRows() || `<div class="empty">Belum ada kategori.</div>`}
              </div>
            </div>
            <div class="field">
              <label for="categoryName">Kategori baru</label>
              <input id="categoryName" type="text" placeholder="Contoh: Investasi" required />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Tambah Kategori</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#categoryForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const category = document.querySelector("#categoryName").value.trim();
          if (category && !state.categories.includes(category)) {
            state.categories.push(category);
            state.budgets.push({
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
            });
          }
          closeModal();
          renderAll();
        });
      }

      const savingsFormController = window.AppSavingsForm.createController({
        attachRupiahInput,
        closeModal,
        openSavingsDetail: (goalId) => openSavingsDetail(goalId),
        openView,
        parseFormattedNumber,
        persistChanges,
        requirePrimaryAccount,
        rupiahInputHtml,
        saveState,
        savingCategories,
        savingsEntry,
        savingsGoal,
        showModal,
        showSnackbar,
        state,
        todayDate,
        touchSavingsGoal,
      });

      function openSavingsGoalForm(goalId = "") {
        savingsFormController.openSavingsGoalForm(goalId);
      }
      function openSavingsHistory() {
        document.querySelector("#modalTitle").textContent = "Riwayat Tabungan";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <div class="budget-list modal-list">
              ${savingsHistoryRows()}
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Tutup</button>
            </div>
          </div>
        `;
        showModal();
      }

      function openSavingsDetail(goalId) {
        const goal = state.savings.find((item) => item.id === goalId);
        if (!goal) return;
        const balance = savingsBalance(goal);
        const percent = savingsPercent(goal);
        const achieved = isSavingsAchieved(goal);
        document.querySelector("#modalTitle").textContent = goal.title;
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <div class="budget-row">
              <div class="budget-row-top">
                <strong>${money(balance)}</strong>
                <span>${achieved ? "Tercapai" : `Target ${money(goal.target)}`}</span>
              </div>
              <div class="progress"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${percent}% tercapai - Target tanggal ${escapeHtml(goal.targetDate || "-")}</div>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-edit-savings="${goal.id}">Edit Tujuan</button>
              <button class="button danger" type="button" data-delete-savings="${goal.id}">Hapus</button>
              <button class="button danger" type="button" data-savings-entry="withdraw" data-goal-id="${goal.id}">Tarik</button>
              <button class="button primary" type="button" data-savings-entry="deposit" data-goal-id="${goal.id}">Tambah</button>
            </div>
            <div class="settings-list">
              ${(goal.entries || []).length ? [...goal.entries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => `
                <div class="settings-item">
                  <div>
                    <strong>${entry.type === "withdraw" ? "Tarik" : "Tambah"} - ${escapeHtml(entry.date)}</strong>
                    <span>${escapeHtml(entry.note || "-")}</span>
                  </div>
                  <span class="amount ${entry.type === "withdraw" ? "expense" : "income"}">${entry.type === "withdraw" ? "-" : "+"} ${money(entry.amount)}</span>
                </div>
              `).join("") : `<div class="empty"><p>Belum ada setoran.</p></div>`}
            </div>
          </div>
        `;
        showModal();
      }

      function openSavingsEntryForm(goalId, type) {
        savingsFormController.openSavingsEntryForm(goalId, type);
      }
      const vehicleFormController = window.AppVehicleForm.createController({
        addMonths,
        attachRupiahInput,
        closeModal,
        defaultWalletId,
        escapeHtml,
        id,
        openView,
        parseFormattedNumber,
        persistChanges,
        removeVehicleTransaction,
        requirePrimaryAccount,
        rupiahInputHtml,
        showModal,
        state,
        todayDate,
        upsertVehicleTransaction,
        vehicleOptions,
        walletOptions,
      });

      function openVehicleForm(vehicleId = "") {
        vehicleFormController.openVehicleForm(vehicleId);
      }

      function openVehicleServiceForm(recordId = "") {
        vehicleFormController.openVehicleServiceForm(recordId);
      }

      function openVehicleOilForm(recordId = "") {
        vehicleFormController.openVehicleOilForm(recordId);
      }

      function openVehiclePartForm(recordId = "") {
        vehicleFormController.openVehiclePartForm(recordId);
      }

      function openVehicleTaxForm(recordId = "") {
        vehicleFormController.openVehicleTaxForm(recordId);
      }

      function openVehicleExpenseForm() {
        vehicleFormController.openVehicleExpenseForm();
      }
      function openPinForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Atur PIN";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="pinForm">
            <div class="field">
              <label for="pinValue">PIN 4-6 digit</label>
              <input id="pinValue" type="password" inputmode="numeric" minlength="4" maxlength="6" placeholder="1234" />
            </div>
            <div class="row-actions">
              <button class="button danger" type="button" id="clearPinButton">Hapus PIN</button>
              <button class="button primary" type="submit">Simpan PIN</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#pinForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const pin = document.querySelector("#pinValue").value.trim();
          if (!/^[0-9]{4,6}$/.test(pin)) {
            alert("PIN harus 4 sampai 6 digit angka.");
            return;
          }
          state.settings.pin = pin;
          closeModal();
          renderAll();
        });
        document.querySelector("#clearPinButton").addEventListener("click", () => {
          state.settings.pin = "";
          closeModal();
          renderAll();
        });
      }

      function openFeedbackForm() {
        document.querySelector("#modalTitle").textContent = "Kirim Saran";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="feedbackForm">
            <div class="field">
              <label for="feedbackText">Saran</label>
              <textarea id="feedbackText" placeholder="Tulis masukan atau ide fitur" required></textarea>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Kirim</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#feedbackForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const message = document.querySelector("#feedbackText").value.trim();
          closeModal();
          window.location.href = `https://wa.me/6281227709115?text=${encodeURIComponent(message)}`;
        });
      }

      function openMonthlyResetForm() {
        if (!requirePrimaryAccount()) return;
        document.querySelector("#modalTitle").textContent = "Reset Data Bulanan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="monthlyResetForm">
            <details class="form-step" open>
              <summary>1. Pilih bulan</summary>
              <div class="field">
                <label for="resetMonth">Bulan yang direset</label>
                <input id="resetMonth" type="month" value="${currentMonthKey()}" required />
              </div>
            </details>
            <details class="form-step">
              <summary>2. Pilih data</summary>
              <div class="field">
                <label>Jenis data</label>
                <label class="remember-row" for="resetTransactions">
                  <input id="resetTransactions" type="checkbox" checked />
                  Transaksi
                </label>
                <label class="remember-row" for="resetDebts">
                  <input id="resetDebts" type="checkbox" />
                  Hutang piutang
                </label>
                <label class="remember-row" for="resetBills">
                  <input id="resetBills" type="checkbox" />
                  Reminder tagihan
                </label>
                <label class="remember-row" for="resetSavings">
                  <input id="resetSavings" type="checkbox" />
                  Riwayat tabungan
                </label>
              </div>
            </details>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button danger" type="submit">Reset Data</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#monthlyResetForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const month = document.querySelector("#resetMonth").value;
          const resetTransactions = document.querySelector("#resetTransactions").checked;
          const resetDebts = document.querySelector("#resetDebts").checked;
          const resetBills = document.querySelector("#resetBills").checked;
          const resetSavings = document.querySelector("#resetSavings").checked;
          if (!resetTransactions && !resetDebts && !resetBills && !resetSavings) {
            alert("Pilih minimal satu jenis data yang akan direset.");
            return;
          }
          const snapshots = {
            transactions: resetTransactions ? cloneData(state.transactions.filter((item) => monthOf(item) === month)) : [],
            debts: resetDebts ? cloneData(state.debts.filter((item) => item.date?.slice(0, 7) === month || item.dueDate?.slice(0, 7) === month)) : [],
            billReminders: resetBills ? cloneData(state.billReminders.filter((item) => item.dueDate?.slice(0, 7) === month)) : [],
            savings: resetSavings ? cloneData(state.savings) : [],
          };
          const savingsEntryCount = resetSavings
            ? state.savings.reduce((sum, goal) => sum + (goal.entries || []).filter((entry) => monthOf(entry) === month).length, 0)
            : 0;
          const removed = snapshots.transactions.length + snapshots.debts.length + snapshots.billReminders.length + savingsEntryCount;
          await deleteWithUndo({
            confirmMessage: `Reset data bulan ${monthLabel(month)}?`,
            deleteMessage: removed ? `${removed} data bulan ${monthLabel(month)} dihapus.` : `Tidak ada data pada bulan ${monthLabel(month)}.`,
            failedMessage: "Reset bulanan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              snapshots.transactions.forEach((item) => markDeleted("transactions", item.id));
              state.transactions = resetTransactions ? state.transactions.filter((item) => monthOf(item) !== month) : state.transactions;
              snapshots.debts.forEach((item) => markDeleted("debts", item.id));
              state.debts = resetDebts ? state.debts.filter((item) => item.date?.slice(0, 7) !== month && item.dueDate?.slice(0, 7) !== month) : state.debts;
              snapshots.billReminders.forEach((item) => markDeleted("billReminders", item.id));
              state.billReminders = resetBills ? state.billReminders.filter((item) => item.dueDate?.slice(0, 7) !== month) : state.billReminders;
              if (resetSavings) {
                state.savings.forEach((goal) => {
                  goal.entries = (goal.entries || []).filter((entry) => monthOf(entry) !== month);
                });
              }
            },
            undoFn: () => {
              restoreItems("transactions", snapshots.transactions);
              restoreItems("debts", snapshots.debts);
              restoreItems("billReminders", snapshots.billReminders);
              if (resetSavings) state.savings = cloneData(snapshots.savings);
            },
            afterDelete: closeModal,
          });
        });
      }

      function openThanksPopup() {
        document.querySelector("#modalTitle").textContent = "Thanks";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <p style="color: var(--muted); line-height: 1.55">Dukungan kecil sangat berarti untuk pengembangan aplikasi ini.</p>
            <div class="bank-account">
              <div>
                <span class="stat-sub">BCA</span>
                <strong id="modalBcaAccountNumber">899-094-7296</strong>
              </div>
              <button class="button primary" id="modalCopyBcaButton" type="button">Copy</button>
            </div>
          </div>
        `;
        showModal();
        document.querySelector("#modalCopyBcaButton").addEventListener("click", async () => {
          await copyText(document.querySelector("#modalBcaAccountNumber").textContent.trim());
          alert("Nomor rekening BCA berhasil disalin.");
        });
      }

      function openChangelogPopup() {
        const entries = Array.isArray(appMeta.changelog) && appMeta.changelog.length ? appMeta.changelog : [];
        document.querySelector("#modalTitle").textContent = "Riwayat Perubahan";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <div class="changelog-list">
              ${entries.length ? entries.map((entry) => `
                <article class="changelog-entry">
                  <h4>v${escapeHtml(entry.version)} - ${escapeHtml(entry.date)}</h4>
                  ${Object.entries(entry.changes || {}).map(([type, items]) => `
                    <h5>${escapeHtml(type)}</h5>
                    <ul>
                      ${(Array.isArray(items) ? items : []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                    </ul>
                  `).join("")}
                </article>
              `).join("") : `<div class="empty"><p>Belum ada riwayat perubahan.</p></div>`}
            </div>
          </div>
        `;
        showModal();
      }

      function openLicensesPopup() {
        document.querySelector("#modalTitle").textContent = "Open Source Licenses";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <p class="form-status">Dompify dibangun dengan teknologi web open source dan layanan Supabase.</p>
            <div class="compact-list">
              <span class="pill">JavaScript</span>
              <span class="pill">Supabase</span>
              <span class="pill">Netlify</span>
              <span class="pill">Material Design 3</span>
              <span class="pill">Plus Jakarta Sans</span>
            </div>
          </div>
        `;
        showModal();
      }

      async function shareApp() {
        const text = `Coba aplikasi Dompify untuk mencatat pemasukan, pengeluaran, dan mengatur keuangan keluarga: ${appShareUrl}`;
        try {
          if (navigator.share) {
            await navigator.share({
              title: "Dompify",
              text,
              url: appShareUrl,
            });
            showSnackbar("Aplikasi siap dibagikan.");
            return;
          }
          await copyText(appShareUrl);
          showSnackbar("Link aplikasi berhasil disalin");
        } catch (error) {
          if (error?.name === "AbortError") return;
          await copyText(appShareUrl);
          showSnackbar("Link aplikasi berhasil disalin");
        }
      }

      async function copyText(value) {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const input = document.createElement("input");
          input.value = value;
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
      }

      function openAuthRequiredModal() {
        document.querySelector("#modalTitle").textContent = "Login Diperlukan";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <p style="color: var(--muted); line-height: 1.55">Mode tamu hanya untuk mencoba aplikasi. Login atau buat akun terlebih dahulu untuk menyimpan transaksi dan perubahan data.</p>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Nanti</button>
              <button class="button" id="authPromptRegisterButton" type="button">Registrasi</button>
              <button class="button primary" id="authPromptLoginButton" type="button">Login</button>
            </div>
          </div>
        `;
        showModal();
        document.querySelector("#authPromptLoginButton").addEventListener("click", () => {
          closeModal();
          logout();
        });
        document.querySelector("#authPromptRegisterButton").addEventListener("click", () => {
          closeModal();
          logout();
          openRegisterForm();
        });
      }

      function showModal() {
        window.AppModal.show();
      }

      function closeModal() {
        window.AppModal.close();
      }

      function exportCsv() {
        const rows = [
          ["Tanggal", "Kategori", "Subkategori", "Dompet", "Deskripsi", "Tipe", "Nominal", "Sumber", "Source ID", "Dibuat", "Diperbarui"],
          ...state.transactions.map((item) => [
            item.date,
            item.category,
            item.subcategory || "",
            walletName(item.walletId),
            item.description,
            item.type === "income" ? "Pemasukan" : "Pengeluaran",
            item.amount,
            item.sourceModule || "manual",
            item.sourceId || "",
            item.createdAt || "",
            item.updatedAt || "",
          ]),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
        downloadFile(`transaksi-keuangan-${todayDate()}.csv`, csv, "text/csv;charset=utf-8");
      }

      function exportJson() {
        downloadFile(`backup-keuangan-${todayDate()}.json`, JSON.stringify(state, null, 2), "application/json");
      }

      function exportExcel() {
        const table = (title, headers, rows) => `
          <h2>${escapeHtml(title)}</h2>
          <table border="1">
            <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        `;
        const content = `
          <html>
            <head><meta charset="UTF-8" /></head>
            <body>
              ${table("Transaksi", ["Tanggal", "Kategori", "Subkategori", "Dompet", "Deskripsi", "Tipe", "Nominal", "Sumber", "Dibuat", "Diperbarui"], state.transactions.map((item) => [item.date, item.category, item.subcategory || "", walletName(item.walletId), item.description, item.type, item.amount, item.sourceModule || "manual", item.createdAt || "", item.updatedAt || ""]))}
              ${table("Anggaran", ["Nama", "Tipe", "Parent", "Batas", "Periode", "Status"], state.budgets.map((item) => [item.name || item.category, item.type, budgetById(item.parentId)?.name || "", item.budgetLimit ?? item.limit, item.period || "monthly", item.isActive === false ? "Nonaktif" : "Aktif"]))}
              ${table("Hutang Piutang", ["Tanggal", "Jatuh Tempo", "Jenis", "Nama", "Deskripsi", "Nominal", "Status"], state.debts.map((item) => [item.date, item.dueDate, item.kind, item.person, item.description, item.amount, item.status]))}
              ${table("Tabungan", ["Judul", "Kategori", "Target", "Terkumpul", "Target Tanggal"], state.savings.map((item) => [item.title, item.category, item.target, savingsBalance(item), item.targetDate]))}
              ${table("Reminder Tagihan", ["Nama", "Kategori", "Nominal", "Jatuh Tempo", "Catatan", "Status"], state.billReminders.map((item) => [item.title, item.category, item.amount, item.dueDate, item.note, item.status]))}
              ${table("Transaksi Berulang", ["Jenis", "Kategori", "Deskripsi", "Nominal", "Tanggal Bulanan", "Status"], state.recurring.map((item) => [item.type, item.category, item.description, item.amount, item.day, item.active ? "Aktif" : "Nonaktif"]))}
              ${table("Kendaraan", ["Nama", "Merk", "Model", "Tahun", "Plat", "Jenis", "Kilometer"], state.vehicles.map((item) => [item.name, item.brand, item.model, item.year, item.plate, item.type, item.currentKm]))}
              ${table("Service Kendaraan", ["Kendaraan", "Tanggal", "Kilometer", "Jenis", "Bengkel", "Biaya"], state.vehicleServices.map((item) => [vehicleName(item.vehicleId), item.serviceDate, item.serviceKm, item.serviceType, item.workshop, item.cost]))}
              ${table("Ganti Oli", ["Kendaraan", "Terakhir", "KM Terakhir", "KM Berikutnya", "Tanggal Berikutnya", "Biaya"], state.vehicleOilChanges.map((item) => [vehicleName(item.vehicleId), item.lastOilDate, item.lastOilKm, oilNextKm(item), oilNextDate(item), item.cost]))}
              ${table("Part Kendaraan", ["Kendaraan", "Part", "Tanggal", "KM", "Jadwal Berikutnya", "Biaya"], state.vehicleParts.map((item) => [vehicleName(item.vehicleId), item.partName, item.replacementDate, item.replacementKm, partNextDate(item), item.cost]))}
              ${table("Pajak Kendaraan", ["Kendaraan", "Tahunan", "5 Tahunan", "Biaya", "Status", "Tanggal Bayar"], state.vehicleTaxes.map((item) => [vehicleName(item.vehicleId), item.annualDueDate, item.fiveYearDueDate, item.estimatedCost, item.status, item.paidDate]))}
            </body>
          </html>
        `;
        downloadFile(`data-keuangan-${todayDate()}.xls`, content, "application/vnd.ms-excel;charset=utf-8");
      }

      async function applyRecurringThisMonth() {
        const month = currentMonthKey();
        const [, monthNumber] = month.split("-").map(Number);
        const year = Number(month.slice(0, 4));
        const lastDay = new Date(year, monthNumber, 0).getDate();
        let created = 0;

        state.recurring.filter((item) => item.active).forEach((item) => {
          const day = Math.min(Number(item.day || 1), lastDay);
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const exists = state.transactions.some((transaction) => transaction.recurringId === item.id && monthOf(transaction) === month);
          if (exists) return;
          state.transactions.push(transactionRecord(item.type, date, item.category, `${item.description} (berulang)`, Number(item.amount), {
            recurringId: item.id,
            walletId: item.walletId || defaultWalletId(),
            sourceModule: "recurring",
            sourceId: item.id,
          }));
          created += 1;
        });

        await persistChanges("Transaksi berulang sudah diterapkan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        alert(created ? `${created} transaksi berulang diterapkan ke bulan ini.` : "Tidak ada transaksi berulang baru untuk diterapkan.");
      }

      function importJson(event) {
        if (!requirePrimaryAccount()) {
          event.target.value = "";
          return;
        }
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const imported = JSON.parse(reader.result);
            if (!Array.isArray(imported.transactions) || !Array.isArray(imported.budgets) || !Array.isArray(imported.debts)) {
              throw new Error("Format backup tidak sesuai");
            }
            const normalized = normalizeState(imported);
            applyState(normalized);
            renderAll();
            alert("Backup berhasil diimpor.");
          } catch {
            alert("File backup tidak bisa dibaca.");
          }
        };
        reader.readAsText(file);
        event.target.value = "";
      }

      function downloadFile(filename, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      const authController = window.AppAuthController.createController({
        accountService,
        appConfig,
        appIcon,
        applyRememberedLogin,
        applyState,
        authStorageKey,
        clearRememberedLogin,
        clearSyncRetry,
        closeModal,
        cloudSync,
        deletedAccountsKey,
        demoState,
        emptyState,
        getCurrentUser: () => currentUser,
        getHasUnsyncedChanges: () => hasUnsyncedChanges,
        hydrateStoredStateForCurrentUser,
        id,
        isChildUser,
        isCloudSyncAllowed,
        isGuest,
        loadCloudState,
        loadRememberedLogin,
        loadUsers,
        localSplashQuotes,
        openView,
        rememberedLoginKey,
        renderAll,
        replaceState,
        requirePrimaryAccount,
        resetFailedLogin,
        router,
        saveRememberedLogin,
        saveUsers,
        sessionStorageKey,
        setCurrentUser: (user) => {
          currentUser = user;
        },
        setGuestTransactionAdds: (value) => {
          guestTransactionAdds = value;
        },
        setHasUnsyncedChanges: (value) => {
          hasUnsyncedChanges = value;
        },
        setLocalSyncStatus,
        setUsers: (nextUsers) => {
          users = nextUsers;
        },
        setupCloudClient,
        showModal,
        splashReadDelay,
        startCloudRealtimeSync,
        startIdleLogoutTimer,
        state,
        stopCloudRealtimeSync,
        stopIdleLogoutTimer,
        storageKey,
        updateForgotPasswordVisibility,
      });

      async function showApp() {
        return authController.showApp();
      }

      function showLogin() {
        authController.showLogin();
      }

      function showSplash() {
        authController.showSplash();
      }

      async function enterGuestMode() {
        return authController.enterGuestMode();
      }

      function login(username, password) {
        return authController.login(username, password);
      }

      async function loginCloud(email, password) {
        return authController.loginCloud(email, password);
      }

      async function loginWithGoogle() {
        return authController.loginWithGoogle();
      }

      function openResetPasswordRequestForm() {
        authController.openResetPasswordRequestForm();
      }

      function openNewPasswordForm() {
        authController.openNewPasswordForm();
      }

      async function handlePasswordRecoveryLink() {
        return authController.handlePasswordRecoveryLink();
      }

      function openRegisterForm() {
        authController.openRegisterForm();
      }

      async function loadCloudSessionUser() {
        return authController.loadCloudSessionUser();
      }

      async function logout(message = "") {
        return authController.logout(message);
      }

      async function autoLoginRememberedUser() {
        return authController.autoLoginRememberedUser();
      }

      async function deleteCurrentAccount() {
        return authController.deleteCurrentAccount();
      }
      document.querySelector("#todayText").textContent = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date());
      window.AppIcons.hydrate();

      window.AppNavigationEvents.register({ goBackView, openView });

      document.body.addEventListener("pointerdown", (event) => {
        const moneyCalculatorTrigger = event.target.closest("[data-open-money-calculator]");
        if (!moneyCalculatorTrigger) return;
        event.preventDefault();
      });

      document.body.addEventListener("click", async (event) => {
        const moneyCalculatorTrigger = event.target.closest("[data-open-money-calculator]");
        if (moneyCalculatorTrigger) {
          event.preventDefault();
          event.stopPropagation();
          const input = document.getElementById(moneyCalculatorTrigger.dataset.openMoneyCalculator);
          if (input) openMoneyCalculator(input);
          return;
        }

        const moneyKey = event.target.closest("[data-money-key]");
        if (moneyKey) {
          const calculator = document.querySelector("#moneyCalculator");
          const expressionInput = calculator?.querySelector("#moneyCalculatorExpression");
          const status = calculator?.querySelector("#moneyCalculatorStatus");
          const key = moneyKey.dataset.moneyKey;
          if (!calculator || !expressionInput || !status) return;
          status.className = "form-status hidden";
          status.textContent = "";
          if (key === "Batal") {
            closeMoneyCalculator();
            return;
          }
          if (key === "C") {
            expressionInput.value = "";
            updateMoneyCalculatorResult();
            return;
          }
          if (key === "⌫") {
            expressionInput.value = expressionInput.value.slice(0, -1);
            updateMoneyCalculatorResult();
            return;
          }
          if (key === "=" || key === "Gunakan") {
            try {
              const result = calculateMoneyExpression(expressionInput.value);
              expressionInput.value = String(result);
              updateMoneyCalculatorResult();
              if (key === "Gunakan") {
                const target = document.getElementById(calculator.dataset.targetInput);
                if (target) target.value = formatRupiah(result);
                closeMoneyCalculator();
              }
            } catch (error) {
              status.className = "form-status error";
              status.textContent = error.message || "Ekspresi nominal tidak valid.";
            }
            return;
          }
          expressionInput.value += key;
          updateMoneyCalculatorResult();
          return;
        }

        if (event.target.closest("[data-money-cancel]")) {
          closeMoneyCalculator();
          return;
        }

        const opener = event.target.closest("[data-open-form]");
        if (opener?.dataset.openForm === "transaction") openTransactionForm("", { presetType: opener.dataset.transactionPreset || "" });
        if (opener?.dataset.openForm === "debt") openDebtForm();
        if (opener?.dataset.openForm === "recurring") openRecurringForm();
        if (opener?.dataset.openForm === "reminder") openReminderForm();
        if (opener?.dataset.openForm === "billReminder") openBillReminderForm();
        if (opener?.dataset.openForm === "wallet") openWalletForm();
        if (opener?.dataset.openForm === "familyMember") openFamilyMemberForm();
        if (opener?.dataset.openForm === "category") openCategoryForm();
        if (opener?.dataset.openForm === "dashboardMenu") openDashboardMenuForm();
        if (opener?.dataset.openForm === "savingsGoal") openSavingsGoalForm();
        if (opener?.dataset.openForm === "pin") openPinForm();
        if (opener?.dataset.openForm === "feedback") openFeedbackForm();
        if (opener?.dataset.openForm === "thanks") openThanksPopup();
        if (opener?.dataset.openForm === "changelog") openChangelogPopup();
        if (opener?.dataset.openForm === "licenses") openLicensesPopup();
        if (opener?.dataset.openForm === "monthlyReset") openMonthlyResetForm();
        if (opener?.dataset.openForm === "vehicle") openVehicleForm();
        if (opener?.dataset.openForm === "vehicleService") openVehicleServiceForm();
        if (opener?.dataset.openForm === "vehicleOil") openVehicleOilForm();
        if (opener?.dataset.openForm === "vehiclePart") openVehiclePartForm();
        if (opener?.dataset.openForm === "vehicleTax") openVehicleTaxForm();
        if (opener?.dataset.openForm === "vehicleExpense") openVehicleExpenseForm();

        const passwordToggle = event.target.closest("[data-toggle-password]");
        if (passwordToggle) {
          const input = document.querySelector(`#${passwordToggle.dataset.togglePassword}`);
          const visible = input.type === "text";
          input.type = visible ? "password" : "text";
          passwordToggle.setAttribute("aria-label", visible ? "Tampilkan password" : "Sembunyikan password");
          passwordToggle.innerHTML = appIcon(visible ? "eye" : "eye-off", 19);
        }

        if (event.target.closest("[data-close-modal]")) closeModal();

        const rangeButton = event.target.closest("[data-quick-range]");
        if (rangeButton) {
          quickTransactionRange = rangeButton.dataset.quickRange;
          document.querySelectorAll("[data-quick-range]").forEach((button) => button.classList.toggle("active", button === rangeButton));
          renderTransactions();
          return;
        }

        const typeTab = event.target.closest("[data-transaction-type-tab]");
        if (typeTab) {
          const select = document.querySelector("#typeFilter");
          if (select) select.value = typeTab.dataset.transactionTypeTab;
          document.querySelectorAll("[data-transaction-type-tab]").forEach((button) => button.classList.toggle("active", button === typeTab));
          renderTransactions();
          return;
        }

        const vehicleTab = event.target.closest("[data-vehicle-tab]");
        if (vehicleTab) {
          const targetSection = vehicleTab.dataset.vehicleTab;
          document.querySelectorAll("[data-vehicle-tab]").forEach((button) => {
            button.classList.toggle("active", button === vehicleTab);
          });
          document.querySelectorAll("[data-vehicle-section]").forEach((section) => {
            section.classList.toggle("active", section.dataset.vehicleSection === targetSection);
          });
          return;
        }

        const categoryChip = event.target.closest("[data-category-filter]");
        if (categoryChip) {
          selectedCategoryFilter = categoryChip.dataset.categoryFilter;
          renderTransactions();
          return;
        }

        const syncShortcut = event.target.closest("[data-sync-shortcut]");
        if (syncShortcut) {
          if (!requireSignedIn()) return;
          if (!isCloudSyncAllowed()) {
            showSnackbar("Sinkronisasi cloud sedang nonaktif.", "error");
            return;
          }
          const synced = await syncCloudState();
          showSnackbar(synced ? "Data berhasil disinkronkan." : "Cloud belum bisa disinkronkan.", synced ? "success" : "error");
          return;
        }

        const insightCategory = event.target.closest("[data-insight-category]");
        if (insightCategory) {
          selectedCategoryFilter = insightCategory.dataset.insightCategory;
          quickTransactionRange = "month";
          document.querySelector("#typeFilter").value = "expense";
          document.querySelectorAll("[data-transaction-type-tab]").forEach((button) => button.classList.toggle("active", button.dataset.transactionTypeTab === "expense"));
          openView("reports");
          renderTransactions();
          return;
        }

        const budgetProgressButton = event.target.closest("[data-budget-progress-id]");
        if (budgetProgressButton) {
          analyticsRenderer.openBudgetProgressDetail(budgetProgressButton.dataset.budgetProgressId);
          return;
        }

        if (event.target.closest("[data-budget-progress-create]")) {
          openView("budgets");
          document.querySelector("#budgetName")?.focus();
          return;
        }

        const familyToggleButton = event.target.closest("[data-toggle-family-member]");
        if (familyToggleButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.familyMembers.find((member) => member.id === familyToggleButton.dataset.toggleFamilyMember);
          if (!target) return;
          const previousStatus = target.status;
          target.status = target.status === "active" ? "inactive" : "active";
          target.updatedAt = new Date().toISOString();
          const cloudResult = await upsertFamilyMemberAccess(target);
          if (!cloudResult.ok) {
            target.status = previousStatus;
            return alert(cloudResult.message);
          }
          await persistChanges("Status anggota keluarga tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar(target.status === "active" ? "Akses anggota keluarga diaktifkan." : "Akses anggota keluarga dinonaktifkan.");
          return;
        }

        const familyDeleteButton = event.target.closest("[data-delete-family-member]");
        if (familyDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.familyMembers.find((member) => member.id === familyDeleteButton.dataset.deleteFamilyMember);
          if (!target) return;
          if (!confirm(`Hapus akses "${target.childEmail}"?`)) return;
          const cloudResult = await deleteFamilyMemberAccess(target);
          if (!cloudResult.ok) return alert(cloudResult.message);
          markDeleted("familyMembers", target.id);
          state.familyMembers = state.familyMembers.filter((member) => member.id !== target.id);
          await persistChanges("Akses anggota keluarga sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar("Akses anggota keluarga dihapus.");
          return;
        }

        const walletEditButton = event.target.closest("[data-edit-wallet]");
        if (walletEditButton) {
          if (!requirePrimaryAccount()) return;
          openWalletForm(walletEditButton.dataset.editWallet);
          return;
        }

        const walletDeleteButton = event.target.closest("[data-delete-wallet]");
        if (walletDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.wallets.find((wallet) => wallet.id === walletDeleteButton.dataset.deleteWallet);
          if (!target) return;
          const blockedReason = walletDeleteBlockReason(target.id);
          if (blockedReason) {
            alert(blockedReason);
            return;
          }
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus dompet "${target.name}"?`,
            deleteMessage: "Dompet dihapus.",
            failedMessage: "Dompet sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              deleteWallet(target.id);
            },
            undoFn: () => restoreItems("wallets", snapshot),
          });
          return;
        }

        const walletDetailCard = event.target.closest("[data-open-wallet-detail]");
        if (walletDetailCard && !event.target.closest("button")) {
          openWalletDetail(walletDetailCard.dataset.openWalletDetail);
          return;
        }

        const editButton = event.target.closest("[data-edit-transaction]");
        if (editButton) {
          if (!requirePrimaryAccount()) return;
          openTransactionForm(editButton.dataset.editTransaction);
          return;
        }

        const deleteButton = event.target.closest("[data-delete-transaction]");
        if (deleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.transactions.find((item) => item.id === deleteButton.dataset.deleteTransaction);
          if (!target) return;
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus transaksi "${target.description || target.category}"?`,
            deleteMessage: "Transaksi dihapus.",
            failedMessage: "Transaksi sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("transactions", target.id);
              state.transactions = state.transactions.filter((item) => item.id !== target.id);
            },
            undoFn: () => restoreItems("transactions", snapshot),
            afterDelete: () => {
              if (document.querySelector("#transactionDetailView")) closeModal();
            },
          });
          return;
        }

        const transactionDetailRow = event.target.closest("[data-open-transaction-detail]");
        if (transactionDetailRow) {
          openTransactionDetail(transactionDetailRow.dataset.openTransactionDetail);
          return;
        }

        const savingsDeleteButton = event.target.closest("[data-delete-savings]");
        if (savingsDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.savings.find((item) => item.id === savingsDeleteButton.dataset.deleteSavings);
          if (!target) return;
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus tabungan "${target.title}"?`,
            deleteMessage: "Tabungan dihapus.",
            failedMessage: "Tabungan sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("savings", target.id);
              state.savings = state.savings.filter((item) => item.id !== target.id);
            },
            undoFn: () => restoreItems("savings", snapshot),
            afterDelete: closeModal,
          });
          return;
        }

        const savingsCard = event.target.closest("[data-open-savings]");
        if (savingsCard) {
          openSavingsDetail(savingsCard.dataset.openSavings);
        }

        const savingsEditButton = event.target.closest("[data-edit-savings]");
        if (savingsEditButton) {
          if (!requirePrimaryAccount()) return;
          openSavingsGoalForm(savingsEditButton.dataset.editSavings);
          return;
        }

        const savingsEntryButton = event.target.closest("[data-savings-entry]");
        if (savingsEntryButton) {
          openSavingsEntryForm(savingsEntryButton.dataset.goalId, savingsEntryButton.dataset.savingsEntry);
        }

        const vehicleEditButton = event.target.closest("[data-edit-vehicle]");
        if (vehicleEditButton) {
          if (!requirePrimaryAccount()) return;
          openVehicleForm(vehicleEditButton.dataset.editVehicle);
          return;
        }

        const vehicleDeleteButton = event.target.closest("[data-delete-vehicle]");
        if (vehicleDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.vehicles.find((item) => item.id === vehicleDeleteButton.dataset.deleteVehicle);
          if (!target) return;
          const relatedCount = state.vehicleServices.filter((item) => item.vehicleId === target.id).length
            + state.vehicleOilChanges.filter((item) => item.vehicleId === target.id).length
            + state.vehicleParts.filter((item) => item.vehicleId === target.id).length
            + state.vehicleTaxes.filter((item) => item.vehicleId === target.id).length
            + vehicleTransactions().filter((item) => item.vehicleId === target.id).length;
          const related = {
            vehicle: cloneData(target),
            vehicleServices: cloneData(state.vehicleServices.filter((item) => item.vehicleId === target.id)),
            vehicleOilChanges: cloneData(state.vehicleOilChanges.filter((item) => item.vehicleId === target.id)),
            vehicleParts: cloneData(state.vehicleParts.filter((item) => item.vehicleId === target.id)),
            vehicleTaxes: cloneData(state.vehicleTaxes.filter((item) => item.vehicleId === target.id)),
            transactions: cloneData(vehicleTransactions().filter((item) => item.vehicleId === target.id)),
          };
          await deleteWithUndo({
            confirmMessage: `Hapus kendaraan "${target.name}"${relatedCount ? " beserta data terkaitnya" : ""}?`,
            deleteMessage: "Data kendaraan dihapus.",
            failedMessage: "Data kendaraan sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("vehicles", target.id);
              state.vehicles = state.vehicles.filter((item) => item.id !== target.id);
              for (const collection of ["vehicleServices", "vehicleOilChanges", "vehicleParts", "vehicleTaxes"]) {
                state[collection].filter((item) => item.vehicleId === target.id).forEach((item) => {
                  markDeleted(collection, item.id);
                  removeVehicleTransaction(item);
                });
                state[collection] = state[collection].filter((item) => item.vehicleId !== target.id);
              }
              vehicleTransactions().filter((item) => item.vehicleId === target.id).forEach((item) => markDeleted("transactions", item.id));
              state.transactions = state.transactions.filter((item) => item.vehicleId !== target.id);
            },
            undoFn: () => {
              restoreItems("vehicles", related.vehicle);
              restoreItems("vehicleServices", related.vehicleServices);
              restoreItems("vehicleOilChanges", related.vehicleOilChanges);
              restoreItems("vehicleParts", related.vehicleParts);
              restoreItems("vehicleTaxes", related.vehicleTaxes);
              restoreItems("transactions", related.transactions);
            },
          });
          return;
        }

        const vehicleRecordDeleteButton = event.target.closest("[data-delete-vehicle-record]");
        if (vehicleRecordDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const collection = vehicleRecordDeleteButton.dataset.deleteVehicleRecord;
          const target = state[collection]?.find((item) => item.id === vehicleRecordDeleteButton.dataset.recordId);
          if (!target) return;
          const snapshot = cloneData(target);
          const transactionSnapshot = target.transactionId
            ? cloneData(state.transactions.find((item) => item.id === target.transactionId))
            : null;
          await deleteWithUndo({
            confirmMessage: "Hapus data kendaraan ini dan transaksi terkaitnya?",
            deleteMessage: "Data kendaraan dihapus.",
            failedMessage: "Data kendaraan sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted(collection, target.id);
              removeVehicleTransaction(target);
              state[collection] = state[collection].filter((item) => item.id !== target.id);
            },
            undoFn: () => {
              restoreItems(collection, snapshot);
              if (transactionSnapshot) restoreItems("transactions", transactionSnapshot);
            },
          });
          return;
        }

        const vehicleRecordEditButton = event.target.closest("[data-edit-vehicle-record]");
        if (vehicleRecordEditButton) {
          if (!requirePrimaryAccount()) return;
          const collection = vehicleRecordEditButton.dataset.editVehicleRecord;
          const recordId = vehicleRecordEditButton.dataset.recordId;
          if (collection === "vehicleServices") openVehicleServiceForm(recordId);
          if (collection === "vehicleOilChanges") openVehicleOilForm(recordId);
          if (collection === "vehicleParts") openVehiclePartForm(recordId);
          if (collection === "vehicleTaxes") openVehicleTaxForm(recordId);
          return;
        }

        const addSubBudgetButton = event.target.closest("[data-add-sub-budget]");
        if (addSubBudgetButton) {
          if (!requirePrimaryAccount()) return;
          resetBudgetForm(addSubBudgetButton.dataset.addSubBudget);
          openView("budgets");
          return;
        }

        const editBudgetButton = event.target.closest("[data-edit-budget]");
        if (editBudgetButton) {
          if (!requirePrimaryAccount()) return;
          editBudgetForm(editBudgetButton.dataset.editBudget);
          return;
        }

        const deleteBudgetButton = event.target.closest("[data-delete-budget]");
        if (deleteBudgetButton) {
          if (!requirePrimaryAccount()) return;
          const target = budgetById(deleteBudgetButton.dataset.deleteBudget);
          if (!target) return;
          const children = state.budgets.filter((budget) => budget.parentId === target.id);
          const used = state.transactions.some((item) => item.budgetId === target.id || (!item.budgetId && item.category === (target.category || target.name)));
          if (!confirm(`Hapus anggaran "${target.name}"?`)) return;
          if (used || children.length) {
            const timestamp = new Date().toISOString();
            [target, ...children].forEach((budget) => {
              budget.isActive = false;
              budget.updatedAt = timestamp;
            });
          } else {
            markDeleted("budgets", target.id);
            state.budgets = state.budgets.filter((budget) => budget.id !== target.id);
          }
          await persistChanges("Anggaran dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          return;
        }

        const categoryDeleteButton = event.target.closest("[data-delete-category]");
        if (categoryDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const category = categoryDeleteButton.dataset.deleteCategory;
          if (!category) return;
          if (state.categories.length <= 1) {
            alert("Kategori minimal harus tersisa 1.");
            return;
          }
          if (categoryInUse(category)) {
            alert("Kategori tidak bisa dihapus karena masih digunakan pada data transaksi/anggaran lainnya.");
            return;
          }
          if (!confirm(`Hapus kategori "${category}"?`)) return;
          state.categories = state.categories.filter((item) => item !== category);
          categories = state.categories;
          state.budgets = state.budgets.filter((item) => item.category !== category);
          openCategoryForm();
          renderAll();
        }

        const debtButton = event.target.closest("[data-toggle-debt]");
        if (debtButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.debts.find((item) => item.id === debtButton.dataset.toggleDebt);
          if (target) {
            if (debtPaymentTransactions(target.id).length) {
              alert("Status hutang/piutang ini mengikuti riwayat pembayaran transaksi.");
              return;
            }
            const totalAmount = Number(target.totalAmount ?? target.amount ?? 0);
            const nextPaid = target.status !== "paid";
            target.status = nextPaid ? "paid" : "unpaid";
            target.paidAmount = nextPaid ? totalAmount : 0;
            target.remainingAmount = nextPaid ? 0 : totalAmount;
            target.relatedTransactionIds = nextPaid ? [] : target.relatedTransactionIds || [];
            target.paymentHistory = nextPaid ? [] : target.paymentHistory || [];
            closeModal();
            await persistChanges();
          }
        }

        const debtDeleteButton = event.target.closest("[data-delete-debt]");
        if (debtDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.debts.find((item) => item.id === debtDeleteButton.dataset.deleteDebt);
          if (!target) return;
          const snapshot = cloneData(target);
          const relatedTransactions = cloneData(debtPaymentTransactions(target.id));
          await deleteWithUndo({
            confirmMessage: `Hapus catatan "${target.person}"${relatedTransactions.length ? " beserta transaksi pembayarannya" : ""}?`,
            deleteMessage: "Hutang/piutang dihapus.",
            failedMessage: "Hutang/piutang sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("debts", target.id);
              relatedTransactions.forEach((transaction) => markDeleted("transactions", transaction.id));
              state.debts = state.debts.filter((item) => item.id !== target.id);
              state.transactions = state.transactions.filter((transaction) => transactionPaymentDebtId(transaction) !== target.id);
            },
            undoFn: () => {
              restoreItems("debts", snapshot);
              restoreItems("transactions", relatedTransactions);
            },
            afterDelete: closeModal,
          });
        }

        const billToggleButton = event.target.closest("[data-toggle-bill]");
        if (billToggleButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.billReminders.find((item) => item.id === billToggleButton.dataset.toggleBill);
          if (target) {
            target.status = target.status === "paid" ? "unpaid" : "paid";
            await persistChanges();
          }
        }

        const billEditButton = event.target.closest("[data-edit-bill]");
        if (billEditButton) {
          if (!requirePrimaryAccount()) return;
          openBillReminderForm(billEditButton.dataset.editBill);
          return;
        }

        const billDeleteButton = event.target.closest("[data-delete-bill]");
        if (billDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.billReminders.find((item) => item.id === billDeleteButton.dataset.deleteBill);
          if (!target) return;
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus reminder tagihan "${target.title}"?`,
            deleteMessage: "Reminder tagihan dihapus.",
            deleteFn: () => {
              markDeleted("billReminders", target.id);
              state.billReminders = state.billReminders.filter((item) => item.id !== target.id);
            },
            undoFn: () => restoreItems("billReminders", snapshot),
          });
        }

        const recurringDeleteButton = event.target.closest("[data-delete-recurring]");
        if (recurringDeleteButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.recurring.find((item) => item.id === recurringDeleteButton.dataset.deleteRecurring);
          if (!target) return;
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus transaksi berulang "${target.description}"?`,
            deleteMessage: "Transaksi berulang dihapus.",
            failedMessage: "Transaksi berulang sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("recurring", target.id);
              state.recurring = state.recurring.filter((item) => item.id !== target.id);
            },
            undoFn: () => restoreItems("recurring", snapshot),
          });
        }

        const previewReceiptButton = event.target.closest("[data-preview-receipt]");
        if (previewReceiptButton) {
          openReceiptPreview(previewReceiptButton.dataset.previewReceipt);
          return;
        }

        const deleteReceiptButton = event.target.closest("[data-delete-receipt]");
        if (deleteReceiptButton) {
          if (!requirePrimaryAccount()) return;
          const target = state.transactions.find((item) => item.id === deleteReceiptButton.dataset.deleteReceipt);
          if (!target) return;
          if (!confirm("Hapus foto struk dari transaksi ini?")) return;
          delete target.receiptImage;
          delete target.receiptUrl;
          delete target.strukUrl;
          target.updatedAt = new Date().toISOString();
          await persistChanges("Foto struk dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar("Foto struk berhasil dihapus.");
          openTransactionDetail(target.id);
          return;
        }
      });

      document.body.addEventListener("change", (event) => {
        const input = event.target.closest("[data-receipt-transaction]");
        if (!input || !input.files?.[0]) return;
        if (!requirePrimaryAccount()) return;
        const target = state.transactions.find((item) => item.id === input.dataset.receiptTransaction);
        if (!target) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = async () => {
          target.receiptImage = String(reader.result || "");
          target.updatedAt = new Date().toISOString();
          await persistChanges("Foto struk tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar("Foto struk berhasil disimpan.");
          openTransactionDetail(target.id);
        };
        reader.readAsDataURL(file);
      });

      window.AppModalEvents.register({ closeModal, updateMoneyCalculatorResult });
      window.AppAuthEvents.register({
        clearRememberedLogin,
        cloudSync,
        enterGuestMode,
        login,
        loginCloud,
        loginWithGoogle,
        openRegisterForm,
        openResetPasswordRequestForm,
        recordFailedLogin,
        resetFailedLogin,
        saveRememberedLogin,
        showApp,
        showLogin,
      });
      document.querySelector("#budgetType").addEventListener("change", () => {
        const parent = document.querySelector("#budgetParent");
        renderCategoryOptions();
        if (parent) parent.value = "";
      });

      document.querySelector("#resetBudgetFormButton").addEventListener("click", () => resetBudgetForm());
      attachRupiahInput("#budgetLimit");

      document.querySelector("#budgetForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!requirePrimaryAccount()) return;
        const editingId = document.querySelector("#budgetId").value;
        const name = document.querySelector("#budgetName").value.trim();
        const type = document.querySelector("#budgetType").value;
        const parentId = document.querySelector("#budgetParent").value || null;
        const limit = parseFormattedNumber(document.querySelector("#budgetLimit").value);
        const parent = parentId ? budgetById(parentId) : null;
        if (!name) return alert("Nama anggaran wajib diisi.");
        if (Number.isNaN(limit) || limit < 0) return alert("Limit budget harus angka valid.");
        if (parent && parent.type !== type) return alert("Sub kategori harus mengikuti tipe parent.");
        if (budgetHasCircularParent(editingId, parentId)) return alert("Parent tidak valid karena membuat relasi melingkar.");
        if (!validateSubBudgetLimit({ parentId, budgetLimit: limit, editingId })) {
          return alert("Total budget sub kategori melebihi budget parent.");
        }
        const timestamp = new Date().toISOString();
        const existing = editingId ? budgetById(editingId) : null;
        if (existing) {
          existing.name = name;
          existing.category = name;
          existing.type = type;
          existing.parentId = parentId;
          existing.budgetLimit = limit;
          existing.limit = limit;
          existing.period = document.querySelector("#budgetPeriod").value;
          existing.updatedAt = timestamp;
        } else {
          state.budgets.push({
            id: id(),
            userId: currentUser?.id || "",
            name,
            category: name,
            type,
            parentId,
            budgetLimit: limit,
            limit,
            usedAmount: 0,
            remainingAmount: limit,
            period: document.querySelector("#budgetPeriod").value,
            icon: "",
            color: "",
            isActive: true,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
        syncCategoriesFromBudgets();
        resetBudgetForm();
        await persistChanges("Anggaran tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
      });

      window.AppFilterEvents.register({
        renderBudgetProgress,
        renderCategoryBreakdown,
        renderDailyExpenses,
        renderTransactions,
        renderVehicleExpenses,
        renderWalletDetail,
        setQuickTransactionRange: (value) => {
          quickTransactionRange = value;
        },
      });
      window.AppAccountEvents.register({
        applyRecurringThisMonth,
        applyState,
        cloudSync,
        copyText,
        deleteCurrentAccount,
        demoState,
        exportCsv,
        exportExcel,
        exportJson,
        getCategories: () => categories,
        getCurrentUser: () => currentUser,
        getHasUnsyncedChanges: () => hasUnsyncedChanges,
        getState: () => state,
        id,
        importJson,
        isCloudSyncAllowed,
        isGuest,
        loadCloudState,
        logout,
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
        setGuestTransactionAdds: (value) => {
          guestTransactionAdds = value;
        },
        setHasUnsyncedChanges: (value) => {
          hasUnsyncedChanges = value;
        },
        setLocalSyncStatus,
        setShowAllDailyExpenses: (value) => {
          showAllDailyExpenses = value;
        },
        shareApp,
        showSnackbar,
        startCloudRealtimeSync,
        stopCloudRealtimeSync,
        syncCloudState,
      });

      window.AppMain.createBootstrap({
        applyDarkMode,
        autoLoginRememberedUser,
        cloudSync,
        currentUser: () => currentUser,
        getDeferredInstallPrompt: () => deferredInstallPrompt,
        handlePasswordRecoveryLink,
        loadCloudSessionUser,
        loadUsers,
        openNewPasswordForm,
        setCurrentUser: (user) => {
          currentUser = user;
        },
        setDeferredInstallPrompt: (prompt) => {
          deferredInstallPrompt = prompt;
        },
        setupCloudClient,
        showApp,
        showSplash,
      }).start();
