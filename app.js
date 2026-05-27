      const {
        storageKey,
        authStorageKey,
        sessionStorageKey,
        rememberedLoginKey,
        failedLoginKey,
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
          "account.exportExcel": "Export data to Excel",
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
          "account.exportExcel": "Export data to Excel",
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
          budgets: ["Anggaran", "Atur batas pengeluaran dan pantau hutang piutang."],
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
          budgets: ["Budget", "Set spending limits and monitor debts."],
          wallets: ["Wallets", "Manage Cash, Bank, E-Wallet, and other money sources."],
          walletDetail: ["Wallet Detail", "Review balance and transaction mutations for the selected wallet."],
          balanceSheet: ["Balance Sheet", "Review total assets, liabilities, and family net worth."],
          vehicles: ["Vehicles", "Track service, oil, parts, taxes, and vehicle costs."],
          account: ["Account", "Manage profile, access, exports, and app settings."],
          thanks: ["Thanks", "Support app development through the available bank account."],
          savings: ["Savings", "Manage savings goals and progress."],
        },
      };

      const state = loadState();
      let categories = state.categories?.length ? state.categories : [...defaultCategories];
      state.categories = categories;
      const defaultHomeSectionOrder = ["wallets", "insight", "latestTransactions"];
      state.settings.homeSectionOrder = normalizeHomeSectionOrder(state.settings?.homeSectionOrder);
      let users = window.AppAuth.loadUsers(authStorageKey);
      let currentUser = loadSessionUser();
      let guestTransactionAdds = 0;
      let snackbarTimer = null;
      let hasUnsyncedChanges = state.syncStatus === "pending" || state.syncStatus === "failed";
      let quickTransactionRange = "month";
      let selectedCategoryFilter = "all";
      let showAllDailyExpenses = false;
      let viewHistory = [];
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
        return window.AppAuth.loadUsers(authStorageKey);
      }

      function saveUsers(nextUsers) {
        users = nextUsers;
        window.AppAuth.saveUsers(authStorageKey, users);
      }

      function showSnackbar(message, tone = "success", action = null) {
        const snackbar = document.querySelector("#snackbar");
        if (!snackbar) return;
        snackbar.innerHTML = "";
        const text = document.createElement("span");
        text.textContent = message;
        snackbar.appendChild(text);
        if (action?.label && typeof action.onClick === "function") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "snackbar-action";
          button.textContent = action.label;
          button.addEventListener("click", async () => {
            clearTimeout(snackbarTimer);
            snackbar.className = "snackbar";
            await action.onClick();
          }, { once: true });
          snackbar.appendChild(button);
        }
        snackbar.className = `snackbar show ${tone === "error" ? "error" : ""}`;
        clearTimeout(snackbarTimer);
        snackbarTimer = setTimeout(() => {
          snackbar.className = "snackbar";
        }, action ? 6000 : 3200);
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

      function activeView() {
        return document.querySelector(".view.active")?.id?.replace("View", "") || "home";
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
        const input = typeof selector === "string" ? document.querySelector(selector) : selector;
        if (!input || input.dataset.moneyInputAttached === "true") return;
        input.dataset.moneyInputAttached = "true";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.value = formatRupiah(input.value);
        input.addEventListener("input", () => {
          input.value = formatRupiah(input.value);
        });
      }

      function attachRupiahInputs(selectors = []) {
        selectors.forEach((selector) => attachRupiahInput(selector));
      }

      function rupiahInputHtml(id, value = "", attributes = "") {
        const formattedValue = value === "" || value === null || value === undefined ? "" : formatRupiah(value);
        return `
          <div class="money-input">
            <div class="currency-input">
              <input id="${id}" type="text" inputmode="numeric" autocomplete="off" value="${formattedValue}" placeholder="Rp0" ${attributes} />
            </div>
            <button class="money-calculator-link" type="button" data-open-money-calculator="${id}">Gunakan Kalkulator</button>
          </div>
        `;
      }

      function calculateMoneyExpression(expression) {
        const normalized = String(expression || "")
          .replace(/[xX×]/g, "*")
          .replace(/[÷:]/g, "/")
          .replace(/rp/gi, "")
          .replace(/\./g, "")
          .replace(/,/g, "");
        if (!/^[\d+\-*/()\s]+$/.test(normalized)) throw new Error("Ekspresi hanya boleh berisi angka dan operator.");
        if (!/\d/.test(normalized)) return 0;
        if (/\/\s*0+(?!\d)/.test(normalized)) throw new Error("Pembagian dengan 0 tidak diizinkan.");
        const result = Function(`"use strict"; return (${normalized});`)();
        if (!Number.isFinite(result)) throw new Error("Ekspresi tidak valid.");
        if (result < 0) throw new Error("Hasil negatif tidak diizinkan untuk nominal ini.");
        return Math.round(result);
      }

      function ensureMoneyCalculator() {
        let calculator = document.querySelector("#moneyCalculator");
        if (calculator) return calculator;
        calculator = document.createElement("div");
        calculator.className = "money-calculator hidden";
        calculator.id = "moneyCalculator";
        calculator.innerHTML = `
          <div class="money-calculator-card" role="dialog" aria-modal="true" aria-labelledby="moneyCalculatorTitle">
            <div class="modal-header">
              <h3 id="moneyCalculatorTitle">Kalkulator Nominal</h3>
              <button class="icon-button" type="button" data-money-cancel title="Tutup">×</button>
            </div>
            <div class="money-calculator-body">
              <div class="money-calculator-display" aria-live="polite">
                <span id="moneyCalculatorResult">Rp0</span>
                <input id="moneyCalculatorExpression" class="money-calculator-expression" type="text" inputmode="numeric" aria-label="Ekspresi nominal" />
              </div>
              <p class="form-status hidden" id="moneyCalculatorStatus"></p>
              <div class="money-keypad">
                ${["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", "000", "⌫", "+", "C", "=", "Batal", "Gunakan"].map((key) => `<button class="button ${key === "Gunakan" ? "primary" : key === "Batal" ? "danger" : ""}" type="button" data-money-key="${key}">${key}</button>`).join("")}
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(calculator);
        return calculator;
      }

      function openMoneyCalculator(input) {
        if (!input || input.dataset.calculatorOpening === "true") return;
        input.dataset.calculatorOpening = "true";
        setTimeout(() => {
          input.dataset.calculatorOpening = "false";
        }, 250);
        const calculator = ensureMoneyCalculator();
        const expressionInput = calculator.querySelector("#moneyCalculatorExpression");
        const status = calculator.querySelector("#moneyCalculatorStatus");
        calculator.dataset.targetInput = input.id;
        expressionInput.value = parseRupiahToNumber(input.value) || "";
        updateMoneyCalculatorResult();
        status.className = "form-status hidden";
        status.textContent = "";
        calculator.classList.remove("hidden");
        expressionInput.focus();
      }

      function closeMoneyCalculator() {
        document.querySelector("#moneyCalculator")?.classList.add("hidden");
      }

      function updateMoneyCalculatorResult() {
        const calculator = document.querySelector("#moneyCalculator");
        const expressionInput = calculator?.querySelector("#moneyCalculatorExpression");
        const result = calculator?.querySelector("#moneyCalculatorResult");
        if (!expressionInput || !result) return;
        try {
          result.textContent = money(calculateMoneyExpression(expressionInput.value));
        } catch {
          result.textContent = "Rp0";
        }
      }

      function loadState() {
        return window.AppStorage.loadState(storageKey, normalizeState, emptyState);
      }

      function emptyState() {
        return normalizeState({});
      }

      function saveState() {
        if (isGuest()) return;
        if (isChildUser()) return;
        window.AppStorage.saveState(storageKey, state);
        if (hasUnsyncedChanges) queueCloudSave();
      }

      function markDataChanged() {
        hasUnsyncedChanges = true;
        state.syncStatus = "pending";
        state.localChangedAt = new Date().toISOString();
      }

      function setLocalSyncStatus(status) {
        state.syncStatus = status;
        if (isChildUser()) return;
        if (!isGuest()) window.AppStorage.saveState(storageKey, state);
      }

      function isCloudSyncAllowed() {
        return Boolean(cloudSync.enabled && state.settings.cloudSyncEnabled !== false);
      }

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

      function replaceState(nextState) {
        const normalized = normalizeState(nextState);
        applyState(normalized);
        if (isGuest()) return;
        if (isChildUser()) return;
        window.AppStorage.saveState(storageKey, state);
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
        return window.AppCloud.cloudUserKey(currentUser);
      }

      function queueCloudSave() {
        if (isChildUser()) return;
        if (!isCloudSyncAllowed()) return;
        return window.AppCloud.queueCloudSave({
          cloudSync,
          currentUser,
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
        if (!hasUnsyncedChanges || !isCloudSyncAllowed() || isGuest() || isChildUser()) return;
        clearTimeout(cloudSync.retryTimer);
        const delay = Math.min(60000, 5000 * (2 ** cloudSync.retryCount));
        cloudSync.retryCount += 1;
        cloudSync.nextRetryAt = new Date(Date.now() + delay).toISOString();
        renderAccount();
        cloudSync.retryTimer = setTimeout(async () => {
          cloudSync.retryTimer = null;
          if (!hasUnsyncedChanges || !isCloudSyncAllowed() || isGuest() || isChildUser()) return;
          const saved = await savePendingCloudChanges();
          if (!saved) showSnackbar("Sinkronisasi cloud masih gagal. Data tetap aman di lokal.", "error");
          renderAccount();
        }, delay);
      }

      function handleCloudSaveResult(saved) {
        if (saved) {
          hasUnsyncedChanges = false;
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
        if (isChildUser()) return true;
        if (!hasUnsyncedChanges) return true;
        if (!isCloudSyncAllowed()) return true;
        const saved = await saveCloudState();
        return handleCloudSaveResult(saved);
      }

      async function flushCloudSave() {
        if (isChildUser()) return true;
        if (!hasUnsyncedChanges) return true;
        if (!isCloudSyncAllowed()) return true;
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
          hasUnsyncedChanges = false;
          setLocalSyncStatus("synced");
        }
        renderAll();
        return !cloudSync.lastError;
      }

      async function loadCloudState(options = {}) {
        if (!isCloudSyncAllowed()) return;
        return window.AppCloud.loadCloudState({
          cloudSync,
          setupCloudClient: () => setupCloudClient(),
          cloudConfig,
          cloudUserKey,
          replaceState,
          mergeStateData,
          emptyState,
          state,
          saveCloudState,
          saveAfterLoad: options.saveAfterLoad,
          hasPendingLocalChanges: () => hasUnsyncedChanges,
          markConflict: markCloudConflict,
        });
      }

      async function saveCloudState() {
        if (!isCloudSyncAllowed()) return true;
        return window.AppCloud.saveCloudState({
          cloudSync,
          setupCloudClient: () => setupCloudClient(),
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
          return hasUnsyncedChanges
            ? "Sinkronisasi cloud nonaktif. Perubahan tersimpan lokal dan menunggu sync."
            : "Sinkronisasi cloud nonaktif. Data hanya disimpan di perangkat ini.";
        }
        if (cloudSync.nextRetryAt && hasUnsyncedChanges) {
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
        if (hasUnsyncedChanges) markCloudConflict(updatedAt || new Date().toISOString());
        replaceState(mergeStateData(payload, state));
        cloudSync.lastSyncedAt = updatedAt || new Date().toISOString();
        cloudSync.lastError = "";
        renderAll();
      }

      function startCloudRealtimeSync() {
        if (!isCloudSyncAllowed()) return;
        window.AppCloud.startRealtimeSync({
          cloudSync,
          setupCloudClient: () => setupCloudClient(),
          cloudConfig,
          cloudUserKey,
          applyCloudPayload,
          loadCloudState: (options) => loadCloudState(options),
        });
      }

      function stopCloudRealtimeSync() {
        window.AppCloud.stopRealtimeSync(cloudSync);
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
        return window.AppState.tx(id(), type, date, category, description, amount, meta);
      }

      function updateTransactionRecord(target, values) {
        const normalized = window.AppState.normalizeTransaction({
          ...target,
          ...values,
          id: target.id,
          createdAt: target.createdAt,
          updatedAt: new Date().toISOString(),
        });
        Object.assign(target, normalized);
      }

      function savingsEntry(type, date, amount, note) {
        return window.AppState.savingsEntry(id(), type, date, amount, note);
      }

      function savingsGoal(category, target, targetDate, entries = []) {
        return window.AppState.savingsGoal(id(), todayDate(), category, target, targetDate, entries);
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
        return window.AppState.familyMember(id(), dataOwnerId(), childEmail.trim().toLowerCase(), childName.trim(), phone.trim(), status, { childUserId });
      }

      function familyMemberCloudPayload(member) {
        return {
          parent_user_id: dataOwnerId(),
          child_user_id: member.childUserId || null,
          child_email: member.childEmail.trim().toLowerCase(),
          child_name: member.childName.trim(),
          phone: member.phone || "",
          role: "child",
          status: member.status === "inactive" ? "inactive" : "active",
        };
      }

      async function upsertFamilyMemberAccess(member) {
        const client = setupCloudClient();
        if (!client || isGuest()) return { ok: true };
        if (!dataOwnerId()) return { ok: false, message: "Akun utama belum terhubung ke Supabase." };
        const { error } = await client
          .from("family_members")
          .upsert(familyMemberCloudPayload(member), { onConflict: "parent_user_id,child_email" });
        return error ? { ok: false, message: error.message || "Akses anggota keluarga belum tersimpan ke Supabase." } : { ok: true };
      }

      async function deleteFamilyMemberAccess(member) {
        const client = setupCloudClient();
        if (!client || isGuest()) return { ok: true };
        const { error } = await client
          .from("family_members")
          .delete()
          .eq("parent_user_id", dataOwnerId())
          .eq("child_email", member.childEmail.trim().toLowerCase());
        return error ? { ok: false, message: error.message || "Akses anggota keluarga belum terhapus dari Supabase." } : { ok: true };
      }

      function walletRecord(name, initialBalance = 0, type = "Cash") {
        const timestamp = new Date().toISOString();
        return window.AppState.normalizeWallet({
          id: id(),
          userId: currentUserId(),
          name,
          initialBalance,
          currentBalance: initialBalance,
          type,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      function walletName(walletId) {
        return state.wallets.find((wallet) => wallet.id === walletId)?.name || "Tanpa dompet";
      }

      function walletInUse(walletId) {
        return state.transactions.some((item) => item.walletId === walletId);
      }

      function walletOptions(selectedId = "") {
        if (!state.wallets.length) return `<option value="">Belum ada dompet</option>`;
        return state.wallets.map((wallet) => `<option value="${wallet.id}" ${wallet.id === selectedId ? "selected" : ""}>${escapeHtml(wallet.name)} - ${money(wallet.currentBalance || 0)}</option>`).join("");
      }

      function defaultWalletId() {
        return state.wallets[0]?.id || "";
      }

      function ensureTransactionWallets() {
        if (!state.wallets.length) return;
        const defaultWalletId = state.wallets[0].id;
        state.transactions.forEach((transaction) => {
          if (!transaction.walletId) transaction.walletId = defaultWalletId;
        });
      }

      function recalculateWalletBalances() {
        state.wallets.forEach((wallet) => {
          wallet.currentBalance = Number(wallet.initialBalance || 0);
        });
        state.transactions.forEach((transaction) => {
          const wallet = state.wallets.find((item) => item.id === transaction.walletId);
          if (!wallet) return;
          const amount = Number(transaction.amount || 0);
          wallet.currentBalance += transaction.type === "income" ? amount : -amount;
        });
      }

      function debtPaymentTransactionTypeForDebt(debt) {
        return debt?.kind === "receivable" ? "receivable_payment" : "debt_payment";
      }

      function transactionPaymentDebtId(transaction) {
        return transaction.debtId || transaction.receivableId || "";
      }

      function isDebtPaymentTransaction(transaction) {
        return transaction?.transactionType === "debt_payment" || transaction?.transactionType === "receivable_payment" || transaction?.debtPaymentType === "debt_payment" || transaction?.debtPaymentType === "receivable_payment";
      }

      function debtPaymentTransactions(debtId, options = {}) {
        return state.transactions.filter((transaction) => {
          if (!isDebtPaymentTransaction(transaction)) return false;
          if (transactionPaymentDebtId(transaction) !== debtId) return false;
          if (options.excludeTransactionId && transaction.id === options.excludeTransactionId) return false;
          return true;
        });
      }

      function debtPaidAmount(debt, options = {}) {
        return debtPaymentTransactions(debt.id, options).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      }

      function debtRemainingAmount(debt, options = {}) {
        return Math.max(0, Number(debt?.totalAmount ?? debt?.amount ?? 0) - debtPaidAmount(debt, options));
      }

      function syncDebtPaymentState() {
        state.debts.forEach((debt) => {
          const totalAmount = Number(debt.totalAmount ?? debt.amount ?? 0);
          const payments = debtPaymentTransactions(debt.id);
          const keepManualPaid = !payments.length && debt.status === "paid" && Number(debt.paidAmount || 0) >= totalAmount && !(debt.relatedTransactionIds || []).length;
          const paidAmount = payments.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
          const effectivePaidAmount = keepManualPaid ? totalAmount : paidAmount;
          const remainingAmount = Math.max(0, totalAmount - effectivePaidAmount);
          debt.amount = totalAmount;
          debt.totalAmount = totalAmount;
          debt.paidAmount = effectivePaidAmount;
          debt.remainingAmount = remainingAmount;
          debt.relatedTransactionIds = payments.map((transaction) => transaction.id);
          debt.paymentHistory = payments.map((transaction) => ({
            transactionId: transaction.id,
            date: transaction.date,
            amount: Number(transaction.amount || 0),
            walletId: transaction.walletId || "",
          }));
          debt.status = remainingAmount <= 0 && totalAmount > 0 ? "paid" : effectivePaidAmount > 0 ? "partial" : "unpaid";
        });
      }

      function vehicleName(vehicleId) {
        const vehicle = state.vehicles.find((item) => item.id === vehicleId);
        return vehicle ? vehicle.name : "Kendaraan";
      }

      function ensureVehicleCategory() {
        if (!state.categories.includes("Kendaraan")) {
          state.categories.push("Kendaraan");
          categories = state.categories;
        }
      }

      function ensureDebtCategory() {
        if (!state.categories.includes("Hutang Piutang")) {
          state.categories.push("Hutang Piutang");
          categories = state.categories;
        }
      }

      function addMonths(dateValue, months) {
        if (!dateValue) return "";
        const date = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(date.getTime())) return "";
        date.setMonth(date.getMonth() + Number(months || 0));
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      }

      function daysUntil(dateValue) {
        if (!dateValue) return Infinity;
        const today = new Date(`${todayDate()}T00:00:00`);
        const target = new Date(`${dateValue}T00:00:00`);
        return Math.ceil((target - today) / 86400000);
      }

      function vehicleStatusBySchedule(dateValue, kmLeft = Infinity) {
        const days = daysUntil(dateValue);
        if (days < 0 || kmLeft < 0) return { label: "Sudah lewat", className: "danger" };
        if (days <= 30 || kmLeft <= 500) return { label: "Mendekati jadwal", className: "warn" };
        return { label: "Aman", className: "income" };
      }

      function vehicleOptions(selectedId = "") {
        if (!state.vehicles.length) return `<option value="">Belum ada kendaraan</option>`;
        return state.vehicles.map((vehicle) => `<option value="${vehicle.id}" ${vehicle.id === selectedId ? "selected" : ""}>${escapeHtml(vehicle.name)} - ${escapeHtml(vehicle.plate)}</option>`).join("");
      }

      function vehicleTransactions() {
        return state.transactions.filter((item) => item.category === "Kendaraan" || item.vehicleId || item.sourceModule === "vehicles");
      }

      function upsertVehicleTransaction(record, subcategory, amount, date, description) {
        const value = Number(amount || 0);
        if (value <= 0) return "";
        ensureVehicleCategory();
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
          walletId: record.walletId || defaultWalletId(),
          vehicleId: record.vehicleId,
          vehicleRecordId: record.id,
          vehicleRecordType: subcategory,
          updatedAt: new Date().toISOString(),
        };
        if (existing) {
          updateTransactionRecord(existing, payload);
          return existing.id;
        }
        const transaction = transactionRecord("expense", date, "Kendaraan", description, value, payload);
        state.transactions.push(transaction);
        return transaction.id;
      }

      function removeVehicleTransaction(record) {
        if (!record?.transactionId) return;
        markDeleted("transactions", record.transactionId);
        state.transactions = state.transactions.filter((item) => item.id !== record.transactionId);
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
        return state.budgets.filter((budget) => budget.isActive !== false && (!type || budget.type === type));
      }

      function budgetById(budgetId) {
        return state.budgets.find((budget) => budget.id === budgetId);
      }

      function childBudgets(parentId) {
        return activeBudgets().filter((budget) => budget.parentId === parentId);
      }

      function budgetDisplayName(budget) {
        const parent = budget?.parentId ? budgetById(budget.parentId) : null;
        return parent ? `${parent.name} - ${budget.name}` : budget?.name || budget?.category || "";
      }

      function transactionMatchesBudget(transaction, budget) {
        if (!budget) return false;
        return transaction.budgetId === budget.id || (!transaction.budgetId && transaction.category === (budget.category || budget.name));
      }

      function budgetUsedAmount(budget, month = currentMonthKey()) {
        const children = childBudgets(budget.id);
        const selfUsed = transactionsByMonth(month)
          .filter((item) => item.type === budget.type)
          .filter((item) => transactionMatchesBudget(item, budget))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const childUsed = children.reduce((sum, child) => sum + budgetUsedAmount(child, month), 0);
        return selfUsed + childUsed;
      }

      function budgetRemainingAmount(budget, month = currentMonthKey()) {
        return Number(budget?.budgetLimit ?? budget?.limit ?? 0) - budgetUsedAmount(budget, month);
      }

      function budgetOptions(type = "expense", selectedId = "") {
        const parents = activeBudgets(type).filter((budget) => !budget.parentId);
        return parents.map((parent) => {
          const children = childBudgets(parent.id).filter((child) => child.type === type);
          return `
            <option value="${parent.id}" ${selectedId === parent.id ? "selected" : ""}>${escapeHtml(parent.name)}</option>
            ${children.map((child) => `<option value="${child.id}" ${selectedId === child.id ? "selected" : ""}>-- ${escapeHtml(child.name)}</option>`).join("")}
          `;
        }).join("");
      }

      function syncCategoriesFromBudgets() {
        const names = activeBudgets().map((budget) => budget.name).filter(Boolean);
        state.categories = [...new Set([...(state.categories || []), ...names])];
        categories = state.categories;
      }

      function budgetHasCircularParent(budgetId, parentId) {
        let cursor = parentId;
        while (cursor) {
          if (cursor === budgetId) return true;
          cursor = budgetById(cursor)?.parentId || null;
        }
        return false;
      }

      function validateSubBudgetLimit({ parentId, budgetLimit, editingId = "" }) {
        if (!parentId) return true;
        const parent = budgetById(parentId);
        if (!parent || !Number(parent.budgetLimit || parent.limit || 0)) return true;
        const siblingTotal = activeBudgets()
          .filter((budget) => budget.parentId === parentId && budget.id !== editingId)
          .reduce((sum, budget) => sum + Number(budget.budgetLimit ?? budget.limit ?? 0), 0);
        return siblingTotal + Number(budgetLimit || 0) <= Number(parent.budgetLimit ?? parent.limit ?? 0);
      }

      function syncBudgetUsageState(month = currentMonthKey()) {
        state.budgets.forEach((budget) => {
          const usedAmount = budget.isActive === false ? Number(budget.usedAmount || 0) : budgetUsedAmount(budget, month);
          const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
          budget.usedAmount = usedAmount;
          budget.remainingAmount = limit - usedAmount;
          budget.limit = limit;
          budget.budgetLimit = limit;
        });
      }

      function savingsBalance(goal) {
        return (goal.entries || []).reduce((sum, entry) => sum + (entry.type === "withdraw" ? -Number(entry.amount || 0) : Number(entry.amount || 0)), 0);
      }

      function savingsPercent(goal) {
        if (!goal.target) return 0;
        return Math.min(100, Math.max(0, Math.round((savingsBalance(goal) / Number(goal.target)) * 100)));
      }

      function isSavingsAchieved(goal) {
        return Number(goal?.target || 0) > 0 && savingsBalance(goal) >= Number(goal.target || 0);
      }

      function activeDebts(kind) {
        return state.debts.filter((item) => item.kind === kind && item.status !== "paid");
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
        return `
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
          </svg>
        `;
      }

      function randomizeTotalBalanceGradient() {
        const card = document.querySelector(".total-balance-card");
        if (!card || card.dataset.gradientSeeded === "true") return;
        const percent = (min, max) => `${Math.round(min + Math.random() * (max - min))}%`;
        card.dataset.gradientSeeded = "true";
        card.style.setProperty("--balance-a-x", percent(10, 34));
        card.style.setProperty("--balance-a-y", percent(12, 42));
        card.style.setProperty("--balance-b-x", percent(66, 92));
        card.style.setProperty("--balance-b-y", percent(10, 40));
        card.style.setProperty("--balance-c-x", percent(38, 72));
        card.style.setProperty("--balance-c-y", percent(58, 88));
        card.style.setProperty("--balance-glow-x", percent(62, 90));
        card.style.setProperty("--balance-glow-y", percent(12, 72));
        card.style.setProperty("--balance-flow-duration", `${Math.round(11 + Math.random() * 6)}s`);
        card.style.setProperty("--balance-glow-duration", `${Math.round(7 + Math.random() * 5)}s`);
      }

      function renderStats() {
        const month = currentMonthKey();
        const currentItems = transactionsByMonth(month);
        const previousItems = transactionsByMonth(previousMonthKey(month));
        const currentExpense = sumTransactions(currentItems, "expense");
        const previousExpense = sumTransactions(previousItems, "expense");
        const currentIncome = sumTransactions(currentItems, "income");
        const budgetTotal = currentBudgetTotal();
        const remaining = budgetTotal - currentExpense;
        const unpaidReceivable = activeDebts("receivable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);
        const unpaidPayable = activeDebts("payable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);

        renderDashboardGreeting();
        randomizeTotalBalanceGradient();
        document.querySelector("#monthExpense").textContent = money(currentExpense);
        document.querySelector("#monthIncome").textContent = money(currentIncome);
        updateTotalBalanceVisibility(state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0));
        document.querySelector("#remainingBudget").textContent = money(remaining);
        document.querySelector("#debtSummary").textContent = money(unpaidReceivable - unpaidPayable);

        const trend = document.querySelector("#expenseTrend");
        trend.className = "stat-sub";
        if (!previousExpense && currentExpense) {
          trend.textContent = "Belum ada data bulan lalu";
        } else if (!previousExpense && !currentExpense) {
          trend.textContent = "Belum ada pembanding";
        } else {
          const delta = currentExpense - previousExpense;
          const percent = Math.abs((delta / previousExpense) * 100).toFixed(1);
          trend.textContent = delta >= 0 ? `Naik ${percent}% dari bulan lalu` : `Turun ${percent}% dari bulan lalu`;
          trend.classList.add(delta >= 0 ? "trend-up" : "trend-down");
        }

        const budgetStatus = document.querySelector("#budgetStatus");
        if (!budgetTotal) budgetStatus.textContent = "Belum ada anggaran";
        else if (remaining >= 0) budgetStatus.textContent = `${Math.round((remaining / budgetTotal) * 100)}% masih tersedia`;
        else budgetStatus.textContent = `Lewat anggaran ${money(Math.abs(remaining))}`;
      }

      function renderStats() {
        const month = currentMonthKey();
        const currentItems = transactionsByMonth(month);
        const previousItems = transactionsByMonth(previousMonthKey(month));
        const currentExpense = sumTransactions(currentItems, "expense");
        const previousExpense = sumTransactions(previousItems, "expense");
        const currentIncome = sumTransactions(currentItems, "income");
        const budgetTotal = currentBudgetTotal();
        const remaining = budgetTotal - currentExpense;
        const unpaidReceivable = activeDebts("receivable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);
        const unpaidPayable = activeDebts("payable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);

        renderDashboardGreeting();
        randomizeTotalBalanceGradient();
        document.querySelector("#monthExpense").textContent = money(currentExpense);
        document.querySelector("#monthIncome").textContent = money(currentIncome);
        updateTotalBalanceVisibility(state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0));
        document.querySelector("#remainingBudget").textContent = money(remaining);
        document.querySelector("#debtSummary").textContent = money(unpaidReceivable - unpaidPayable);

        const trend = document.querySelector("#expenseTrend");
        trend.className = "stat-sub";
        if (!previousExpense && currentExpense) {
          trend.textContent = "Belum ada data bulan lalu";
        } else if (!previousExpense && !currentExpense) {
          trend.textContent = "Belum ada pembanding";
        } else {
          const delta = currentExpense - previousExpense;
          const percent = Math.abs((delta / previousExpense) * 100).toFixed(1);
          trend.textContent = delta >= 0 ? `Naik ${percent}% dari bulan lalu` : `Turun ${percent}% dari bulan lalu`;
          trend.classList.add(delta >= 0 ? "trend-up" : "trend-down");
        }

        const budgetStatus = document.querySelector("#budgetStatus");
        if (!budgetTotal) budgetStatus.textContent = "Belum ada anggaran";
        else if (remaining >= 0) budgetStatus.textContent = `${Math.round((remaining / budgetTotal) * 100)}% masih tersedia`;
        else budgetStatus.textContent = `Lewat anggaran ${money(Math.abs(remaining))}`;
      }

      function renderChart() {
        const box = document.querySelector("#balanceChart");
        const month = currentMonthKey();
        const [year, monthNumber] = month.split("-").map(Number);
        const today = new Date();
        const days = today.getFullYear() === year && today.getMonth() + 1 === monthNumber ? today.getDate() : new Date(year, monthNumber, 0).getDate();
        const budgetTotal = currentBudgetTotal();
        const points = [];

        for (let day = 1; day <= days; day += Math.max(1, Math.floor(days / 10))) {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const spent = transactionsByMonth(month)
            .filter((item) => item.type === "expense" && item.date <= date)
            .reduce((sum, item) => sum + Number(item.amount), 0);
          points.push({ day, balance: totalBalanceUntil(date), budget: budgetTotal - spent });
        }
        if (!points.some((point) => point.day === days)) {
          const date = `${month}-${String(days).padStart(2, "0")}`;
          const spent = transactionsByMonth(month)
            .filter((item) => item.type === "expense" && item.date <= date)
            .reduce((sum, item) => sum + Number(item.amount), 0);
          points.push({ day: days, balance: totalBalanceUntil(date), budget: budgetTotal - spent });
        }

        const values = points.flatMap((point) => [point.balance, point.budget]);
        const min = Math.min(...values, 0);
        const max = Math.max(...values, 1);
        const width = 820;
        const height = 286;
        const pad = 34;
        const x = (day) => pad + ((day - 1) / Math.max(1, days - 1)) * (width - pad * 2);
        const y = (value) => height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
        const pathFor = (key) => points.map((point, index) => `${index ? "L" : "M"}${x(point.day).toFixed(1)} ${y(point[key]).toFixed(1)}`).join(" ");
        const grid = [0, 1, 2, 3].map((step) => {
          const lineY = pad + step * ((height - pad * 2) / 3);
          return `<line x1="${pad}" y1="${lineY}" x2="${width - pad}" y2="${lineY}" stroke="#e7edf1" />`;
        }).join("");

        box.innerHTML = `
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik total saldo dan sisa anggaran">
            <rect width="${width}" height="${height}" fill="transparent"></rect>
            ${grid}
            <path d="${pathFor("balance")}" fill="none" stroke="#176b5b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="${pathFor("budget")}" fill="none" stroke="#5d5bd6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            ${points.map((point) => `<circle cx="${x(point.day).toFixed(1)}" cy="${y(point.balance).toFixed(1)}" r="4" fill="#176b5b" />`).join("")}
            ${points.map((point) => `<circle cx="${x(point.day).toFixed(1)}" cy="${y(point.budget).toFixed(1)}" r="4" fill="#5d5bd6" />`).join("")}
            <text x="${pad}" y="24" fill="#65727d" font-size="13" font-weight="700">${monthLabel(month)}</text>
            <text x="${width - pad}" y="24" text-anchor="end" fill="#65727d" font-size="13" font-weight="700">${money(max)}</text>
            <text x="${width - pad}" y="${height - 13}" text-anchor="end" fill="#65727d" font-size="13" font-weight="700">${money(min)}</text>
          </svg>
        `;
      }

      function editIcon() {
        return `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M14 7l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        `;
      }

      function renderDashboardGreeting() {
        const hour = new Date().getHours();
        const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
        const displayName = currentUser?.name || currentUser?.email || currentUser?.username || "Pengguna";
        const initials = displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "DP";
        const greetingTarget = document.querySelector("#dashboardGreeting");
        const nameTarget = document.querySelector("#dashboardUserName");
        const avatarTarget = document.querySelector("#dashboardAvatar");
        if (greetingTarget) greetingTarget.textContent = greeting;
        if (nameTarget) nameTarget.textContent = displayName;
        if (avatarTarget) avatarTarget.textContent = initials;
      }

      function maskedMoney() {
        return "Rp •••••••";
      }

      function updateTotalBalanceVisibility(total) {
        const target = document.querySelector("#totalBalance");
        const button = document.querySelector("#toggleTotalBalanceVisibilityButton");
        if (!target || !button) return;
        const visible = Boolean(state.settings.totalBalanceVisible);
        target.textContent = visible ? money(total) : maskedMoney();
        button.textContent = visible ? "👁" : "🙈";
        button.setAttribute("aria-label", visible ? "Sembunyikan total saldo" : "Tampilkan total saldo");
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
        if (range === "all") return true;
        const itemDate = new Date(`${item.date}T00:00:00`);
        if (Number.isNaN(itemDate.getTime())) return false;
        const today = new Date();
        const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
        if (range === "today") return itemDay.getTime() === startToday.getTime();
        if (range === "week") {
          const day = startToday.getDay() || 7;
          const startWeek = new Date(startToday);
          startWeek.setDate(startToday.getDate() - day + 1);
          return itemDay >= startWeek && itemDay <= startToday;
        }
        return monthOf(item) === currentMonthKey();
      }

      function renderCategoryChips() {
        const target = document.querySelector("#categoryChipList");
        if (!target) return;
        const usedCategories = [...new Set(state.transactions.map((item) => item.category).filter(Boolean))];
        const items = ["all", ...usedCategories];
        target.innerHTML = items.map((category) => `
          <button class="filter-chip ${selectedCategoryFilter === category ? "active" : ""}" type="button" data-category-filter="${escapeHtml(category)}">
            ${category === "all" ? "Semua kategori" : escapeHtml(category)}
          </button>
        `).join("");
      }

      function renderWalletFilterOptions() {
        const select = document.querySelector("#walletFilter");
        if (!select) return;
        const current = select.value || "all";
        select.innerHTML = `<option value="all">Semua dompet</option>${state.wallets.map((wallet) => `<option value="${wallet.id}">${escapeHtml(wallet.name)}</option>`).join("")}`;
        select.value = [...select.options].some((option) => option.value === current) ? current : "all";
      }

      function transactionRows(items, limit = null) {
        const visible = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit ?? items.length);
        if (!visible.length) {
          return `
            <div class="empty">
              <p>Belum ada transaksi yang cocok dengan filter ini.</p>
              <button class="button primary" type="button" data-open-form="transaction">Tambah Transaksi</button>
            </div>
          `;
        }

        return `
          <table class="transaction-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Dompet</th>
                <th>Deskripsi</th>
                <th>Tipe</th>
                <th>Nominal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${visible.map((item) => `
                <tr class="transaction-row ${item.type}" data-open-transaction-detail="${item.id}">
                  <td>${escapeHtml(transactionDateLabel(item.date))}</td>
                  <td><span class="pill">${escapeHtml(item.category)}</span></td>
                  <td>${escapeHtml(walletName(item.walletId))}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td><span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span></td>
                  <td class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
                  <td>
                    <button class="icon-button" type="button" title="Edit transaksi" data-edit-transaction="${item.id}">
                      ${editIcon()}
                    </button>
                    <button class="icon-button" type="button" title="Hapus transaksi" data-delete-transaction="${item.id}">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }

      function walletMutationRows(items) {
        if (!items.length) {
          return `<div class="empty"><p>Belum ada mutasi yang cocok dengan filter ini.</p></div>`;
        }
        const groups = [...items]
          .sort((a, b) => b.date.localeCompare(a.date))
          .reduce((result, item) => {
            const month = monthOf(item) || "Tanpa bulan";
            if (!result[month]) result[month] = [];
            result[month].push(item);
            return result;
          }, {});

        return Object.entries(groups).map(([month, rows]) => `
          <section class="wallet-mutation-month">
            <h4>${escapeHtml(month === "Tanpa bulan" ? month : monthLabel(month))}</h4>
            <table class="transaction-table wallet-mutation-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Tipe</th>
                  <th>Nominal</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((item) => `
                  <tr class="transaction-row ${item.type}" data-open-transaction-detail="${item.id}">
                    <td>${escapeHtml(transactionDateLabel(item.date))}</td>
                    <td><span class="pill">${escapeHtml(item.category || "Lainnya")}</span></td>
                    <td><span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span></td>
                    <td class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </section>
        `).join("");
      }

      function renderWalletMutationMonthOptions(walletId) {
        const input = document.querySelector("#walletMutationMonth");
        if (!input) return;
        const months = [...new Set(state.transactions.filter((item) => item.walletId === walletId).map(monthOf).filter(Boolean))].sort().reverse();
        if (!input.value && months.length) input.value = months[0];
      }

      function renderWalletDetail() {
        const view = document.querySelector("#walletDetailView");
        if (!view || !selectedWalletDetailId) return;
        recalculateWalletBalances();
        const wallet = state.wallets.find((item) => item.id === selectedWalletDetailId);
        if (!wallet) {
          selectedWalletDetailId = "";
          openView("wallets", { replace: true });
          return;
        }
        document.querySelector("#walletDetailType").textContent = wallet.type || "Dompet";
        document.querySelector("#walletDetailName").textContent = wallet.name;
        document.querySelector("#walletDetailInitial").textContent = `Saldo awal ${money(wallet.initialBalance || 0)}`;
        document.querySelector("#walletDetailBalance").textContent = money(wallet.currentBalance || 0);
        renderWalletMutationMonthOptions(wallet.id);

        const query = document.querySelector("#walletMutationSearch")?.value.toLowerCase().trim() || "";
        const month = document.querySelector("#walletMutationMonth")?.value || "";
        const start = document.querySelector("#walletMutationStartDate")?.value || "";
        const end = document.querySelector("#walletMutationEndDate")?.value || "";
        const rows = state.transactions
          .filter((item) => item.walletId === wallet.id)
          .filter((item) => !month || monthOf(item) === month)
          .filter((item) => !start || item.date >= start)
          .filter((item) => !end || item.date <= end)
          .filter((item) => `${item.category} ${item.type === "income" ? "credit pemasukan" : "debit pengeluaran"}`.toLowerCase().includes(query));

        document.querySelector("#walletMutationList").innerHTML = walletMutationRows(rows);
      }

      function openWalletDetail(walletId) {
        if (!requireSignedIn()) return;
        if (!state.wallets.some((wallet) => wallet.id === walletId)) return;
        selectedWalletDetailId = walletId;
        ["#walletMutationSearch", "#walletMutationMonth", "#walletMutationStartDate", "#walletMutationEndDate"].forEach((selector) => {
          const input = document.querySelector(selector);
          if (input) input.value = "";
        });
        openView("walletDetail");
        renderWalletDetail();
      }

      function openTransactionDetail(transactionId) {
        if (!requireSignedIn()) return;
        const item = state.transactions.find((transaction) => transaction.id === transactionId);
        if (!item) return;
        const receiptUrl = item.receiptUrl || item.receiptImage || item.strukUrl || "";
        document.querySelector("#modalTitle").textContent = "Detail Transaksi";
        document.querySelector("#modalBody").innerHTML = `
          <div class="transaction-detail" id="transactionDetailView">
            <section class="receipt-preview">
              ${receiptUrl
                ? `<button class="receipt-preview-button" type="button" data-preview-receipt="${item.id}" aria-label="Lihat detail foto struk"><img src="${escapeHtml(receiptUrl)}" alt="Foto struk transaksi" /></button>`
                : `<div class="receipt-empty"><strong>Belum ada foto struk</strong><span>Unggah foto struk agar transaksi lebih mudah diaudit.</span></div>`}
            </section>
            ${isChildUser() ? "" : `
              <div class="row-actions receipt-actions">
                <label class="button receipt-upload" for="receiptUploadInput">${receiptUrl ? "Ganti Foto Struk" : "Unggah Foto Struk"}</label>
                ${receiptUrl ? `
                  <button class="button" type="button" data-preview-receipt="${item.id}">Preview Struk</button>
                  <button class="button danger" type="button" data-delete-receipt="${item.id}">Hapus Struk</button>
                ` : ""}
              </div>
              <input class="hidden" id="receiptUploadInput" type="file" accept="image/*" data-receipt-transaction="${item.id}" />
            `}
            <section class="transaction-detail-summary">
              <div>
                <span class="stat-label">Nominal</span>
                <strong class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</strong>
              </div>
              <span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span>
            </section>
            <div class="compact-list transaction-detail-meta">
              <span class="pill">${escapeHtml(transactionDateLabel(item.date))}</span>
              <span class="pill">${escapeHtml(walletName(item.walletId))}</span>
              <span class="pill">${escapeHtml(item.category || "Lainnya")}</span>
              <span class="pill">${escapeHtml(item.sourceModule || "manual")}</span>
            </div>
            <div class="debt-row">
              <div class="debt-row-top">
                <div>
                  <strong>Deskripsi</strong>
                  <span>${escapeHtml(item.description || "-")}</span>
                </div>
              </div>
            </div>
            <div class="compact-list transaction-detail-meta">
              <span class="pill">Dibuat ${escapeHtml(transactionDateTimeLabel(item.createdAt))}</span>
              <span class="pill">Diubah ${escapeHtml(transactionDateTimeLabel(item.updatedAt))}</span>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Tutup</button>
              ${isChildUser() ? "" : `
                <button class="button" type="button" data-edit-transaction="${item.id}">Edit</button>
                <button class="button danger" type="button" data-delete-transaction="${item.id}">Hapus</button>
              `}
            </div>
          </div>
        `;
        showModal();
      }

      function openReceiptPreview(transactionId) {
        const item = state.transactions.find((transaction) => transaction.id === transactionId);
        const receiptUrl = item?.receiptUrl || item?.receiptImage || item?.strukUrl || "";
        if (!item || !receiptUrl) return;
        document.querySelector("#modalTitle").textContent = "Preview Struk";
        document.querySelector("#modalBody").innerHTML = `
          <div class="receipt-preview-detail">
            <img src="${escapeHtml(receiptUrl)}" alt="Preview struk transaksi" />
            <div class="row-actions">
              <button class="button" type="button" data-open-transaction-detail="${item.id}">Kembali ke Detail</button>
              ${isChildUser() ? "" : `<button class="button danger" type="button" data-delete-receipt="${item.id}">Hapus Struk</button>`}
            </div>
          </div>
        `;
        showModal();
      }

      function renderTransactions() {
        renderWalletFilterOptions();
        renderCategoryChips();
        const latestTarget = document.querySelector("#latestTransactions");
        if (latestTarget) latestTarget.innerHTML = transactionRows(state.transactions, 5);
        const query = document.querySelector("#searchInput")?.value.toLowerCase().trim() || "";
        const month = document.querySelector("#monthFilter")?.value || "all";
        const type = document.querySelector("#typeFilter")?.value || "all";
        const wallet = document.querySelector("#walletFilter")?.value || "all";
        const filtered = state.transactions
          .filter((item) => month === "all" || monthOf(item) === month)
          .filter((item) => type === "all" || item.transactionType === type || item.type === type)
          .filter((item) => wallet === "all" || item.walletId === wallet)
          .filter((item) => selectedCategoryFilter === "all" || item.category === selectedCategoryFilter)
          .filter((item) => quickRangeMatch(item, quickTransactionRange))
          .filter((item) => `${item.category} ${item.description} ${walletName(item.walletId)}`.toLowerCase().includes(query));
        document.querySelector("#allTransactions").innerHTML = transactionRows(filtered);
      }

      function renderBudgets() {
        const month = currentMonthKey();
        const parents = activeBudgets().filter((budget) => !budget.parentId);
        const rows = parents.map((budget) => {
          const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
          const spent = budgetUsedAmount(budget, month);
          const percent = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const statusClass = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
          const children = childBudgets(budget.id);
          return `
            <details class="budget-row budget-parent" open>
              <summary class="budget-row-top">
                <div>
                  <strong>${escapeHtml(budget.name)}</strong>
                  <span>${budget.type === "income" ? "Pemasukan" : "Pengeluaran"} - ${escapeHtml(budget.period || "monthly")}</span>
                </div>
                <span>${money(spent)} / ${money(limit)}</span>
              </summary>
              <div class="progress ${statusClass}"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${budgetRemainingAmount(budget, month) >= 0 ? "Sisa" : "Lewat"} ${money(Math.abs(budgetRemainingAmount(budget, month)))}</div>
              <div class="row-actions budget-actions">
                <button class="button" type="button" data-add-sub-budget="${budget.id}">Tambah Sub Kategori</button>
                <button class="button" type="button" data-edit-budget="${budget.id}">Edit</button>
                <button class="button danger" type="button" data-delete-budget="${budget.id}">Hapus</button>
              </div>
              ${children.length ? `<div class="budget-sub-list">${children.map((child) => {
                const childLimit = Number(child.budgetLimit ?? child.limit ?? 0);
                const childSpent = budgetUsedAmount(child, month);
                const childPercent = childLimit ? Math.min(100, Math.round((childSpent / childLimit) * 100)) : 0;
                const childStatus = childPercent >= 100 ? "danger" : childPercent >= 80 ? "warn" : "";
                return `
                  <article class="budget-row budget-child">
                    <div class="budget-row-top">
                      <div>
                        <strong>${escapeHtml(child.name)}</strong>
                        <span>${money(childSpent)} / ${money(childLimit)}</span>
                      </div>
                      <div class="row-actions">
                        <button class="icon-button" type="button" title="Edit sub kategori" data-edit-budget="${child.id}">✎</button>
                        <button class="icon-button danger" type="button" title="Hapus sub kategori" data-delete-budget="${child.id}">×</button>
                      </div>
                    </div>
                    <div class="progress ${childStatus}"><i style="width: ${childPercent}%"></i></div>
                    <div class="stat-sub">${budgetRemainingAmount(child, month) >= 0 ? "Sisa" : "Lewat"} ${money(Math.abs(budgetRemainingAmount(child, month)))}</div>
                  </article>
                `;
              }).join("")}</div>` : `<div class="stat-sub">Belum ada sub kategori.</div>`}
            </details>
          `;
        }).join("");

        document.querySelector("#homeBudgetList").innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
        document.querySelector("#budgetPageList").innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
      }

      function savingsRows(limit = null) {
        const activeGoals = state.savings.filter((goal) => !isSavingsAchieved(goal));
        const goals = [...activeGoals].sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || "")).slice(0, limit ?? activeGoals.length);
        if (!goals.length) {
          return `
            <div class="empty">
              <p>Belum ada tujuan tabungan.</p>
              <button class="button primary" type="button" data-open-form="savingsGoal">Tambah Tujuan</button>
            </div>
          `;
        }

        return goals.map((goal) => {
          const balance = savingsBalance(goal);
          const percent = savingsPercent(goal);
          return `
            <article class="budget-row" data-open-savings="${goal.id}">
              <div class="budget-row-top">
                <div>
                  <strong>${escapeHtml(goal.title)}</strong>
                  <span>${percent}%</span>
                </div>
                <button class="icon-button danger" type="button" data-delete-savings="${goal.id}" aria-label="Hapus tabungan ${escapeHtml(goal.title)}" title="Hapus tabungan">
                  ${trashIcon()}
                </button>
              </div>
              <div class="progress"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${money(balance)} dari ${money(goal.target)} - Target ${escapeHtml(goal.targetDate || "-")}</div>
            </article>
          `;
        }).join("");
      }

      function savingsHistoryRows() {
        const achievedGoals = state.savings
          .filter((goal) => isSavingsAchieved(goal))
          .sort((a, b) => (b.targetDate || "").localeCompare(a.targetDate || ""));

        if (!achievedGoals.length) {
          return `<div class="empty"><p>Belum ada riwayat tabungan yang tercapai.</p></div>`;
        }

        return achievedGoals.map((goal) => {
          const balance = savingsBalance(goal);
          return `
            <article class="budget-row" data-open-savings="${goal.id}">
              <div class="budget-row-top">
                <div>
                  <strong>${escapeHtml(goal.title)}</strong>
                  <span>Tercapai</span>
                </div>
                <button class="icon-button danger" type="button" data-delete-savings="${goal.id}" aria-label="Hapus riwayat tabungan ${escapeHtml(goal.title)}" title="Hapus tabungan">
                  ${trashIcon()}
                </button>
              </div>
              <div class="progress success"><i style="width: 100%"></i></div>
              <div class="stat-sub">${money(balance)} dari ${money(goal.target)} - Target ${escapeHtml(goal.targetDate || "-")}</div>
            </article>
          `;
        }).join("");
      }

      function renderSavings() {
        const activeCount = state.savings.filter((goal) => !isSavingsAchieved(goal)).length;
        document.querySelector("#homeSavingsList").innerHTML = savingsRows(3);
        document.querySelector("#allSavingsList").innerHTML = savingsRows();
        document.querySelector("#viewAllSavingsButton").classList.toggle("hidden", activeCount <= 3);
      }

      function latestVehicleOil(vehicleId) {
        return [...state.vehicleOilChanges].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (b.lastOilDate || "").localeCompare(a.lastOilDate || ""))[0];
      }

      function nearestVehiclePart(vehicleId) {
        return [...state.vehicleParts].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (partNextDate(a) || "9999").localeCompare(partNextDate(b) || "9999"))[0];
      }

      function nearestVehicleService(vehicleId) {
        return [...state.vehicleServices].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (b.serviceDate || "").localeCompare(a.serviceDate || ""))[0];
      }

      function vehicleTax(vehicleId) {
        return [...state.vehicleTaxes].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (a.annualDueDate || "").localeCompare(b.annualDueDate || ""))[0];
      }

      function oilNextDate(item) {
        return addMonths(item.lastOilDate, item.intervalMonths);
      }

      function oilNextKm(item) {
        return Number(item.lastOilKm || 0) + Number(item.intervalKm || 0);
      }

      function partNextDate(item) {
        return addMonths(item.replacementDate, item.lifeMonths);
      }

      function partNextKm(item) {
        return Number(item.replacementKm || 0) + Number(item.lifeKm || 0);
      }

      function vehicleMonthlyTotal(vehicleId = "", month = currentMonthKey()) {
        return vehicleTransactions()
          .filter((item) => (!vehicleId || item.vehicleId === vehicleId) && monthOf(item) === month)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      function vehicleYearTotal(vehicleId = "", year = todayDate().slice(0, 4)) {
        return vehicleTransactions()
          .filter((item) => (!vehicleId || item.vehicleId === vehicleId) && item.date?.startsWith(year))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      function vehicleBadge(status) {
        return `<span class="pill ${status.className}">${status.label}</span>`;
      }

      function renderVehicles() {
        const view = document.querySelector("#vehiclesView");
        if (!view) return;
        renderVehicleDashboard();
        renderVehicleList();
        renderVehicleServices();
        renderVehicleOilChanges();
        renderVehicleParts();
        renderVehicleTaxes();
        renderVehicleExpenseFilters();
        renderVehicleExpenses();
      }

      function walletCard(wallet, compact = false) {
        const isMinus = Number(wallet.currentBalance || 0) < 0;
        return `
          <article class="wallet-card ${isMinus ? "negative" : ""}" data-open-wallet-detail="${wallet.id}" tabindex="0" role="button" aria-label="Buka detail dompet ${escapeHtml(wallet.name)}">
            <div>
              <span class="stat-label">${escapeHtml(wallet.type || "Dompet")}</span>
              <strong>${escapeHtml(wallet.name)}</strong>
              <span class="stat-sub">Saldo awal ${money(wallet.initialBalance || 0)}</span>
            </div>
            <div class="wallet-balance">
              <strong>${money(wallet.currentBalance || 0)}</strong>
              ${isMinus ? `<span class="pill expense">Minus</span>` : `<span class="pill income">Aktif</span>`}
            </div>
            ${compact ? "" : `
              <div class="row-actions wallet-actions">
                <button class="icon-button" type="button" data-edit-wallet="${wallet.id}" title="Edit dompet">${editIcon()}</button>
                <button class="icon-button danger" type="button" data-delete-wallet="${wallet.id}" title="Hapus dompet">${trashIcon()}</button>
              </div>
            `}
          </article>
        `;
      }

      function renderWallets() {
        recalculateWalletBalances();
        const total = state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0);
        const homeTarget = document.querySelector("#homeWalletList");
        if (homeTarget) {
          homeTarget.innerHTML = state.wallets.length
            ? state.wallets.slice(0, 4).map((wallet) => walletCard(wallet, true)).join("")
            : `<div class="empty"><p>Belum ada dompet.</p><button class="button primary" type="button" data-open-form="wallet">Tambah Dompet</button></div>`;
        }
        const walletTarget = document.querySelector("#walletList");
        if (walletTarget) {
          walletTarget.innerHTML = state.wallets.length
            ? state.wallets.map((wallet) => walletCard(wallet)).join("")
            : `<div class="empty"><p>Belum ada dompet.</p><button class="button primary" type="button" data-open-form="wallet">Tambah Dompet</button></div>`;
        }
        const totalLabel = document.querySelector("#walletTotalBalance");
        if (totalLabel) totalLabel.textContent = money(total);
        const countLabel = document.querySelector("#walletCount");
        if (countLabel) countLabel.textContent = String(state.wallets.length);
      }

      function renderFamilyMembers() {
        const target = document.querySelector("#familyMemberList");
        if (!target) return;
        if (isChildUser()) {
          target.innerHTML = `<div class="empty"><p>Akun child memiliki akses baca ke data keluarga dan tidak bisa mengelola anggota.</p></div>`;
          return;
        }
        const members = state.familyMembers || [];
        target.innerHTML = members.length
          ? members.map((member) => `
            <article class="debt-item">
              <div>
                <div class="debt-row-top">
                  <strong>${escapeHtml(member.childName || member.childEmail)}</strong>
                  <span class="pill ${member.status === "active" ? "income" : "debt"}">${member.status === "active" ? "Aktif" : "Nonaktif"}</span>
                </div>
                <span>${escapeHtml(member.childEmail)}</span>
                ${member.phone ? `<span>${escapeHtml(member.phone)}</span>` : ""}
              </div>
              <div class="row-actions">
                <button class="button" type="button" data-toggle-family-member="${member.id}">${member.status === "active" ? "Nonaktifkan" : "Aktifkan"}</button>
                <button class="button danger" type="button" data-delete-family-member="${member.id}">Hapus Akses</button>
              </div>
            </article>
          `).join("")
          : `<div class="empty"><p>Belum ada anggota keluarga.</p><button class="button primary" type="button" data-open-form="familyMember">Tambah Anggota</button></div>`;
      }

      function renderVehicleDashboard() {
        const targets = [document.querySelector("#vehicleDashboard"), document.querySelector("#homeVehicleDashboard")].filter(Boolean);
        if (!targets.length) return;
        if (!state.vehicles.length) {
          const empty = `<div class="empty"><p>Belum ada kendaraan.</p><button class="button primary" type="button" data-open-form="vehicle">Tambah Kendaraan</button></div>`;
          targets.forEach((target) => {
            target.innerHTML = empty;
          });
          return;
        }
        const rows = state.vehicles.map((vehicle) => {
          const oil = latestVehicleOil(vehicle.id);
          const part = nearestVehiclePart(vehicle.id);
          const service = nearestVehicleService(vehicle.id);
          const tax = vehicleTax(vehicle.id);
          const oilStatus = oil ? vehicleStatusBySchedule(oilNextDate(oil), oilNextKm(oil) - Number(vehicle.currentKm || 0)) : { label: "Belum ada oli", className: "debt" };
          const partStatus = part ? vehicleStatusBySchedule(partNextDate(part), partNextKm(part) - Number(vehicle.currentKm || 0)) : { label: "Belum ada part", className: "debt" };
          const taxStatus = tax ? vehicleStatusBySchedule(tax.annualDueDate) : { label: "Belum ada pajak", className: "debt" };
          return `
            <article class="stat-card vehicle-card">
              <div class="stat-label">${escapeHtml(vehicle.type || "Kendaraan")} ${vehicleBadge(taxStatus)}</div>
              <strong class="stat-value">${escapeHtml(vehicle.name)}</strong>
              <span class="stat-sub">${formatNumber(vehicle.currentKm || 0)} km - ${escapeHtml(vehicle.plate)}</span>
              <div class="compact-list">
                <span class="pill">Service: ${service ? escapeHtml(service.serviceDate) : "-"}</span>
                ${vehicleBadge(oilStatus)}
                ${vehicleBadge(partStatus)}
                <span class="pill">Pajak: ${tax?.annualDueDate || "-"}</span>
              </div>
              <div class="vehicle-costs">
                <span>Bulan ini <strong>${money(vehicleMonthlyTotal(vehicle.id))}</strong></span>
                <span>Tahun ini <strong>${money(vehicleYearTotal(vehicle.id))}</strong></span>
              </div>
            </article>
          `;
        }).join("");
        targets.forEach((target) => {
          target.innerHTML = rows;
        });
      }

      function renderVehicleList() {
        const target = document.querySelector("#vehicleList");
        if (!target) return;
        target.innerHTML = state.vehicles.length ? state.vehicles.map((vehicle) => `
          <article class="debt-row">
            <div class="debt-row-top">
              <div>
                <strong>${escapeHtml(vehicle.name)}</strong>
                <span>${escapeHtml(vehicle.brand || "-")} ${escapeHtml(vehicle.model || "")} - ${escapeHtml(vehicle.plate)}</span>
              </div>
              <div class="row-actions">
                <button class="icon-button" type="button" data-edit-vehicle="${vehicle.id}" title="Edit kendaraan">${editIcon()}</button>
                <button class="icon-button danger" type="button" data-delete-vehicle="${vehicle.id}" title="Hapus kendaraan">${trashIcon()}</button>
              </div>
            </div>
            <div class="compact-list">
              <span class="pill">${escapeHtml(vehicle.type || "-")}</span>
              <span class="pill">${escapeHtml(vehicle.transmission || "-")}</span>
              <span class="pill">${formatNumber(vehicle.currentKm || 0)} km</span>
              <span class="pill">Tahun ${escapeHtml(vehicle.year || "-")}</span>
            </div>
          </article>
        `).join("") : `<div class="empty"><p>Belum ada data kendaraan.</p></div>`;
      }

      function renderVehicleServices() {
        const target = document.querySelector("#vehicleServiceList");
        if (!target) return;
        target.innerHTML = state.vehicleServices.length ? [...state.vehicleServices].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)).map((item) => `
          <article class="debt-row">
            <div class="debt-row-top"><div><strong>${escapeHtml(item.serviceType)}</strong><span>${escapeHtml(vehicleName(item.vehicleId))} - ${escapeHtml(item.workshop || "-")}</span></div><span>${money(item.cost || 0)}</span></div>
            <div class="compact-list"><span class="pill">${escapeHtml(item.serviceDate)}</span><span class="pill">${formatNumber(item.serviceKm || 0)} km</span><button class="icon-button" type="button" data-edit-vehicle-record="vehicleServices" data-record-id="${item.id}" title="Edit service">${editIcon()}</button><button class="icon-button danger" type="button" data-delete-vehicle-record="vehicleServices" data-record-id="${item.id}" title="Hapus service">${trashIcon()}</button></div>
          </article>
        `).join("") : `<div class="empty"><p>Belum ada riwayat service.</p></div>`;
      }

      function renderVehicleOilChanges() {
        const target = document.querySelector("#vehicleOilList");
        if (!target) return;
        target.innerHTML = state.vehicleOilChanges.length ? [...state.vehicleOilChanges].sort((a, b) => oilNextDate(a).localeCompare(oilNextDate(b))).map((item) => {
          const vehicle = state.vehicles.find((entry) => entry.id === item.vehicleId);
          const status = vehicleStatusBySchedule(oilNextDate(item), oilNextKm(item) - Number(vehicle?.currentKm || 0));
          return `
            <article class="debt-row">
              <div class="debt-row-top"><div><strong>Ganti Oli ${escapeHtml(item.oilBrand || "")}</strong><span>${escapeHtml(vehicleName(item.vehicleId))}</span></div>${vehicleBadge(status)}</div>
              <div class="compact-list"><span class="pill">Berikutnya ${oilNextDate(item) || "-"}</span><span class="pill">${formatNumber(oilNextKm(item))} km</span><span class="pill">${money(item.cost || 0)}</span><button class="icon-button" type="button" data-edit-vehicle-record="vehicleOilChanges" data-record-id="${item.id}" title="Edit oli">${editIcon()}</button><button class="icon-button danger" type="button" data-delete-vehicle-record="vehicleOilChanges" data-record-id="${item.id}" title="Hapus oli">${trashIcon()}</button></div>
            </article>
          `;
        }).join("") : `<div class="empty"><p>Belum ada jadwal ganti oli.</p></div>`;
      }

      function renderVehicleParts() {
        const target = document.querySelector("#vehiclePartList");
        if (!target) return;
        target.innerHTML = state.vehicleParts.length ? [...state.vehicleParts].sort((a, b) => partNextDate(a).localeCompare(partNextDate(b))).map((item) => {
          const vehicle = state.vehicles.find((entry) => entry.id === item.vehicleId);
          const status = vehicleStatusBySchedule(partNextDate(item), partNextKm(item) - Number(vehicle?.currentKm || 0));
          return `
            <article class="debt-row">
              <div class="debt-row-top"><div><strong>${escapeHtml(item.partName)}</strong><span>${escapeHtml(vehicleName(item.vehicleId))}</span></div>${vehicleBadge(status)}</div>
              <div class="compact-list"><span class="pill">Berikutnya ${partNextDate(item) || "-"}</span><span class="pill">${formatNumber(partNextKm(item))} km</span><span class="pill">${money(item.cost || 0)}</span><button class="icon-button" type="button" data-edit-vehicle-record="vehicleParts" data-record-id="${item.id}" title="Edit part">${editIcon()}</button><button class="icon-button danger" type="button" data-delete-vehicle-record="vehicleParts" data-record-id="${item.id}" title="Hapus part">${trashIcon()}</button></div>
            </article>
          `;
        }).join("") : `<div class="empty"><p>Belum ada penggantian part.</p></div>`;
      }

      function renderVehicleTaxes() {
        const target = document.querySelector("#vehicleTaxList");
        if (!target) return;
        target.innerHTML = state.vehicleTaxes.length ? [...state.vehicleTaxes].sort((a, b) => a.annualDueDate.localeCompare(b.annualDueDate)).map((item) => {
          const status = vehicleStatusBySchedule(item.annualDueDate);
          return `
            <article class="debt-row">
              <div class="debt-row-top"><div><strong>Pajak ${escapeHtml(vehicleName(item.vehicleId))}</strong><span>Tahunan ${escapeHtml(item.annualDueDate)} - 5 tahunan ${escapeHtml(item.fiveYearDueDate || "-")}</span></div>${vehicleBadge(status)}</div>
              <div class="compact-list"><span class="pill">${item.status === "paid" ? "Sudah dibayar" : "Belum dibayar"}</span><span class="pill">${money(item.estimatedCost || 0)}</span><button class="icon-button" type="button" data-edit-vehicle-record="vehicleTaxes" data-record-id="${item.id}" title="Edit pajak">${editIcon()}</button><button class="icon-button danger" type="button" data-delete-vehicle-record="vehicleTaxes" data-record-id="${item.id}" title="Hapus pajak">${trashIcon()}</button></div>
            </article>
          `;
        }).join("") : `<div class="empty"><p>Belum ada data pajak kendaraan.</p></div>`;
      }

      function renderVehicleExpenseFilters() {
        const vehicleFilter = document.querySelector("#vehicleExpenseVehicleFilter");
        const monthFilter = document.querySelector("#vehicleExpenseMonthFilter");
        if (!vehicleFilter || !monthFilter) return;
        const currentVehicle = vehicleFilter.value;
        vehicleFilter.innerHTML = `<option value="">Semua Kendaraan</option>${vehicleOptions(currentVehicle)}`;
        vehicleFilter.value = currentVehicle;
        if (!monthFilter.value) monthFilter.value = currentMonthKey();
      }

      function renderVehicleExpenses() {
        const vehicleId = document.querySelector("#vehicleExpenseVehicleFilter")?.value || "";
        const month = document.querySelector("#vehicleExpenseMonthFilter")?.value || currentMonthKey();
        const type = document.querySelector("#vehicleExpenseTypeFilter")?.value || "";
        const year = month.slice(0, 4);
        const rows = vehicleTransactions().filter((item) => {
          return (!vehicleId || item.vehicleId === vehicleId)
            && (!type || item.subcategory === type)
            && (!month || monthOf(item) === month);
        });
        const yearRows = vehicleTransactions().filter((item) => (!vehicleId || item.vehicleId === vehicleId) && item.date?.startsWith(year));
        const yearTotal = yearRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const monthTotal = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const maxCost = yearRows.reduce((max, item) => Math.max(max, Number(item.amount || 0)), 0);
        document.querySelector("#vehicleMonthTotal").textContent = money(monthTotal);
        document.querySelector("#vehicleYearTotal").textContent = money(yearTotal);
        document.querySelector("#vehicleAverageTotal").textContent = money(Math.round(yearTotal / 12));
        document.querySelector("#vehicleMaxTotal").textContent = money(maxCost);
        document.querySelector("#vehicleExpenseList").innerHTML = rows.length ? `
          <table>
            <thead><tr><th>Tanggal</th><th>Kendaraan</th><th>Jenis</th><th>Catatan</th><th>Nominal</th></tr></thead>
            <tbody>${rows.sort((a, b) => b.date.localeCompare(a.date)).map((item) => `
              <tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(vehicleName(item.vehicleId))}</td><td>${escapeHtml(item.subcategory || "Lainnya")}</td><td>${escapeHtml(item.description || "-")}</td><td>${money(item.amount)}</td></tr>
            `).join("")}</tbody>
          </table>
        ` : `<div class="empty"><p>Belum ada pengeluaran kendaraan pada filter ini.</p></div>`;
      }

      function renderInsights() {
        const month = currentMonthKey();
        const previousMonth = previousMonthKey(month);
        const currentItems = transactionsByMonth(month);
        const previousItems = transactionsByMonth(previousMonth);
        const currentExpense = sumTransactions(currentItems, "expense");
        const currentIncome = sumTransactions(currentItems, "income");
        const savingsAdded = state.savings.reduce((sum, goal) => {
          return sum + (goal.entries || [])
            .filter((entry) => entry.type === "deposit" && monthOf(entry) === month)
            .reduce((entrySum, entry) => entrySum + Number(entry.amount || 0), 0);
        }, 0);
        const insights = [];

        const categoryTotals = categories
          .map((category) => ({ category, total: expenseForCategory(category, month) }))
          .filter((item) => item.total > 0)
          .sort((a, b) => b.total - a.total);
        if (categoryTotals.length) {
          insights.push({
            title: "Kategori terbesar bulan ini",
            text: `${categoryTotals[0].category} adalah kategori pengeluaran terbesar dengan total ${money(categoryTotals[0].total)}.`,
            tone: "debt",
            category: categoryTotals[0].category,
          });
        }

        categories.forEach((category) => {
          const current = expenseForCategory(category, month);
          const previous = previousItems
            .filter((item) => item.type === "expense" && item.category === category)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
          if (current > 0 && previous > 0) {
            const change = ((current - previous) / previous) * 100;
            if (Math.abs(change) >= 20) {
              insights.push({
                title: `Pengeluaran ${category}`,
                text: `Pengeluaran ${category.toLowerCase()} bulan ini ${change > 0 ? "naik" : "turun"} ${Math.abs(change).toFixed(0)}% dari bulan lalu.`,
                tone: change > 0 ? "expense" : "income",
                category,
              });
            }
          }
        });

        if (currentIncome > 0) {
          const percent = Math.round((savingsAdded / currentIncome) * 100);
          insights.push({
            title: "Rasio tabungan",
            text: savingsAdded > 0 ? `Kamu berhasil menabung ${percent}% dari pemasukan bulan ini.` : "Belum ada setoran tabungan dari pemasukan bulan ini.",
            tone: savingsAdded > 0 ? "income" : "debt",
          });
        }

        activeBudgets("expense").filter((budget) => !budget.parentId).forEach((budget) => {
          const spent = budgetUsedAmount(budget, month);
          const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
          const percent = limit ? Math.round((spent / limit) * 100) : 0;
          if (percent >= 80) {
            insights.push({
              title: `Budget ${budget.name}`,
              text: `Budget ${budget.name.toLowerCase()} sudah terpakai ${percent}%.`,
              tone: percent >= 100 ? "expense" : "debt",
            });
          }
        });

        if (!insights.length) {
          insights.push({
            title: "Belum cukup data",
            text: "Tambahkan transaksi, budget, dan tabungan agar insight otomatis semakin akurat.",
            tone: "debt",
          });
        }

        document.querySelector("#insightList").innerHTML = insights.slice(0, 5).map((item) => `
          <article class="debt-row ${item.category ? "clickable-row" : ""}" ${item.category ? `data-insight-category="${escapeHtml(item.category)}"` : ""}>
            <div class="debt-row-top">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="pill ${item.tone}">Insight</span>
            </div>
            <p style="margin-top: 7px; color: var(--muted); font-size: .92rem">${escapeHtml(item.text)}</p>
          </article>
        `).join("");
      }

      function transactionsSince(days) {
        const start = new Date(`${todayDate()}T00:00:00`);
        start.setDate(start.getDate() - Number(days || 0));
        const startKey = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        return state.transactions.filter((item) => item.date >= startKey && item.date <= todayDate());
      }

      function categoryGrowthActions(month = currentMonthKey()) {
        const previousMonth = previousMonthKey(month);
        return categories
          .map((category) => {
            const current = expenseForCategory(category, month);
            const previous = transactionsByMonth(previousMonth)
              .filter((item) => item.type === "expense" && item.category === category)
              .reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
            return { category, current, previous, change };
          })
          .filter((item) => item.current > item.previous && item.previous > 0 && item.change >= 30)
          .sort((a, b) => b.change - a.change);
      }

      function budgetSuggestionAction(month = currentMonthKey()) {
        const budgetRows = activeBudgets("expense").filter((budget) => !budget.parentId)
          .map((budget) => {
            const spent = budgetUsedAmount(budget, month);
            const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
            const percent = limit ? Math.round((spent / limit) * 100) : 0;
            return { category: budget.name || budget.category, spent, limit, percent };
          })
          .filter((item) => item.spent > 0)
          .sort((a, b) => b.percent - a.percent || b.spent - a.spent);
        if (!budgetRows.length) {
          const topCategory = categories
            .map((category) => ({ category, spent: expenseForCategory(category, month) }))
            .filter((item) => item.spent > 0)
            .sort((a, b) => b.spent - a.spent)[0];
          if (!topCategory) return null;
          const suggestedLimit = Math.ceil((topCategory.spent * 1.1) / 10000) * 10000;
          return {
            title: "Saran budget bulan depan",
            text: `Mulai buat budget ${topCategory.category} sekitar ${money(suggestedLimit)} berdasarkan pemakaian bulan ini.`,
            tone: "debt",
          };
        }
        const target = budgetRows[0];
        const suggested = Math.ceil(Math.max(target.spent * 1.1, target.limit || target.spent) / 10000) * 10000;
        return {
          title: "Saran budget bulan depan",
          text: target.limit
            ? `Kategori ${target.category} sudah terpakai ${target.percent}%. Pertimbangkan budget sekitar ${money(suggested)} bulan depan.`
            : `Mulai buat budget ${target.category} sekitar ${money(suggested)} berdasarkan pemakaian bulan ini.`,
          tone: target.percent >= 100 ? "expense" : "debt",
        };
      }

      function upcomingBillAction() {
        const bills = state.billReminders
          .filter((item) => item.status !== "paid" && item.dueDate)
          .map((item) => ({ ...item, days: daysUntil(item.dueDate) }))
          .filter((item) => item.days <= 7)
          .sort((a, b) => a.days - b.days);
        if (!bills.length) return null;
        const bill = bills[0];
        const label = bill.days < 0 ? `terlambat ${Math.abs(bill.days)} hari` : bill.days === 0 ? "jatuh tempo hari ini" : `${bill.days} hari lagi`;
        return {
          title: "Tagihan mendekati jatuh tempo",
          text: `${bill.title} ${label} dengan nominal ${money(bill.amount)}.`,
          tone: bill.days < 0 ? "expense" : "debt",
        };
      }

      function vehicleAttentionAction() {
        const actions = [];
        state.vehicles.forEach((vehicle) => {
          const oil = latestVehicleOil(vehicle.id);
          const part = nearestVehiclePart(vehicle.id);
          const tax = vehicleTax(vehicle.id);
          const checks = [
            oil ? { label: "ganti oli", status: vehicleStatusBySchedule(oilNextDate(oil), oilNextKm(oil) - Number(vehicle.currentKm || 0)) } : null,
            part ? { label: `ganti ${part.partName || "part"}`, status: vehicleStatusBySchedule(partNextDate(part), partNextKm(part) - Number(vehicle.currentKm || 0)) } : null,
            tax ? { label: "pajak tahunan", status: vehicleStatusBySchedule(tax.annualDueDate) } : null,
          ].filter(Boolean);
          checks
            .filter((item) => item.status.className === "danger" || item.status.className === "warn")
            .forEach((item) => actions.push({ vehicle, ...item }));
        });
        if (!actions.length) return null;
        const priority = actions.sort((a, b) => (a.status.className === "danger" ? -1 : 1) - (b.status.className === "danger" ? -1 : 1))[0];
        return {
          title: "Kendaraan butuh perhatian",
          text: `${priority.vehicle.name} perlu cek ${priority.label}. Status: ${priority.status.label}.`,
          tone: priority.status.className === "danger" ? "expense" : "debt",
        };
      }

      function renderActionSummary() {
        const weeklyExpenses = transactionsSince(6)
          .filter((item) => item.type === "expense")
          .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
        const growth = categoryGrowthActions()[0];
        const budgetSuggestion = budgetSuggestionAction();
        const upcomingBill = upcomingBillAction();
        const vehicleAttention = vehicleAttentionAction();
        const actions = [];

        if (weeklyExpenses.length) {
          const expense = weeklyExpenses[0];
          actions.push({
            title: "Pengeluaran terbesar minggu ini",
            text: `${expense.description || expense.category} sebesar ${money(expense.amount)} pada ${expense.date}.`,
            tone: "expense",
          });
        }

        if (growth) {
          actions.push({
            title: "Kategori naik drastis",
            text: `${growth.category} naik ${growth.change.toFixed(0)}% dari bulan lalu, dari ${money(growth.previous)} menjadi ${money(growth.current)}.`,
            tone: "expense",
          });
        }

        [budgetSuggestion, upcomingBill, vehicleAttention].filter(Boolean).forEach((item) => actions.push(item));

        if (!actions.length) {
          actions.push({
            title: "Belum ada prioritas mendesak",
            text: "Data masih aman. Tambahkan transaksi, budget, reminder tagihan, atau data kendaraan agar ringkasan tindakan semakin akurat.",
            tone: "income",
          });
        }

        const target = document.querySelector("#actionSummaryList");
        if (!target) return;
        target.innerHTML = actions.slice(0, 5).map((item) => `
          <article class="action-summary-card">
            <div class="debt-row-top">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="pill ${item.tone}">Aksi</span>
            </div>
            <p>${escapeHtml(item.text)}</p>
          </article>
        `).join("");
      }

      function renderBillReminders() {
        const reminders = [...state.billReminders].sort((a, b) => {
          if (a.status !== b.status) return a.status === "unpaid" ? -1 : 1;
          return (a.dueDate || "").localeCompare(b.dueDate || "");
        });
        const visible = reminders.slice(0, 5);
        document.querySelector("#billReminderSummary").textContent = reminders.length
          ? `${reminders.filter((item) => item.status !== "paid").length} tagihan belum lunas.`
          : "Belum ada tagihan.";
        document.querySelector("#billReminderList").innerHTML = visible.length
          ? visible.map((item) => `
            <article class="debt-row">
              <div class="debt-row-top">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${money(item.amount)}</span>
              </div>
              <p style="margin-top: 7px; color: var(--muted); font-size: .9rem">${escapeHtml(item.note || item.category || "-")}</p>
              <div class="tags" style="display:flex; flex-wrap:wrap; gap:7px; margin-top:10px">
                <span class="pill debt">Jatuh tempo ${escapeHtml(item.dueDate || "-")}</span>
                <span class="pill">${escapeHtml(item.category || "Tagihan")}</span>
                <span class="pill ${item.status === "paid" ? "income" : "expense"}">${item.status === "paid" ? "Lunas" : "Belum lunas"}</span>
                <button class="button" type="button" data-toggle-bill="${item.id}">${item.status === "paid" ? "Batal Lunas" : "Tandai Lunas"}</button>
                <button class="icon-button" type="button" title="Edit tagihan" data-edit-bill="${item.id}">${editIcon()}</button>
                <button class="icon-button" type="button" title="Hapus tagihan" data-delete-bill="${item.id}">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </article>
          `).join("")
          : `<div class="empty"><p>Belum ada reminder tagihan.</p><button class="button primary" type="button" data-open-form="billReminder">Tambah Tagihan</button></div>`;
      }

      function renderDebts() {
        const list = document.querySelector("#debtList");
        const activeDebts = state.debts.filter((item) => item.status !== "paid");
        if (!activeDebts.length) {
          list.innerHTML = `<div class="empty"><p>Belum ada hutang piutang.</p></div>`;
          return;
        }

        list.innerHTML = activeDebts
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((item) => `
            <article class="debt-row">
              <div class="debt-row-top">
                <strong>${escapeHtml(item.person)} - ${item.kind === "receivable" ? "Piutang" : "Hutang"}</strong>
                <span>${money(item.remainingAmount ?? item.amount)}</span>
              </div>
              <p style="margin-top: 7px; color: var(--muted); font-size: .9rem">${escapeHtml(item.description)}</p>
              <div class="debt-payment-summary">
                <span>Total ${money(item.totalAmount ?? item.amount)}</span>
                <span>${item.kind === "receivable" ? "Sudah diterima" : "Sudah dibayar"} ${money(item.paidAmount || 0)}</span>
                <span>Sisa ${money(item.remainingAmount ?? item.amount)}</span>
              </div>
              ${debtPaymentHistoryHtml(item)}
              <div class="tags" style="display:flex; flex-wrap:wrap; gap:7px; margin-top:10px">
                <span class="pill debt">Tanggal ${escapeHtml(item.date)}</span>
                <span class="pill debt">Jatuh tempo ${escapeHtml(item.dueDate || "-")}</span>
                <span class="pill ${item.status === "partial" ? "debt" : item.status === "paid" ? "income" : "expense"}">${item.status === "partial" ? "Sebagian" : item.status === "paid" ? "Lunas" : "Belum lunas"}</span>
                <button class="icon-button" type="button" title="Ubah status" data-toggle-debt="${item.id}">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button class="icon-button" type="button" title="Hapus hutang piutang" data-delete-debt="${item.id}">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </article>
          `).join("");
      }

      function debtPaymentHistoryHtml(debt) {
        const payments = debtPaymentTransactions(debt.id).sort((a, b) => b.date.localeCompare(a.date));
        if (!payments.length) return "";
        const title = debt.kind === "receivable" ? "Riwayat Penerimaan" : "Riwayat Pembayaran";
        return `
          <div class="debt-payment-history">
            <strong>${title}</strong>
            ${payments.map((payment) => `
              <span>${escapeHtml(transactionDateLabel(payment.date))} - ${money(payment.amount)} - ${escapeHtml(walletName(payment.walletId))}</span>
            `).join("")}
          </div>
        `;
      }

      function renderMonthOptions() {
        const select = document.querySelector("#monthFilter");
        const months = [...new Set(state.transactions.map(monthOf))].sort().reverse();
        select.innerHTML = `<option value="all">Semua bulan</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
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
        const month = document.querySelector("#monthFilter")?.value === "all" ? currentMonthKey() : document.querySelector("#monthFilter").value;
        const data = categories.map((category) => ({ category, spent: expenseForCategory(category, month) })).filter((item) => item.spent > 0);
        const max = Math.max(...data.map((item) => item.spent), 1);
        document.querySelector("#categoryBreakdown").innerHTML = data.length
          ? data.map((item) => `
              <article class="category-row">
                <div class="category-row-top">
                  <strong>${escapeHtml(item.category)}</strong>
                  <span>${money(item.spent)}</span>
                </div>
                <div class="progress"><i style="width: ${Math.round((item.spent / max) * 100)}%"></i></div>
              </article>
            `).join("")
          : `<div class="empty"><p>Belum ada pengeluaran pada bulan ini.</p></div>`;
      }

      function renderDailyExpenses() {
        const monthFilter = document.querySelector("#monthFilter")?.value || "all";
        const today = todayDate();
        const dailyDateLabel = (date) => new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date(`${date}T00:00:00`));
        const rows = state.transactions
          .filter((item) => item.type === "expense")
          .filter((item) => !showAllDailyExpenses || monthFilter === "all" || monthOf(item) === monthFilter)
          .reduce((summary, item) => {
            if (!summary[item.date]) summary[item.date] = { date: item.date, count: 0, total: 0, transactions: [] };
            summary[item.date].count += 1;
            summary[item.date].total += Number(item.amount || 0);
            summary[item.date].transactions.push(item);
            return summary;
          }, {});

        const allData = Object.values(rows).sort((a, b) => b.date.localeCompare(a.date));
        const data = showAllDailyExpenses ? allData : allData.filter((item) => item.date === today);
        const button = document.querySelector("#showAllDailyExpensesButton");
        const subtitle = document.querySelector("#dailyExpenseSubtitle");
        if (button) {
          button.classList.toggle("hidden", showAllDailyExpenses || allData.length <= data.length);
        }
        if (subtitle) {
          subtitle.textContent = showAllDailyExpenses
            ? "Semua tanggal pengeluaran yang tercatat."
            : `Pengeluaran hari ini, ${dailyDateLabel(today)}.`;
        }
        document.querySelector("#dailyExpenseList").innerHTML = data.length
          ? `
            <div class="daily-expense-list">
              ${data.map((item) => `
                <article class="daily-expense-group">
                  <header class="daily-expense-header">
                    <strong>${escapeHtml(dailyDateLabel(item.date))}</strong>
                    <span>-${money(item.total)}</span>
                  </header>
                  <div class="daily-expense-transactions">
                    ${item.transactions
                      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
                      .map((transaction) => {
                        const title = transaction.description?.trim() || transaction.category || "Transaksi";
                        return `
                          <div class="daily-expense-transaction">
                            <div class="daily-expense-icon" aria-hidden="true">
                              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                                <path d="M3 7.5h18v9H3v-9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                                <path d="M7 10.5h2.5M7 13.5h4M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                                <path d="M5 6V5h16v9h-1M3 16.5V18h16v-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                              </svg>
                            </div>
                            <div class="daily-expense-detail">
                              <strong>${escapeHtml(title)}</strong>
                              <span>${escapeHtml(transaction.category || "Lainnya")}</span>
                            </div>
                            <span class="daily-expense-amount">${money(transaction.amount)}</span>
                          </div>
                        `;
                      }).join("")}
                  </div>
                </article>
              `).join("")}
            </div>
          `
          : `<div class="empty"><p>${showAllDailyExpenses ? "Belum ada pengeluaran untuk ditampilkan." : "Belum ada transaksi hari ini."}</p></div>`;
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
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </article>
        `).join("");
      }

      function normalizeHomeSectionOrder(order) {
        const configured = Array.isArray(order) ? order : [];
        return [...new Set([...configured, ...defaultHomeSectionOrder])].filter((section) => defaultHomeSectionOrder.includes(section));
      }

      function renderDashboardMenuOrder() {
        const dashboard = document.querySelector("#dashboardSections");
        if (!dashboard) return;
        const sectionMap = new Map([...dashboard.querySelectorAll("[data-home-section]")].map((section) => [section.dataset.homeSection, section]));
        const orderedSections = normalizeHomeSectionOrder(state.settings.homeSectionOrder);
        state.settings.homeSectionOrder = orderedSections;
        for (const section of orderedSections) {
          const element = sectionMap.get(section);
          if (element) dashboard.appendChild(element);
        }
      }

      function dashboardSectionLabel(section) {
        const labels = {
          wallets: "Saldo Dompet",
          insight: "Insight",
          latestTransactions: "Transaksi Terbaru",
        };
        return labels[section] || section;
      }

      function renderAccount() {
        if (!currentUser) return;
        document.querySelector("#profilePhoto").textContent = currentUser.name.slice(0, 1).toUpperCase();
        document.querySelector("#profileName").textContent = currentUser.name;
        document.querySelector("#profileEmail").textContent = currentUser.email;
        document.querySelector("#profileRole").textContent = isGuest() ? "Tamu" : isChildUser() ? "Anggota Keluarga" : currentUser.role === "admin" ? "Admin" : "User";
        document.querySelector("#profilePinStatus").textContent = state.settings.pin ? "PIN aktif" : "PIN belum aktif";
        document.querySelector("#profileSyncStatus").textContent = isGuest() ? "Demo" : cloudSync.enabled ? "Cloud" : "Lokal";
        const topSyncBadge = document.querySelector("#topSyncBadge");
        if (topSyncBadge) {
          topSyncBadge.textContent = isGuest() ? "Demo" : syncStatusText();
          topSyncBadge.className = `sync-badge ${state.syncStatus === "failed" || cloudSync.lastError ? "error" : state.syncStatus === "pending" ? "pending" : ""}`;
        }
        document.querySelector("#appVersionLabel").textContent = `v${appVersion}`;
        document.querySelector("#darkModeToggle").checked = Boolean(state.settings.darkMode);
        document.querySelector("#cloudSyncToggle").checked = state.settings.cloudSyncEnabled !== false;
        document.querySelector("#languageSelect").value = currentLanguage();
        document.querySelector("#syncStatus").textContent = isGuest() ? "Mode tamu aktif. Login atau registrasi untuk menyimpan data." : syncStatusText();
        document.querySelector("#syncNowButton").disabled = isGuest() || !isCloudSyncAllowed() || cloudSync.isSaving;
        document.querySelector("#reminderStatus").textContent = state.settings.reminderEnabled ? `Aktif pukul ${state.settings.reminderTime}` : "Belum aktif";
        document.querySelector("#walletSummary").textContent = state.wallets.length
          ? `${state.wallets.length} dompet, total ${money(state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0))}`
          : "Belum ada dompet";
        document.querySelector("#categorySummary").textContent = `${categories.length} kategori aktif`;
        document.querySelector("#dashboardMenuSummary").textContent = state.settings.homeSectionOrder.map(dashboardSectionLabel).join(", ");
        document.querySelector("#pinSummary").textContent = state.settings.pin ? "PIN sudah disimpan di perangkat ini." : "PIN belum aktif.";
        document.querySelector("#familySummary").textContent = isChildUser()
          ? "Akun child hanya bisa melihat data keluarga."
          : `${state.familyMembers.filter((member) => member.status === "active").length} anggota aktif`;
        renderFamilyMembers();
        document.querySelectorAll("[data-admin-only]").forEach((element) => {
          element.disabled = !isAdmin();
          element.title = isAdmin() ? "" : "Hanya admin";
        });
        document.querySelector("#loadDemoButton").classList.toggle("hidden", !isGuest());
        document.querySelector("#deleteAccountButton").disabled = isGuest() || isChildUser();
        document.querySelectorAll('[data-open-form="familyMember"]').forEach((button) => {
          button.disabled = isChildUser();
          button.title = isChildUser() ? "Hanya akun utama yang bisa mengelola anggota keluarga." : "";
        });
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
        renderDailyExpenses();
        renderRecurring();
        renderAccount();
      }

      function updateBackButton(view) {
        const backButton = document.querySelector("#backButton");
        if (!backButton) return;
        backButton.classList.toggle("hidden", view === "home");
      }

      function navViewFor(view) {
        if (["finance", "wallets", "walletDetail", "budgets", "savings", "balanceSheet", "analytics"].includes(view)) return "finance";
        if (["vehicles"].includes(view)) return "vehicles";
        if (["reports"].includes(view)) return "reports";
        return view;
      }

      function openView(view, options = {}) {
        const targetView = document.querySelector(`#${view}View`);
        if (!targetView) return;
        const previousView = activeView();
        if (!options.fromBack && !options.replace && previousView !== view) {
          viewHistory.push(previousView);
        }
        document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
        targetView.classList.add("active");
        const activeNav = navViewFor(view);
        document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeNav));
        const copy = currentPageCopy(view);
        document.querySelector("#pageHeading").textContent = copy[0];
        document.querySelector("#pageSubtitle").textContent = copy[1];
        updateBackButton(view);
        document.querySelector("#addBlock").classList.remove("open");
      }

      function goBackView() {
        const previousView = viewHistory.pop() || "home";
        openView(previousView, { fromBack: true });
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
                <select id="transactionCategory">${categories.map((category) => `<option value="${category}" ${category === selectedCategory ? "selected" : ""}>${category}</option>`).join("")}</select>
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
          const budgetType = isReceivablePayment || selected === "income" ? "income" : "expense";
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
          openView("budgets");
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
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <button class="icon-button" type="button" title="Hapus hutang piutang" data-delete-debt="${item.id}">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
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
                <select id="recurringCategory">${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select>
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

      function openBillReminderForm(reminderId = "") {
        if (!requirePrimaryAccount()) return;
        const editing = reminderId ? state.billReminders.find((item) => item.id === reminderId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Reminder Tagihan" : "Tambah Reminder Tagihan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="billReminderForm">
            <div class="field">
              <label for="billTitle">Nama tagihan</label>
              <input id="billTitle" type="text" value="${escapeHtml(editing?.title || "")}" placeholder="Contoh: Internet, listrik, cicilan" required />
            </div>
            <div class="field">
              <label for="billCategory">Kategori</label>
              <select id="billCategory">
                ${categories.map((category) => `<option value="${category}" ${category === editing?.category ? "selected" : ""}>${category}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="billAmount">Nominal</label>
              ${rupiahInputHtml("billAmount", editing?.amount ?? "", "required")}
            </div>
            <div class="field">
              <label for="billDueDate">Jatuh tempo</label>
              <input id="billDueDate" type="date" value="${editing?.dueDate || todayDate()}" required />
            </div>
            <div class="field">
              <label for="billNote">Catatan</label>
              <input id="billNote" type="text" value="${escapeHtml(editing?.note || "")}" placeholder="Opsional" />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan"}</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#billAmount");
        document.querySelector("#billReminderForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const values = {
            title: document.querySelector("#billTitle").value.trim(),
            category: document.querySelector("#billCategory").value,
            amount: parseFormattedNumber(document.querySelector("#billAmount").value),
            dueDate: document.querySelector("#billDueDate").value,
            note: document.querySelector("#billNote").value.trim(),
          };
          if (values.amount <= 0) return alert("Nominal reminder tagihan wajib lebih dari 0.");
          if (editing) Object.assign(editing, values);
          else state.billReminders.push(billReminder(values.title, values.category, values.amount, values.dueDate, values.note, "unpaid"));
          closeModal();
          await persistChanges("Reminder tagihan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
      }

      function openWalletForm(walletId = "") {
        if (!requirePrimaryAccount()) return;
        const editing = walletId ? state.wallets.find((wallet) => wallet.id === walletId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Dompet" : "Tambah Dompet";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="walletForm">
            <div class="form-grid">
              <div class="field">
                <label for="walletName">Nama dompet</label>
                <input id="walletName" type="text" value="${escapeHtml(editing?.name || "")}" placeholder="Contoh: Cash, Bank BCA, Dana" required />
              </div>
              <div class="field">
                <label for="walletType">Tipe dompet</label>
                <select id="walletType" required>
                  ${["Cash", "Bank", "E-Wallet", "Savings"].map((type) => `<option value="${type}" ${editing?.type === type ? "selected" : ""}>${type}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="field">
              <label for="walletInitialBalance">Saldo awal</label>
              ${rupiahInputHtml("walletInitialBalance", editing?.initialBalance ?? "")}
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Tambah Dompet"}</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#walletInitialBalance");
        document.querySelector("#walletForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const name = document.querySelector("#walletName").value.trim();
          const initialBalanceValue = document.querySelector("#walletInitialBalance").value.trim();
          const initialBalance = initialBalanceValue ? parseFormattedNumber(initialBalanceValue) : 0;
          const type = document.querySelector("#walletType").value;
          if (!name) return alert("Nama dompet wajib diisi.");
          if (Number.isNaN(initialBalance) || initialBalance < 0) return alert("Saldo awal harus angka valid dan tidak boleh negatif jika diisi.");
          const duplicate = state.wallets.some((wallet) => wallet.id !== editing?.id && wallet.name.toLowerCase() === name.toLowerCase());
          if (duplicate) return alert("Nama dompet sudah digunakan.");
          if (editing) {
            Object.assign(editing, { name, initialBalance, type, userId: editing.userId || currentUserId(), updatedAt: new Date().toISOString() });
          } else {
            state.wallets.push(walletRecord(name, initialBalance, type));
          }
          closeModal();
          await persistChanges(editing ? "Dompet diperbarui di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun." : "Dompet dibuat di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          showSnackbar(editing ? "Dompet berhasil diperbarui." : "Dompet berhasil dibuat.");
        });
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
                      <button class="button" type="button" data-menu-up="${section}" ${index === 0 ? "disabled" : ""}>↑</button>
                      <button class="button" type="button" data-menu-down="${section}" ${index === order.length - 1 ? "disabled" : ""}>↓</button>
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
              <div class="debt-list">
                ${categories.map((category) => `
                  <article class="debt-item">
                    <div>
                      <strong>${escapeHtml(category)}</strong>
                    </div>
                    <button class="icon-button" type="button" title="Hapus kategori" data-delete-category="${escapeHtml(category)}">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </article>
                `).join("")}
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

      function targetDateFromShortcut(months) {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      }

      function openSavingsGoalForm(goalId = "") {
        if (!requirePrimaryAccount()) return;
        const editing = goalId ? state.savings.find((item) => item.id === goalId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Tujuan Tabungan" : "Tambah Tujuan Tabungan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="savingsGoalForm">
            <div class="field">
              <label for="savingsCategory">Kategori</label>
              <select id="savingsCategory" required>
                ${savingCategories.map((category) => `<option value="${category}" ${category === editing?.category ? "selected" : ""}>${category}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="savingsTarget">Nominal Target</label>
              ${rupiahInputHtml("savingsTarget", editing?.target ?? "", "required")}
            </div>
            <div class="field">
              <label for="savingsTargetDate">Kapan ingin dicapai</label>
              <input id="savingsTargetDate" type="date" value="${editing?.targetDate || targetDateFromShortcut(12)}" required />
            </div>
            <div class="compact-list">
              <button class="button" type="button" data-target-months="6">6 Bulan</button>
              <button class="button" type="button" data-target-months="12">1 Tahun</button>
              <button class="button" type="button" data-target-months="24">2 Tahun</button>
              <button class="button" type="button" data-target-months="60">5 Tahun</button>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan"}</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#savingsTarget");
        document.querySelectorAll("[data-target-months]").forEach((button) => {
          button.addEventListener("click", () => {
            document.querySelector("#savingsTargetDate").value = targetDateFromShortcut(Number(button.dataset.targetMonths));
          });
        });
        document.querySelector("#savingsGoalForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#savingsGoalForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          const category = document.querySelector("#savingsCategory").value;
          const targetAmount = parseFormattedNumber(document.querySelector("#savingsTarget").value);
          if (targetAmount <= 0) {
            submitButton.disabled = false;
            submitButton.textContent = editing ? "Simpan Perubahan" : "Simpan";
            return alert("Nominal target tabungan wajib lebih dari 0.");
          }
          if (editing) {
            editing.title = category;
            editing.category = category;
            editing.target = targetAmount;
            editing.targetDate = document.querySelector("#savingsTargetDate").value;
            touchSavingsGoal(editing);
          } else {
            state.savings.push(savingsGoal(category, targetAmount, document.querySelector("#savingsTargetDate").value));
          }
          saveState();
          closeModal();
          await persistChanges("Tujuan tabungan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openView("savings");
          showSnackbar(editing ? "Tujuan tabungan berhasil diperbarui." : "Tujuan tabungan berhasil disimpan.");
        });
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
        if (!requirePrimaryAccount()) return;
        const goal = state.savings.find((item) => item.id === goalId);
        if (!goal) return;
        document.querySelector("#modalTitle").textContent = type === "withdraw" ? "Tarik Tabungan" : "Tambah Tabungan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="savingsEntryForm">
            <div class="field">
              <label for="savingsEntryAmount">Nominal</label>
              ${rupiahInputHtml("savingsEntryAmount", "", "required")}
            </div>
            <div class="field">
              <label for="savingsEntryNote">Keterangan</label>
              <input id="savingsEntryNote" type="text" placeholder="Contoh: Setoran gaji" required />
            </div>
            <div class="field">
              <label for="savingsEntryDate">Tanggal</label>
              <input id="savingsEntryDate" type="date" value="${todayDate()}" required />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#savingsEntryAmount");
        document.querySelector("#savingsEntryForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#savingsEntryForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          const amount = parseFormattedNumber(document.querySelector("#savingsEntryAmount").value);
          if (amount <= 0) {
            submitButton.disabled = false;
            submitButton.textContent = "Simpan";
            return alert("Nominal tabungan wajib lebih dari 0.");
          }
          goal.entries = goal.entries || [];
          goal.entries.push(savingsEntry(type, document.querySelector("#savingsEntryDate").value, amount, document.querySelector("#savingsEntryNote").value.trim()));
          touchSavingsGoal(goal);
          saveState();
          closeModal();
          await persistChanges("Perubahan tabungan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openSavingsDetail(goal.id);
          showSnackbar("Perubahan tabungan berhasil disimpan.");
        });
      }

      function openVehicleForm(vehicleId = "") {
        if (!requirePrimaryAccount()) return;
        const editing = vehicleId ? state.vehicles.find((item) => item.id === vehicleId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Kendaraan" : "Tambah Kendaraan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehicleForm">
            <details class="form-step" open>
              <summary>1. Identitas kendaraan</summary>
              <div class="form-grid">
                <div class="field"><label for="vehicleName">Nama kendaraan</label><input id="vehicleName" required value="${escapeHtml(editing?.name || "")}" placeholder="Contoh: Avanza Putih" /></div>
                <div class="field"><label for="vehiclePlate">Nomor plat</label><input id="vehiclePlate" required value="${escapeHtml(editing?.plate || "")}" placeholder="B 1234 ABC" /></div>
              </div>
            </details>
            <details class="form-step">
              <summary>2. Detail kendaraan</summary>
              <div class="form-grid">
                <div class="field"><label for="vehicleBrand">Merk</label><input id="vehicleBrand" value="${escapeHtml(editing?.brand || "")}" placeholder="Toyota" /></div>
                <div class="field"><label for="vehicleModel">Model</label><input id="vehicleModel" value="${escapeHtml(editing?.model || "")}" placeholder="Avanza" /></div>
              </div>
              <div class="form-grid">
                <div class="field"><label for="vehicleYear">Tahun</label><input id="vehicleYear" type="number" min="1900" max="2100" value="${escapeHtml(editing?.year || "")}" placeholder="2020" /></div>
                <div class="field"><label for="vehicleType">Jenis kendaraan</label><select id="vehicleType"><option ${editing?.type === "Mobil" ? "selected" : ""}>Mobil</option><option ${editing?.type === "Motor" ? "selected" : ""}>Motor</option></select></div>
              </div>
            </details>
            <details class="form-step">
              <summary>3. Kilometer dan catatan</summary>
              <div class="form-grid">
                <div class="field"><label for="vehicleTransmission">Transmisi</label><input id="vehicleTransmission" value="${escapeHtml(editing?.transmission || "")}" placeholder="Manual / Matic" /></div>
                <div class="field"><label for="vehicleCurrentKm">Kilometer saat ini</label><input id="vehicleCurrentKm" type="number" min="0" value="${editing?.currentKm ?? 0}" required /></div>
              </div>
              <div class="field"><label for="vehiclePurchaseDate">Tanggal pembelian</label><input id="vehiclePurchaseDate" type="date" value="${editing?.purchaseDate || ""}" /></div>
              <div class="field"><label for="vehicleNote">Catatan tambahan</label><textarea id="vehicleNote" placeholder="Catatan tambahan">${escapeHtml(editing?.note || "")}</textarea></div>
            </details>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan Kendaraan"}</button></div>
          </form>
        `;
        showModal();
        document.querySelector("#vehicleForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const currentKm = Number(document.querySelector("#vehicleCurrentKm").value || 0);
          if (currentKm < 0) return alert("Kilometer tidak boleh negatif.");
          const values = {
            name: document.querySelector("#vehicleName").value.trim(),
            brand: document.querySelector("#vehicleBrand").value.trim(),
            model: document.querySelector("#vehicleModel").value.trim(),
            year: document.querySelector("#vehicleYear").value,
            plate: document.querySelector("#vehiclePlate").value.trim(),
            type: document.querySelector("#vehicleType").value,
            transmission: document.querySelector("#vehicleTransmission").value.trim(),
            currentKm,
            purchaseDate: document.querySelector("#vehiclePurchaseDate").value,
            note: document.querySelector("#vehicleNote").value.trim(),
          };
          if (editing) Object.assign(editing, values);
          else state.vehicles.push({ id: id(), ...values });
          closeModal();
          await persistChanges("Data kendaraan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openView("vehicles");
        });
      }

      function requireVehicleData() {
        if (state.vehicles.length) return true;
        alert("Tambahkan data kendaraan terlebih dahulu.");
        openVehicleForm();
        return false;
      }

      function openVehicleServiceForm(recordId = "") {
        if (!requirePrimaryAccount() || !requireVehicleData()) return;
        const editing = recordId ? state.vehicleServices.find((item) => item.id === recordId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Riwayat Service" : "Tambah Riwayat Service";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehicleServiceForm">
            <details class="form-step" open>
              <summary>1. Service</summary>
              <div class="field"><label for="serviceVehicle">Kendaraan</label><select id="serviceVehicle" required>${vehicleOptions(editing?.vehicleId || "")}</select></div>
              <div class="field"><label for="serviceWallet">Dompet</label><select id="serviceWallet" required>${walletOptions(editing?.walletId || defaultWalletId())}</select></div>
              <div class="form-grid"><div class="field"><label for="serviceDate">Tanggal service</label><input id="serviceDate" type="date" value="${editing?.serviceDate || todayDate()}" required /></div><div class="field"><label for="serviceKm">Kilometer</label><input id="serviceKm" type="number" min="0" value="${editing?.serviceKm || ""}" required /></div></div>
            </details>
            <details class="form-step">
              <summary>2. Biaya dan catatan</summary>
              <div class="form-grid"><div class="field"><label for="serviceType">Jenis service</label><input id="serviceType" required value="${escapeHtml(editing?.serviceType || "")}" placeholder="Service berkala" /></div><div class="field"><label for="serviceWorkshop">Nama bengkel</label><input id="serviceWorkshop" value="${escapeHtml(editing?.workshop || "")}" placeholder="Nama bengkel" /></div></div>
              <div class="field"><label for="serviceCost">Biaya service</label>${rupiahInputHtml("serviceCost", editing?.cost ?? "")}</div>
              <div class="field"><label for="serviceNote">Catatan service</label><textarea id="serviceNote">${escapeHtml(editing?.note || "")}</textarea></div>
            </details>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan Service"}</button></div>
          </form>
        `;
        showModal();
        attachRupiahInput("#serviceCost");
        document.querySelector("#vehicleServiceForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const cost = parseFormattedNumber(document.querySelector("#serviceCost").value);
          const serviceKm = Number(document.querySelector("#serviceKm").value || 0);
          if (cost < 0 || serviceKm < 0) return alert("Biaya dan kilometer tidak boleh negatif.");
          const record = editing || { id: id() };
          Object.assign(record, { vehicleId: document.querySelector("#serviceVehicle").value, walletId: document.querySelector("#serviceWallet").value, serviceDate: document.querySelector("#serviceDate").value, serviceKm, serviceType: document.querySelector("#serviceType").value.trim(), workshop: document.querySelector("#serviceWorkshop").value.trim(), cost, note: document.querySelector("#serviceNote").value.trim() });
          record.transactionId = upsertVehicleTransaction(record, "Service", cost, record.serviceDate, record.note || record.serviceType);
          if (!editing) state.vehicleServices.push(record);
          closeModal();
          await persistChanges("Riwayat service tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
      }

      function openVehicleOilForm(recordId = "") {
        if (!requirePrimaryAccount() || !requireVehicleData()) return;
        const editing = recordId ? state.vehicleOilChanges.find((item) => item.id === recordId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Jadwal Ganti Oli" : "Tambah Jadwal Ganti Oli";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehicleOilForm">
            <details class="form-step" open>
              <summary>1. Data terakhir</summary>
              <div class="field"><label for="oilVehicle">Kendaraan</label><select id="oilVehicle" required>${vehicleOptions(editing?.vehicleId || "")}</select></div>
              <div class="field"><label for="oilWallet">Dompet</label><select id="oilWallet" required>${walletOptions(editing?.walletId || defaultWalletId())}</select></div>
              <div class="form-grid"><div class="field"><label for="oilDate">Tanggal terakhir ganti oli</label><input id="oilDate" type="date" value="${editing?.lastOilDate || todayDate()}" required /></div><div class="field"><label for="oilKm">Kilometer terakhir</label><input id="oilKm" type="number" min="0" value="${editing?.lastOilKm || ""}" required /></div></div>
            </details>
            <details class="form-step">
              <summary>2. Interval berikutnya</summary>
              <div class="form-grid"><div class="field"><label for="oilIntervalKm">Interval kilometer</label><input id="oilIntervalKm" type="number" min="0" value="${editing?.intervalKm || 5000}" required /></div><div class="field"><label for="oilIntervalMonths">Interval bulan</label><input id="oilIntervalMonths" type="number" min="0" value="${editing?.intervalMonths || 6}" required /></div></div>
            </details>
            <details class="form-step">
              <summary>3. Biaya dan catatan</summary>
              <div class="form-grid"><div class="field"><label for="oilBrand">Merk oli</label><input id="oilBrand" value="${escapeHtml(editing?.oilBrand || "")}" placeholder="Shell, Yamalube, dll" /></div><div class="field"><label for="oilCost">Biaya oli</label>${rupiahInputHtml("oilCost", editing?.cost ?? "")}</div></div></div>
              <div class="field"><label for="oilNote">Catatan</label><textarea id="oilNote">${escapeHtml(editing?.note || "")}</textarea></div>
            </details>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan Oli"}</button></div>
          </form>
        `;
        showModal();
        attachRupiahInput("#oilCost");
        document.querySelector("#vehicleOilForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const cost = parseFormattedNumber(document.querySelector("#oilCost").value);
          const record = editing || { id: id() };
          Object.assign(record, { vehicleId: document.querySelector("#oilVehicle").value, walletId: document.querySelector("#oilWallet").value, lastOilDate: document.querySelector("#oilDate").value, lastOilKm: Number(document.querySelector("#oilKm").value || 0), intervalKm: Number(document.querySelector("#oilIntervalKm").value || 0), intervalMonths: Number(document.querySelector("#oilIntervalMonths").value || 0), oilBrand: document.querySelector("#oilBrand").value.trim(), cost, note: document.querySelector("#oilNote").value.trim() });
          if ([cost, record.lastOilKm, record.intervalKm, record.intervalMonths].some((value) => value < 0)) return alert("Biaya, kilometer, dan interval tidak boleh negatif.");
          record.transactionId = upsertVehicleTransaction(record, "Oli", cost, record.lastOilDate, record.note || `Ganti oli ${record.oilBrand}`);
          if (!editing) state.vehicleOilChanges.push(record);
          closeModal();
          await persistChanges("Jadwal oli tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
      }

      function openVehiclePartForm(recordId = "") {
        if (!requirePrimaryAccount() || !requireVehicleData()) return;
        const editing = recordId ? state.vehicleParts.find((item) => item.id === recordId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Penggantian Part" : "Tambah Penggantian Part";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehiclePartForm">
            <details class="form-step" open>
              <summary>1. Part dan tanggal</summary>
              <div class="field"><label for="partVehicle">Kendaraan</label><select id="partVehicle" required>${vehicleOptions(editing?.vehicleId || "")}</select></div>
              <div class="field"><label for="partWallet">Dompet</label><select id="partWallet" required>${walletOptions(editing?.walletId || defaultWalletId())}</select></div>
              <div class="form-grid"><div class="field"><label for="partName">Nama part</label><input id="partName" required value="${escapeHtml(editing?.partName || "")}" placeholder="Ban, aki, kampas rem" /></div><div class="field"><label for="partDate">Tanggal penggantian</label><input id="partDate" type="date" value="${editing?.replacementDate || todayDate()}" required /></div></div>
            </details>
            <details class="form-step">
              <summary>2. Umur part</summary>
              <div class="form-grid"><div class="field"><label for="partKm">Kilometer saat diganti</label><input id="partKm" type="number" min="0" value="${editing?.replacementKm || ""}" required /></div><div class="field"><label for="partLifeKm">Estimasi umur kilometer</label><input id="partLifeKm" type="number" min="0" value="${editing?.lifeKm || 10000}" /></div></div>
              <div class="field"><label for="partLifeMonths">Estimasi umur bulan</label><input id="partLifeMonths" type="number" min="0" value="${editing?.lifeMonths || 12}" /></div>
            </details>
            <details class="form-step">
              <summary>3. Biaya dan catatan</summary>
              <div class="field"><label for="partCost">Biaya part</label>${rupiahInputHtml("partCost", editing?.cost ?? "")}</div>
              <div class="field"><label for="partNote">Catatan</label><textarea id="partNote">${escapeHtml(editing?.note || "")}</textarea></div>
            </details>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan Part"}</button></div>
          </form>
        `;
        showModal();
        attachRupiahInput("#partCost");
        document.querySelector("#vehiclePartForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const cost = parseFormattedNumber(document.querySelector("#partCost").value);
          const record = editing || { id: id() };
          Object.assign(record, { vehicleId: document.querySelector("#partVehicle").value, walletId: document.querySelector("#partWallet").value, partName: document.querySelector("#partName").value.trim(), replacementDate: document.querySelector("#partDate").value, replacementKm: Number(document.querySelector("#partKm").value || 0), lifeKm: Number(document.querySelector("#partLifeKm").value || 0), lifeMonths: Number(document.querySelector("#partLifeMonths").value || 0), cost, note: document.querySelector("#partNote").value.trim() });
          if ([cost, record.replacementKm, record.lifeKm, record.lifeMonths].some((value) => value < 0)) return alert("Biaya, kilometer, dan estimasi umur tidak boleh negatif.");
          record.transactionId = upsertVehicleTransaction(record, "Spare Part", cost, record.replacementDate, record.note || `Ganti ${record.partName}`);
          if (!editing) state.vehicleParts.push(record);
          closeModal();
          await persistChanges("Data part tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
      }

      function openVehicleTaxForm(recordId = "") {
        if (!requirePrimaryAccount() || !requireVehicleData()) return;
        const editing = recordId ? state.vehicleTaxes.find((item) => item.id === recordId) : null;
        document.querySelector("#modalTitle").textContent = editing ? "Edit Pajak Kendaraan" : "Tambah Pajak Kendaraan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehicleTaxForm">
            <details class="form-step" open>
              <summary>1. Jatuh tempo</summary>
              <div class="field"><label for="taxVehicle">Kendaraan</label><select id="taxVehicle" required>${vehicleOptions(editing?.vehicleId || "")}</select></div>
              <div class="field"><label for="taxWallet">Dompet</label><select id="taxWallet" required>${walletOptions(editing?.walletId || defaultWalletId())}</select></div>
              <div class="form-grid"><div class="field"><label for="taxAnnualDue">Jatuh tempo tahunan</label><input id="taxAnnualDue" type="date" value="${editing?.annualDueDate || ""}" required /></div><div class="field"><label for="taxFiveYearDue">Jatuh tempo 5 tahunan</label><input id="taxFiveYearDue" type="date" value="${editing?.fiveYearDueDate || ""}" /></div></div>
            </details>
            <details class="form-step">
              <summary>2. Pembayaran</summary>
              <div class="form-grid"><div class="field"><label for="taxCost">Estimasi biaya pajak</label>${rupiahInputHtml("taxCost", editing?.estimatedCost ?? "")}</div><div class="field"><label for="taxStatus">Status pembayaran</label><select id="taxStatus"><option value="unpaid" ${editing?.status !== "paid" ? "selected" : ""}>Belum dibayar</option><option value="paid" ${editing?.status === "paid" ? "selected" : ""}>Sudah dibayar</option></select></div></div>
              <div class="field"><label for="taxPaidDate">Tanggal pembayaran</label><input id="taxPaidDate" type="date" value="${editing?.paidDate || ""}" /></div>
            </details>
            <details class="form-step">
              <summary>3. Catatan</summary>
              <div class="field"><label for="taxNote">Catatan</label><textarea id="taxNote">${escapeHtml(editing?.note || "")}</textarea></div>
            </details>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">${editing ? "Simpan Perubahan" : "Simpan Pajak"}</button></div>
          </form>
        `;
        showModal();
        attachRupiahInput("#taxCost");
        document.querySelector("#vehicleTaxForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const estimatedCost = parseFormattedNumber(document.querySelector("#taxCost").value);
          if (estimatedCost < 0) return alert("Biaya pajak tidak boleh negatif.");
          const record = editing || { id: id() };
          Object.assign(record, { vehicleId: document.querySelector("#taxVehicle").value, walletId: document.querySelector("#taxWallet").value, annualDueDate: document.querySelector("#taxAnnualDue").value, fiveYearDueDate: document.querySelector("#taxFiveYearDue").value, estimatedCost, status: document.querySelector("#taxStatus").value, paidDate: document.querySelector("#taxPaidDate").value, note: document.querySelector("#taxNote").value.trim() });
          if (record.status === "paid" && !record.paidDate) return alert("Tanggal pembayaran wajib diisi jika pajak sudah dibayar.");
          if (record.status === "paid") record.transactionId = upsertVehicleTransaction(record, "Pajak", estimatedCost, record.paidDate, record.note || "Pajak kendaraan");
          else removeVehicleTransaction(record);
          if (!editing) state.vehicleTaxes.push(record);
          closeModal();
          await persistChanges("Data pajak tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
      }

      function openVehicleExpenseForm() {
        if (!requirePrimaryAccount() || !requireVehicleData()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Biaya Kendaraan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="vehicleExpenseForm">
            <div class="form-grid"><div class="field"><label for="expenseVehicle">Kendaraan</label><select id="expenseVehicle" required>${vehicleOptions()}</select></div><div class="field"><label for="expenseType">Jenis biaya</label><select id="expenseType"><option>Bensin</option><option>Lainnya</option></select></div></div>
            <div class="field"><label for="expenseWallet">Dompet</label><select id="expenseWallet" required>${walletOptions(defaultWalletId())}</select></div>
            <div class="form-grid"><div class="field"><label for="expenseDate">Tanggal</label><input id="expenseDate" type="date" value="${todayDate()}" required /></div><div class="field"><label for="expenseAmount">Nominal</label>${rupiahInputHtml("expenseAmount", "", "required")}</div></div>
            <div class="field"><label for="expenseNote">Catatan</label><textarea id="expenseNote" placeholder="Contoh: Bensin full tank"></textarea></div>
            <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">Simpan Biaya</button></div>
          </form>
        `;
        showModal();
        attachRupiahInput("#expenseAmount");
        document.querySelector("#vehicleExpenseForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const amount = parseFormattedNumber(document.querySelector("#expenseAmount").value);
          if (amount <= 0) return alert("Nominal biaya wajib lebih dari 0.");
          const record = { id: id(), vehicleId: document.querySelector("#expenseVehicle").value, walletId: document.querySelector("#expenseWallet").value };
          upsertVehicleTransaction(record, document.querySelector("#expenseType").value, amount, document.querySelector("#expenseDate").value, document.querySelector("#expenseNote").value.trim() || document.querySelector("#expenseType").value);
          closeModal();
          await persistChanges("Biaya kendaraan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        });
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
        document.querySelector("#modal").classList.add("open");
      }

      function closeModal() {
        document.querySelector("#modal").classList.remove("open");
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

      async function showApp() {
        document.querySelector("#splashScreen").classList.add("hidden");
        document.querySelector("#authScreen").classList.add("hidden");
        document.querySelector("#appShell").classList.remove("hidden");
        if (!isGuest() && isCloudSyncAllowed()) {
          const shouldUploadLocal = !isChildUser() && hasUnsyncedChanges;
          if (!shouldUploadLocal) applyState(emptyState());
          await loadCloudState({ saveAfterLoad: shouldUploadLocal });
          if (isChildUser()) {
            hasUnsyncedChanges = false;
            setLocalSyncStatus("synced");
          } else if (shouldUploadLocal && !cloudSync.lastError) {
            hasUnsyncedChanges = false;
            setLocalSyncStatus("synced");
          } else if (shouldUploadLocal) {
            setLocalSyncStatus("failed");
          }
        }
        if (!isGuest() && isCloudSyncAllowed()) startCloudRealtimeSync();
        renderAll();
        startIdleLogoutTimer();
        maybeShowWalletOnboarding();
      }

      function maybeShowWalletOnboarding() {
        if (!currentUser || isGuest() || isChildUser()) return;
        const key = `dompify_onboarding_wallet_${currentUser.username || currentUser.id}`;
        if (sessionStorage.getItem(key)) return;
        if (state.transactions.length || state.wallets.length > 2) return;
        sessionStorage.setItem(key, "1");
        document.querySelector("#modalTitle").textContent = "Mulai dari Dompet";
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <div class="empty">
              <p>Buat atau sesuaikan dompet pertama agar saldo transaksi lebih rapi sejak awal.</p>
              <button class="button primary" type="button" data-open-form="wallet">Atur Dompet</button>
              <button class="button" type="button" data-close-modal>Nanti</button>
            </div>
          </div>
        `;
        showModal();
      }

      function showLogin() {
        stopIdleLogoutTimer();
        document.querySelector("#splashScreen").classList.add("hidden");
        document.querySelector("#authScreen").classList.remove("hidden");
        document.querySelector("#appShell").classList.add("hidden");
        applyRememberedLogin();
        updateForgotPasswordVisibility();
      }

      function setSplashQuote(quote, author, source = "Internet") {
        document.querySelector("#splashQuote").textContent = `"${quote}"`;
        document.querySelector("#splashQuoteSource").textContent = author ? `Sumber: ${source} - ${author}` : `Sumber: ${source}`;
      }

      function setLocalSplashQuote() {
        const item = localSplashQuotes[Math.floor(Math.random() * localSplashQuotes.length)];
        setSplashQuote(item.quote, item.author, "Quote lokal");
      }

      function loadSplashQuote() {
        const quotes = Array.isArray(globalThis.SPLASH_QUOTES) && globalThis.SPLASH_QUOTES.length
          ? globalThis.SPLASH_QUOTES
          : localSplashQuotes;
        const item = quotes[Math.floor(Math.random() * quotes.length)];
        setSplashQuote(item.quote, item.author, "Quote lokal");
      }

      function showSplash() {
        document.querySelector("#splashScreen").classList.remove("hidden");
        document.querySelector("#authScreen").classList.add("hidden");
        document.querySelector("#appShell").classList.add("hidden");
        loadSplashQuote();
        const button = document.querySelector("#continueToLoginButton");
        const status = document.querySelector("#splashReadStatus");
        button.disabled = true;
        button.textContent = "Baca sebentar...";
        status.textContent = "Quote ditampilkan sebentar agar bisa dibaca.";
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = "Mulai Mencatat";
          status.textContent = "Silakan lanjut jika sudah siap.";
        }, splashReadDelay);
      }

      async function enterGuestMode() {
        guestTransactionAdds = 0;
        currentUser = {
          id: "guest",
          username: "guest",
          password: "",
          role: "guest",
          name: "Tamu",
          email: "Mode percobaan",
        };
        replaceState(demoState());
        await showApp();
      }

      function login(username, password) {
        const user = loadUsers().find((item) => item.username === username && item.password === password);
        if (!user) return false;
        currentUser = user;
        localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
        return true;
      }

      function passwordResetRedirectUrl() {
        const configuredUrl = appConfig.resetPasswordRedirectUrl || appConfig.publicUrl || appConfig.appUrl || "";
        const baseUrl = configuredUrl || `${location.origin}${location.pathname}`;
        const url = new URL(baseUrl, location.href);
        url.searchParams.set("reset-password", "1");
        url.hash = "";
        return url.toString();
      }

      function buildUserFromCloud(user) {
        const profile = user.user_metadata || {};
        return {
          id: user.id,
          cloudId: user.id,
          username: user.email,
          password: "",
          role: profile.role || "user",
          name: profile.name || user.email?.split("@")[0] || "User",
          email: user.email || "",
          phone: profile.phone || "",
        };
      }

      async function resolveFamilyAccess(user) {
        const client = setupCloudClient();
        if (!client || !user?.email) return null;
        const { data, error } = await client
          .from("family_members")
          .select("parent_user_id, child_user_id, child_email, child_name, phone, status")
          .eq("child_email", user.email.trim().toLowerCase())
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data?.parent_user_id) return null;
        return data;
      }

      async function applyFamilyAccess(user) {
        cloudSync.readOnly = false;
        const access = await resolveFamilyAccess(user);
        cloudSync.readOnly = Boolean(access);
        if (!access) return;
        currentUser = {
          ...currentUser,
          role: "child",
          familyParentId: access.parent_user_id,
          dataOwnerId: access.parent_user_id,
          name: currentUser.name || access.child_name || currentUser.email?.split("@")[0] || "Anggota Keluarga",
          phone: currentUser.phone || access.phone || "",
        };
      }

      async function loginCloud(email, password) {
        const client = setupCloudClient();
        if (!client) return { ok: false, message: "Koneksi login cloud belum aktif. Tutup lalu buka ulang aplikasi, atau perbarui aplikasi dari browser." };
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error || !data?.user) return { ok: false, message: error?.message || "Email atau password salah." };
        currentUser = buildUserFromCloud(data.user);
        await applyFamilyAccess(data.user);
        return { ok: true };
      }

      async function registerCloud({ name, phone, email, password }) {
        const client = setupCloudClient();
        if (!client) return { ok: false, message: "Cloud belum aktif. Isi config.js terlebih dahulu." };
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name, phone, role: "user" },
            emailRedirectTo: location.href.split("#")[0],
          },
        });
        if (error) return { ok: false, message: error.message };
        if (data?.user && data?.session) {
          currentUser = buildUserFromCloud(data.user);
          return { ok: true, signedIn: true, message: "Registrasi berhasil. Kamu sudah login." };
        }

        const loginResult = await loginCloud(normalizedEmail, password);
        if (loginResult.ok) {
          return { ok: true, signedIn: true, message: "Registrasi berhasil. Kamu sudah login." };
        }

        return {
          ok: true,
          signedIn: false,
          message: "Registrasi berhasil, tetapi akun belum bisa login otomatis. Jika Supabase meminta konfirmasi email, buka Supabase > Authentication > Providers > Email lalu matikan Confirm email agar akun baru bisa langsung login.",
        };
      }

      function registerLocal({ name, phone, email, password }) {
        const users = loadUsers();
        if (users.some((user) => user.username.toLowerCase() === email.toLowerCase())) {
          return { ok: false, message: "Email sudah terdaftar." };
        }
        const user = {
          id: id(),
          username: email,
          password,
          role: "user",
          name,
          email,
          phone,
        };
        users.push(user);
        saveUsers(users);
        currentUser = user;
        localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
        replaceState(emptyState());
        return { ok: true, signedIn: true, message: "Registrasi berhasil." };
      }

      async function loginWithGoogle() {
        const client = setupCloudClient();
        if (!client) {
          alert("Login Google membutuhkan koneksi Supabase di config.js.");
          return;
        }
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.href.split("#")[0] },
        });
        if (error) alert(error.message);
      }

      function openResetPasswordRequestForm() {
        document.querySelector("#modalTitle").textContent = "Reset Password";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="resetPasswordRequestForm">
            <p class="form-status">Masukkan email akun kamu. Jika email terdaftar, link reset password akan dikirimkan.</p>
            <div class="field">
              <label for="resetEmail">Email</label>
              <input id="resetEmail" type="email" autocomplete="email" required />
            </div>
            <p class="form-status hidden" id="resetRequestStatus"></p>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Kirim Link Reset Password</button>
            </div>
          </form>
        `;
        showModal();
        const loginEmail = document.querySelector("#loginUsername").value.trim();
        if (loginEmail) document.querySelector("#resetEmail").value = loginEmail;
        document.querySelector("#resetPasswordRequestForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#resetPasswordRequestForm .button.primary");
          const status = document.querySelector("#resetRequestStatus");
          const email = document.querySelector("#resetEmail").value.trim().toLowerCase();
          submitButton.disabled = true;
          submitButton.textContent = "Mengirim...";
          status.className = "form-status";
          status.textContent = "Memproses permintaan reset password...";
          try {
            const client = setupCloudClient();
            if (client) {
              const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: passwordResetRedirectUrl(),
              });
              if (error) throw error;
            }
            status.className = "form-status success";
            status.textContent = "Jika email terdaftar, link reset password akan dikirimkan.";
          } catch {
            status.className = "form-status success";
            status.textContent = "Jika email terdaftar, link reset password akan dikirimkan.";
          } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Kirim Link Reset Password";
          }
        });
      }

      function clearPasswordResetUrl() {
        if (!history.replaceState) return;
        const cleanUrl = location.origin === "null" ? location.pathname : `${location.origin}${location.pathname}`;
        history.replaceState({}, document.title, cleanUrl);
      }

      function openNewPasswordForm() {
        showLogin();
        document.querySelector("#modalTitle").textContent = "Buat Password Baru";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="newPasswordForm">
            <p class="form-status">Masukkan password baru untuk akun kamu.</p>
            <div class="field">
              <label for="newPassword">Password baru</label>
              <div class="password-wrap">
                <input id="newPassword" type="password" autocomplete="new-password" minlength="8" required />
                <button class="password-toggle" type="button" data-toggle-password="newPassword" aria-label="Tampilkan password">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="field">
              <label for="confirmNewPassword">Konfirmasi password baru</label>
              <div class="password-wrap">
                <input id="confirmNewPassword" type="password" autocomplete="new-password" minlength="8" required />
                <button class="password-toggle" type="button" data-toggle-password="confirmNewPassword" aria-label="Tampilkan password">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
                  </svg>
                </button>
              </div>
            </div>
            <p class="form-status hidden" id="newPasswordStatus"></p>
            <div class="row-actions">
              <button class="button primary" type="submit">Reset Password</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#newPasswordForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#newPasswordForm .button.primary");
          const status = document.querySelector("#newPasswordStatus");
          const password = document.querySelector("#newPassword").value;
          const confirmation = document.querySelector("#confirmNewPassword").value;
          status.className = "form-status error";
          if (password.length < 8) {
            status.textContent = "Password minimal 8 karakter.";
            return;
          }
          if (password !== confirmation) {
            status.textContent = "Password dan konfirmasi password harus sama.";
            return;
          }
          submitButton.disabled = true;
          submitButton.textContent = "Mereset...";
          status.className = "form-status";
          status.textContent = "Memproses password baru...";
          try {
            const client = setupCloudClient();
            if (!client) throw new Error("Cloud belum aktif.");
            const { error } = await client.auth.updateUser({ password });
            if (error) throw error;
            await client.auth.signOut();
            currentUser = null;
            clearRememberedLogin();
            resetFailedLogin();
            clearPasswordResetUrl();
            closeModal();
            showLogin();
            alert("Password berhasil direset. Silakan login menggunakan password baru.");
          } catch (error) {
            status.className = "form-status error";
            status.textContent = error.message || "Password belum bisa direset. Coba buka ulang link reset password.";
            submitButton.disabled = false;
            submitButton.textContent = "Reset Password";
          }
        });
      }

      function isPasswordRecoveryUrl() {
        const params = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
        return params.get("reset-password") === "1" || params.get("type") === "recovery" || hashParams.get("type") === "recovery";
      }

      async function handlePasswordRecoveryLink() {
        if (!cloudSync.enabled || !isPasswordRecoveryUrl()) return false;
        const client = setupCloudClient();
        if (!client) return false;
        const params = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
        const code = params.get("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        try {
          if (code) {
            const { error } = await client.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (accessToken && refreshToken) {
            const { error } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }

          const { data, error } = await client.auth.getSession();
          if (error || !data?.session) throw error || new Error("Sesi reset password tidak tersedia.");
        } catch {
          showLogin();
          clearPasswordResetUrl();
          alert("Link reset password tidak valid atau sudah kedaluwarsa. Minta link baru dari menu Lupa password.");
          return true;
        }
        openNewPasswordForm();
        return true;
      }

      function openRegisterForm() {
        document.querySelector("#modalTitle").textContent = "Registrasi Akun";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="registerForm">
            <div class="field">
              <label for="registerName">Nama</label>
              <input id="registerName" type="text" autocomplete="name" required />
            </div>
            <div class="field">
              <label for="registerPhone">Nomor HP</label>
              <input id="registerPhone" type="tel" autocomplete="tel" inputmode="tel" required />
            </div>
            <div class="field">
              <label for="registerEmail">Email</label>
              <input id="registerEmail" type="email" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="registerPassword">Password</label>
              <div class="password-wrap">
                <input id="registerPassword" type="password" autocomplete="new-password" minlength="6" required />
                <button class="password-toggle" type="button" data-toggle-password="registerPassword" aria-label="Tampilkan password">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Daftar</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#registerForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#registerForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Mendaftarkan...";
          const payload = {
            name: document.querySelector("#registerName").value.trim(),
            phone: document.querySelector("#registerPhone").value.trim(),
            email: document.querySelector("#registerEmail").value.trim(),
            password: document.querySelector("#registerPassword").value,
          };
          const result = cloudSync.enabled ? await registerCloud(payload) : registerLocal(payload);
          if (!result.ok) {
            submitButton.disabled = false;
            submitButton.textContent = "Daftar";
            alert(result.message);
            return;
          }
          closeModal();
          saveRememberedLogin(payload.email.trim().toLowerCase(), payload.password);
          alert(result.message);
          if (result.signedIn && currentUser) await showApp();
        });
      }

      async function loadCloudSessionUser() {
        const client = setupCloudClient();
        if (!client) return null;
        const { data } = await client.auth.getSession();
        const user = data?.session?.user;
        if (!user) return null;
        currentUser = buildUserFromCloud(user);
        await applyFamilyAccess(user);
        return currentUser;
      }

      async function logout(message = "") {
        const logoutMessage = typeof message === "string" ? message : "";
        stopIdleLogoutTimer();
        localStorage.removeItem(sessionStorageKey);
        stopCloudRealtimeSync();
        cloudSync.readOnly = false;
        if (cloudSync.enabled) {
          try {
            await setupCloudClient()?.auth.signOut();
          } catch {
            // User is leaving the app session; keep logout flow moving even if cloud sign out is temporarily unavailable.
          }
        }
        currentUser = null;
        applyState(emptyState());
        viewHistory = [];
        openView("home", { replace: true });
        showLogin();
        if (logoutMessage) alert(logoutMessage);
      }

      async function autoLoginRememberedUser() {
        const saved = loadRememberedLogin();
        if (!saved) return false;
        const result = cloudSync.enabled ? await loginCloud(saved.email, saved.password) : { ok: login(saved.email, saved.password), message: "" };
        if (!result.ok) {
          clearRememberedLogin();
          return false;
        }
        resetFailedLogin();
        await showApp();
        return true;
      }

      function deleteCurrentAccount() {
        if (!requirePrimaryAccount()) return;
        const users = loadUsers();
        const remainingAdmins = users.filter((user) => user.role === "admin" && user.username !== currentUser.username);
        if (currentUser.role === "admin" && !remainingAdmins.length) {
          alert("Tidak bisa menghapus admin terakhir.");
          return;
        }
        if (!confirm(`Hapus akun ${currentUser.username}?`)) return;
        saveUsers(users.filter((user) => user.username !== currentUser.username));
        logout();
      }

      document.querySelector("#todayText").textContent = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date());

      document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => openView(button.dataset.view));
      });

      document.querySelector("#backButton").addEventListener("click", goBackView);

      document.querySelector("#addMenuButton").addEventListener("click", () => {
        document.querySelector("#addBlock").classList.toggle("open");
      });

      document.body.addEventListener("click", async (event) => {
        const moneyCalculatorTrigger = event.target.closest("[data-open-money-calculator]");
        if (moneyCalculatorTrigger) {
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
            expressionInput.focus();
            return;
          }
          if (key === "⌫") {
            expressionInput.value = expressionInput.value.slice(0, -1);
            updateMoneyCalculatorResult();
            expressionInput.focus();
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
            expressionInput.focus();
            return;
          }
          expressionInput.value += key;
          updateMoneyCalculatorResult();
          expressionInput.focus();
          return;
        }

        if (event.target.closest("[data-money-cancel]")) {
          closeMoneyCalculator();
          return;
        }

        const opener = event.target.closest("[data-open-form]");
        if (opener) document.querySelector("#addBlock")?.classList.remove("open");
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
          if (walletInUse(target.id)) {
            alert("Dompet tidak bisa dihapus karena sudah digunakan pada transaksi.");
            return;
          }
          const snapshot = cloneData(target);
          await deleteWithUndo({
            confirmMessage: `Hapus dompet "${target.name}"?`,
            deleteMessage: "Dompet dihapus.",
            failedMessage: "Dompet sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.",
            deleteFn: () => {
              markDeleted("wallets", target.id);
              state.wallets = state.wallets.filter((wallet) => wallet.id !== target.id);
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

      document.body.addEventListener("input", (event) => {
        if (event.target.closest("#moneyCalculatorExpression")) updateMoneyCalculatorResult();
      });

      document.querySelector("#closeModalButton").addEventListener("click", closeModal);
      document.querySelector("#modal").addEventListener("click", (event) => {
        if (event.target.id === "modal") closeModal();
      });

      document.addEventListener("invalid", (event) => {
        const step = event.target.closest?.(".form-step");
        if (step) step.open = true;
      }, true);

      document.querySelector("#loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = document.querySelector("#loginUsername").value.trim();
        const password = document.querySelector("#loginPassword").value;
        const result = cloudSync.enabled ? await loginCloud(username, password) : { ok: login(username, password), message: "Email atau password salah." };
        if (!result.ok) {
          recordFailedLogin();
          alert(result.message);
          return;
        }
        resetFailedLogin();
        if (document.querySelector("#rememberLogin").checked) {
          saveRememberedLogin(username.toLowerCase(), password);
        } else {
          clearRememberedLogin();
        }
        document.querySelector("#loginPassword").value = "";
        await showApp();
      });
      document.querySelector("#continueToLoginButton").addEventListener("click", showLogin);
      document.querySelector("#skipSplashButton")?.addEventListener("click", showLogin);
      document.querySelector("#forgotPasswordButton").addEventListener("click", openResetPasswordRequestForm);
      document.querySelector("#registerButton").addEventListener("click", openRegisterForm);
      document.querySelector("#googleLoginButton").addEventListener("click", loginWithGoogle);
      document.querySelector("#accessRequestButton").addEventListener("click", openRegisterForm);
      document.querySelector("#guestLoginButton").addEventListener("click", enterGuestMode);
      document.querySelector("#copyBcaButton").addEventListener("click", async () => {
        await copyText(document.querySelector("#bcaAccountNumber").textContent.trim());
        alert("Nomor rekening BCA berhasil disalin.");
      });
      document.querySelector("#shareAppButton").addEventListener("click", shareApp);
      document.querySelector("#viewAllSavingsButton").addEventListener("click", () => openView("savings"));
      document.querySelector("#homeSavingsHistoryButton").addEventListener("click", openSavingsHistory);
      document.querySelector("#savingsHistoryButton").addEventListener("click", openSavingsHistory);
      document.querySelector("#showAllDailyExpensesButton").addEventListener("click", () => {
        showAllDailyExpenses = true;
        renderDailyExpenses();
      });
      document.querySelector("#toggleTotalBalanceVisibilityButton").addEventListener("click", () => {
        if (!requirePrimaryAccount()) return;
        state.settings.totalBalanceVisible = !state.settings.totalBalanceVisible;
        renderStats();
        saveState();
      });

      document.querySelector("#budgetType").addEventListener("change", () => {
        const parent = document.querySelector("#budgetParent");
        renderCategoryOptions();
        if (parent) parent.value = "";
      });

      document.querySelector("#resetBudgetFormButton").addEventListener("click", () => resetBudgetForm());
      attachRupiahInput("#budgetLimit");

      document.querySelector("#budgetForm").addEventListener("submit", (event) => {
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
        persistChanges("Anggaran tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
      });

      document.querySelector("#searchInput").addEventListener("input", () => {
        renderTransactions();
      });
      document.querySelector("#monthFilter").addEventListener("change", () => {
        quickTransactionRange = document.querySelector("#monthFilter").value === "all" ? "all" : "month";
        document.querySelectorAll("[data-quick-range]").forEach((button) => button.classList.toggle("active", button.dataset.quickRange === quickTransactionRange));
        renderTransactions();
        renderCategoryBreakdown();
        renderDailyExpenses();
      });
      document.querySelector("#typeFilter").addEventListener("change", (event) => {
        document.querySelectorAll("[data-transaction-type-tab]").forEach((button) => button.classList.toggle("active", button.dataset.transactionTypeTab === event.target.value));
        renderTransactions();
      });
      document.querySelector("#walletFilter").addEventListener("change", renderTransactions);
      ["#walletMutationSearch", "#walletMutationMonth", "#walletMutationStartDate", "#walletMutationEndDate"].forEach((selector) => {
        document.querySelector(selector)?.addEventListener("input", renderWalletDetail);
        document.querySelector(selector)?.addEventListener("change", renderWalletDetail);
      });
      document.querySelector("#vehicleExpenseVehicleFilter").addEventListener("change", renderVehicleExpenses);
      document.querySelector("#vehicleExpenseMonthFilter").addEventListener("change", renderVehicleExpenses);
      document.querySelector("#vehicleExpenseTypeFilter").addEventListener("change", renderVehicleExpenses);
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
        if (!requirePrimaryAccount()) {
          event.target.checked = Boolean(state.settings.darkMode);
          return;
        }
        state.settings.darkMode = event.target.checked;
        persistChanges("Pengaturan tampilan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
      });
      document.querySelector("#cloudSyncToggle").addEventListener("change", async (event) => {
        if (!requirePrimaryAccount()) {
          event.target.checked = state.settings.cloudSyncEnabled !== false;
          return;
        }
        state.settings.cloudSyncEnabled = event.target.checked;
        cloudSync.lastError = "";
        if (state.settings.cloudSyncEnabled) {
          renderAll();
          if (!isGuest() && isCloudSyncAllowed()) {
            await loadCloudState({ saveAfterLoad: hasUnsyncedChanges });
            if (!cloudSync.lastError) {
              hasUnsyncedChanges = false;
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
        if (!requirePrimaryAccount()) {
          event.target.value = state.settings.language || "id";
          return;
        }
        state.settings.language = event.target.value;
        persistChanges("Pengaturan bahasa tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
      });
      document.querySelector("#logoutButton").addEventListener("click", () => {
        logout();
      });
      document.querySelector("#deleteAccountButton").addEventListener("click", deleteCurrentAccount);
      document.querySelector("#loadDemoButton").addEventListener("click", () => {
        if (!isGuest()) {
          alert("Data contoh hanya tersedia saat masuk sebagai tamu.");
          return;
        }
        if (confirm("Muat ulang data contoh? Data saat ini akan diganti.")) {
          guestTransactionAdds = 0;
          const fresh = demoState();
          const normalized = normalizeState(fresh);
          applyState({
            ...normalized,
            deleted: { transactions: [], debts: [], budgets: [], savings: [], billReminders: [], recurring: [], wallets: [], vehicles: [], vehicleServices: [], vehicleOilChanges: [], vehicleParts: [], vehicleTaxes: [], familyMembers: [] },
          });
          renderAll();
        }
      });
      document.querySelector("#clearDataButton").addEventListener("click", () => {
        if (!requireAdmin()) return;
        if (confirm("Kosongkan semua data transaksi, anggaran, dan hutang piutang?")) {
          state.transactions = [];
          state.budgets = categories.map((category) => ({
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
        }
      });

      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        document.querySelector("#installAppButton").classList.remove("hidden");
      });

      document.querySelector("#installAppButton").addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          document.querySelector("#installAppButton").classList.add("hidden");
        }
        deferredInstallPrompt = null;
      });

      window.addEventListener("appinstalled", () => {
        document.querySelector("#installAppButton").classList.add("hidden");
        deferredInstallPrompt = null;
      });

      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("./sw.js").catch(() => {});
        });
      }

      loadUsers();
      applyDarkMode();
      if (cloudSync.enabled) {
        setupCloudClient()?.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") openNewPasswordForm();
        });
      }
      async function bootstrap() {
        if (await handlePasswordRecoveryLink()) return;
        if (cloudSync.enabled) {
          currentUser = await loadCloudSessionUser();
        }
        if (currentUser) {
          await showApp();
        } else {
          const rememberedLoggedIn = await autoLoginRememberedUser();
          if (!rememberedLoggedIn) showSplash();
        }
      }
      bootstrap();
