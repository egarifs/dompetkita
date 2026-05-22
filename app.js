      const {
        storageKey,
        authStorageKey,
        sessionStorageKey,
        rememberedLoginKey,
        failedLoginKey,
        splashReadDelay,
        localSplashQuotes,
        savingCategories,
        defaultCategories,
        rupiah,
      } = window.AppConstants;
      const appConfig = globalThis.APP_CONFIG || {};
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
        lastSyncedAt: null,
        lastError: "",
      };
      let deferredInstallPrompt = null;

      const {
        todayDate,
        currentMonthKey,
        previousMonthKey,
        monthLabel,
        id,
        money,
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
          "nav.reports": "Laporan",
          "nav.add": "Tambah",
          "nav.addTransaction": "Tambah Transaksi",
          "nav.addDebt": "Tambah Hutang Piutang",
          "nav.budgets": "Anggaran",
          "nav.account": "Akun",
          "common.add": "Tambah",
          "account.title": "Akun",
          "account.subtitle": "Data, mode tampilan, dan transaksi berulang.",
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
          "nav.reports": "Reports",
          "nav.add": "Add",
          "nav.addTransaction": "Add Transaction",
          "nav.addDebt": "Add Debt",
          "nav.budgets": "Budget",
          "nav.account": "Account",
          "common.add": "Add",
          "account.title": "Account",
          "account.subtitle": "Data, display mode, and recurring transactions.",
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
          reports: ["Laporan", "Lihat semua transaksi dan pola pengeluaran per kategori."],
          budgets: ["Anggaran", "Atur batas pengeluaran dan pantau hutang piutang."],
          account: ["Akun", "Kelola profil, akses, ekspor data, dan pengaturan aplikasi."],
          thanks: ["Thanks", "Dukung pengembangan aplikasi melalui rekening yang tersedia."],
          savings: ["Tabungan", "Kelola tujuan tabungan dan progres pencapaiannya."],
        },
        en: {
          home: ["Finance Dashboard", "Track this month's spending, balance, and remaining budget."],
          reports: ["Reports", "View all transactions and category spending patterns."],
          budgets: ["Budget", "Set spending limits and monitor debts."],
          account: ["Account", "Manage profile, access, exports, and app settings."],
          thanks: ["Thanks", "Support app development through the available bank account."],
          savings: ["Savings", "Manage savings goals and progress."],
        },
      };

      const state = loadState();
      let categories = state.categories?.length ? state.categories : [...defaultCategories];
      state.categories = categories;
      const defaultDashboardMenuOrder = ["home", "reports", "budgets", "account"];
      state.settings.dashboardMenuOrder = Array.isArray(state.settings?.dashboardMenuOrder) && state.settings.dashboardMenuOrder.length
        ? state.settings.dashboardMenuOrder
        : [...defaultDashboardMenuOrder];
      let users = window.AppAuth.loadUsers(authStorageKey);
      let currentUser = loadSessionUser();


      function loadUsers() {
        return window.AppAuth.loadUsers(authStorageKey);
      }

      function saveUsers(nextUsers) {
        users = nextUsers;
        window.AppAuth.saveUsers(authStorageKey, users);
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


      function isAdmin() {
        return currentUser?.role === "admin";
      }

      function isGuest() {
        return currentUser?.role === "guest";
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
        const input = document.querySelector(selector);
        input.addEventListener("input", () => {
          input.value = formatNumber(input.value);
        });
      }

      function loadState() {
        try {
          const stored = JSON.parse(localStorage.getItem(storageKey));
          if (stored && Array.isArray(stored.transactions) && Array.isArray(stored.budgets) && Array.isArray(stored.debts)) {
            return normalizeState(stored);
          }
        } catch {
          return normalizeState(demoState());
        }
        return normalizeState(demoState());
      }

      function saveState() {
        if (isGuest()) return;
        localStorage.setItem(storageKey, JSON.stringify(state));
        queueCloudSave();
      }

      function replaceState(nextState) {
        const normalized = normalizeState(nextState);
        state.transactions = normalized.transactions;
        state.budgets = normalized.budgets;
        state.debts = normalized.debts;
        state.savings = normalized.savings;
        state.billReminders = normalized.billReminders;
        state.recurring = normalized.recurring;
        state.categories = normalized.categories;
        state.wallets = normalized.wallets;
        state.deleted = normalized.deleted;
        state.settings = normalized.settings;
        if (isGuest()) return;
        localStorage.setItem(storageKey, JSON.stringify(state));
      }

      function markDeleted(collection, itemId) {
        if (!itemId) return;
        if (!state.deleted) state.deleted = {};
        if (!Array.isArray(state.deleted[collection])) state.deleted[collection] = [];
        if (!state.deleted[collection].includes(itemId)) state.deleted[collection].push(itemId);
      }

      function mergeStateData(cloudData, localData) {
        const cloud = normalizeState(cloudData || {});
        const local = normalizeState(localData || {});
        const deleted = {
          transactions: mergeDeletedIds(cloud, local, "transactions"),
          debts: mergeDeletedIds(cloud, local, "debts"),
          savings: mergeDeletedIds(cloud, local, "savings"),
          billReminders: mergeDeletedIds(cloud, local, "billReminders"),
          recurring: mergeDeletedIds(cloud, local, "recurring"),
        };
        const budgetMap = new Map();
        cloud.budgets.forEach((item) => budgetMap.set(item.category, item));
        local.budgets.forEach((item) => budgetMap.set(item.category, item));
        return normalizeState({
          transactions: withoutDeleted(mergeById(cloud.transactions, local.transactions), deleted.transactions),
          budgets: [...budgetMap.values()],
          debts: withoutDeleted(mergeById(cloud.debts, local.debts), deleted.debts),
          savings: withoutDeleted(mergeById(cloud.savings, local.savings), deleted.savings),
          billReminders: withoutDeleted(mergeById(cloud.billReminders, local.billReminders), deleted.billReminders),
          recurring: withoutDeleted(mergeById(cloud.recurring, local.recurring), deleted.recurring),
          categories: [...new Set([...cloud.categories, ...local.categories])],
          wallets: [...new Set([...cloud.wallets, ...local.wallets])],
          settings: { ...cloud.settings, ...local.settings },
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
        return window.AppCloud.queueCloudSave({
          cloudSync,
          currentUser,
          cloudUserKey,
          saveCloudState,
        });
      }

      async function flushCloudSave() {
        return window.AppCloud.flushCloudSave({
          cloudSync,
          isGuest,
          cloudUserKey,
          saveCloudState,
        });
      }

      async function persistChanges(failedMessage = "Perubahan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.") {
        renderAll();
        const saved = await flushCloudSave();
        if (!saved && cloudSync.enabled) alert(failedMessage);
        return saved;
      }

      async function syncCloudState() {
        if (isGuest() || !cloudSync.enabled || !cloudUserKey()) return false;
        await loadCloudState();
        renderAll();
        return !cloudSync.lastError;
      }

      async function loadCloudState() {
        return window.AppCloud.loadCloudState({
          cloudSync,
          setupCloudClient: () => setupCloudClient(),
          cloudConfig,
          cloudUserKey,
          replaceState,
          mergeStateData,
          state,
          saveCloudState,
        });
      }

      async function saveCloudState() {
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
        return window.AppCloud.syncStatusText(cloudSync);
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

      function savingsEntry(type, date, amount, note) {
        return window.AppState.savingsEntry(id(), type, date, amount, note);
      }

      function savingsGoal(category, target, targetDate, entries = []) {
        return window.AppState.savingsGoal(id(), todayDate(), category, target, targetDate, entries);
      }

      function billReminder(title, category, amount, dueDate, note = "", status = "unpaid") {
        return window.AppState.billReminder(id(), title, category, amount, dueDate, note, status);
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
        return state.budgets.reduce((sum, item) => sum + Number(item.limit || 0), 0);
      }

      function expenseForCategory(category, month = currentMonthKey()) {
        return transactionsByMonth(month)
          .filter((item) => item.type === "expense" && item.category === category)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      }

      function savingsBalance(goal) {
        return (goal.entries || []).reduce((sum, entry) => sum + (entry.type === "withdraw" ? -Number(entry.amount || 0) : Number(entry.amount || 0)), 0);
      }

      function savingsPercent(goal) {
        if (!goal.target) return 0;
        return Math.min(100, Math.max(0, Math.round((savingsBalance(goal) / Number(goal.target)) * 100)));
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
        const unpaidReceivable = state.debts.filter((item) => item.kind === "receivable" && item.status === "unpaid").reduce((sum, item) => sum + Number(item.amount), 0);
        const unpaidPayable = state.debts.filter((item) => item.kind === "payable" && item.status === "unpaid").reduce((sum, item) => sum + Number(item.amount), 0);

        document.querySelector("#monthExpense").textContent = money(currentExpense);
        document.querySelector("#monthIncome").textContent = money(currentIncome);
        document.querySelector("#totalBalance").textContent = money(totalBalanceUntil());
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
        const unpaidReceivable = state.debts.filter((item) => item.kind === "receivable" && item.status === "unpaid").reduce((sum, item) => sum + Number(item.amount), 0);
        const unpaidPayable = state.debts.filter((item) => item.kind === "payable" && item.status === "unpaid").reduce((sum, item) => sum + Number(item.amount), 0);

        document.querySelector("#monthExpense").textContent = money(currentExpense);
        document.querySelector("#monthIncome").textContent = money(currentIncome);
        document.querySelector("#totalBalance").textContent = money(totalBalanceUntil());
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

      function transactionRows(items, limit = null) {
        const visible = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit ?? items.length);
        if (!visible.length) {
          return `<div class="empty"><p>Belum ada transaksi.</p></div>`;
        }

        return `
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Tipe</th>
                <th>Nominal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${visible.map((item) => `
                <tr>
                  <td>${escapeHtml(item.date)}</td>
                  <td><span class="pill">${escapeHtml(item.category)}</span></td>
                  <td>${escapeHtml(item.description)}</td>
                  <td><span class="pill ${item.type}">${item.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
                  <td class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
                  <td>
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

      function renderTransactions() {
        document.querySelector("#latestTransactions").innerHTML = transactionRows(state.transactions, 5);
        const query = document.querySelector("#searchInput")?.value.toLowerCase().trim() || "";
        const month = document.querySelector("#monthFilter")?.value || "all";
        const type = document.querySelector("#typeFilter")?.value || "all";
        const filtered = state.transactions
          .filter((item) => month === "all" || monthOf(item) === month)
          .filter((item) => type === "all" || item.type === type)
          .filter((item) => `${item.category} ${item.description}`.toLowerCase().includes(query));
        document.querySelector("#allTransactions").innerHTML = transactionRows(filtered);
      }

      function renderBudgets() {
        const rows = state.budgets.map((budget) => {
          const spent = expenseForCategory(budget.category);
          const percent = budget.limit ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 0;
          const statusClass = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
          return `
            <article class="budget-row">
              <div class="budget-row-top">
                <strong>${escapeHtml(budget.category)}</strong>
                <span>${money(spent)} / ${money(budget.limit)}</span>
              </div>
              <div class="progress ${statusClass}"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${budget.limit - spent >= 0 ? "Sisa" : "Lewat"} ${money(Math.abs(budget.limit - spent))}</div>
            </article>
          `;
        }).join("");

        document.querySelector("#homeBudgetList").innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
        document.querySelector("#budgetPageList").innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
      }

      function savingsRows(limit = null) {
        const goals = [...state.savings].sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || "")).slice(0, limit ?? state.savings.length);
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
                <strong>${escapeHtml(goal.title)}</strong>
                <span>${percent}%</span>
              </div>
              <div class="progress"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${money(balance)} dari ${money(goal.target)} - Target ${escapeHtml(goal.targetDate || "-")}</div>
            </article>
          `;
        }).join("");
      }

      function renderSavings() {
        document.querySelector("#homeSavingsList").innerHTML = savingsRows(3);
        document.querySelector("#allSavingsList").innerHTML = savingsRows();
        document.querySelector("#viewAllSavingsButton").classList.toggle("hidden", state.savings.length <= 3);
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

        state.budgets.forEach((budget) => {
          const spent = expenseForCategory(budget.category, month);
          const percent = budget.limit ? Math.round((spent / budget.limit) * 100) : 0;
          if (percent >= 80) {
            insights.push({
              title: `Budget ${budget.category}`,
              text: `Budget ${budget.category.toLowerCase()} sudah terpakai ${percent}%.`,
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
          <article class="debt-row">
            <div class="debt-row-top">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="pill ${item.tone}">Insight</span>
            </div>
            <p style="margin-top: 7px; color: var(--muted); font-size: .92rem">${escapeHtml(item.text)}</p>
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
                <span>${money(item.amount)}</span>
              </div>
              <p style="margin-top: 7px; color: var(--muted); font-size: .9rem">${escapeHtml(item.description)}</p>
              <div class="tags" style="display:flex; flex-wrap:wrap; gap:7px; margin-top:10px">
                <span class="pill debt">Tanggal ${escapeHtml(item.date)}</span>
                <span class="pill debt">Jatuh tempo ${escapeHtml(item.dueDate || "-")}</span>
                <span class="pill ${item.status === "paid" ? "income" : "expense"}">${item.status === "paid" ? "Lunas" : "Belum lunas"}</span>
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

      function renderMonthOptions() {
        const select = document.querySelector("#monthFilter");
        const months = [...new Set(state.transactions.map(monthOf))].sort().reverse();
        select.innerHTML = `<option value="all">Semua bulan</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
      }

      function renderCategoryOptions() {
        const budgetCategory = document.querySelector("#budgetCategory");
        categories = state.categories?.length ? state.categories : [...defaultCategories];
        budgetCategory.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join("");
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
        const dailyDateLabel = (date) => new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date(`${date}T00:00:00`));
        const rows = state.transactions
          .filter((item) => item.type === "expense")
          .filter((item) => monthFilter === "all" || monthOf(item) === monthFilter)
          .reduce((summary, item) => {
            if (!summary[item.date]) summary[item.date] = { date: item.date, count: 0, total: 0, transactions: [] };
            summary[item.date].count += 1;
            summary[item.date].total += Number(item.amount || 0);
            summary[item.date].transactions.push(item);
            return summary;
          }, {});

        const data = Object.values(rows).sort((a, b) => b.date.localeCompare(a.date));
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
          : `<div class="empty"><p>Belum ada pengeluaran untuk ditampilkan.</p></div>`;
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

      function renderDashboardMenuOrder() {
        const nav = document.querySelector(".nav");
        const addBlock = document.querySelector("#addBlock");
        if (!nav || !addBlock) return;
        const navButtons = [...nav.querySelectorAll(".nav-button[data-view]")];
        const map = new Map(navButtons.map((button) => [button.dataset.view, button]));
        const configured = Array.isArray(state.settings.dashboardMenuOrder) ? state.settings.dashboardMenuOrder : [];
        const orderedViews = [...new Set([...configured, ...defaultDashboardMenuOrder])].filter((view) => map.has(view));
        const orderedButtons = orderedViews.map((view) => map.get(view)).filter(Boolean);
        state.settings.dashboardMenuOrder = orderedViews;
        for (const button of orderedButtons) {
          nav.insertBefore(button, addBlock);
        }
      }

      function dashboardMenuViewLabel(view) {
        const labels = { home: "Beranda", reports: "Laporan", budgets: "Anggaran", account: "Akun" };
        return labels[view] || view;
      }

      function renderAccount() {
        if (!currentUser) return;
        document.querySelector("#profilePhoto").textContent = currentUser.name.slice(0, 1).toUpperCase();
        document.querySelector("#profileName").textContent = currentUser.name;
        document.querySelector("#profileEmail").textContent = currentUser.email;
        document.querySelector("#profileRole").textContent = isGuest() ? "Tamu" : currentUser.role === "admin" ? "Admin" : "User";
        document.querySelector("#profilePinStatus").textContent = state.settings.pin ? "PIN aktif" : "PIN belum aktif";
        document.querySelector("#profileSyncStatus").textContent = isGuest() ? "Demo" : cloudSync.enabled ? "Cloud" : "Lokal";
        document.querySelector("#darkModeToggle").checked = Boolean(state.settings.darkMode);
        document.querySelector("#languageSelect").value = currentLanguage();
        document.querySelector("#syncStatus").textContent = isGuest() ? "Mode tamu aktif. Login atau registrasi untuk menyimpan data." : syncStatusText();
        document.querySelector("#syncNowButton").disabled = isGuest() || !cloudSync.enabled || cloudSync.isSaving;
        document.querySelector("#reminderStatus").textContent = state.settings.reminderEnabled ? `Aktif pukul ${state.settings.reminderTime}` : "Belum aktif";
        document.querySelector("#walletSummary").textContent = state.wallets.join(", ") || "Belum ada dompet";
        document.querySelector("#categorySummary").textContent = `${categories.length} kategori aktif`;
        document.querySelector("#dashboardMenuSummary").textContent = state.settings.dashboardMenuOrder.map(dashboardMenuViewLabel).join(", ");
        document.querySelector("#pinSummary").textContent = state.settings.pin ? "PIN sudah disimpan di perangkat ini." : "PIN belum aktif.";
        document.querySelectorAll("[data-admin-only]").forEach((element) => {
          element.disabled = !isAdmin();
          element.title = isAdmin() ? "" : "Hanya admin";
        });
        document.querySelector("#deleteAccountButton").disabled = isGuest();
      }

      function applyDarkMode() {
        document.body.classList.toggle("dark", Boolean(state.settings.darkMode));
      }

      function renderAll() {
        categories = state.categories?.length ? state.categories : [...defaultCategories];
        state.categories = categories;
        renderDashboardMenuOrder();
        applyDarkMode();
        saveState();
        applyLanguage();
        renderCategoryOptions();
        renderStats();
        renderChart();
        renderMonthOptions();
        renderTransactions();
        renderBudgets();
        renderSavings();
        renderInsights();
        renderBillReminders();
        renderDebts();
        renderCategoryBreakdown();
        renderDailyExpenses();
        renderRecurring();
        renderAccount();
      }

      function openView(view) {
        document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
        document.querySelector(`#${view}View`).classList.add("active");
        document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
        const copy = currentPageCopy(view);
        document.querySelector("#pageHeading").textContent = copy[0];
        document.querySelector("#pageSubtitle").textContent = copy[1];
        document.querySelector("#addBlock").classList.remove("open");
      }

      function openTransactionForm() {
        if (!requireSignedIn()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Transaksi";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="transactionForm">
            <div class="form-grid">
              <div class="field">
                <label for="transactionType">Tipe</label>
                <select id="transactionType" required>
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </div>
              <div class="field">
                <label for="transactionDate">Tanggal</label>
                <input id="transactionDate" type="date" value="${todayDate()}" required />
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="transactionCategory">Kategori</label>
                <select id="transactionCategory">${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select>
              </div>
              <div class="field">
                <label for="transactionAmount">Nominal</label>
                <div class="currency-input">
                  <span>Rp</span>
                  <input id="transactionAmount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required />
                </div>
              </div>
            </div>
            <div class="field">
              <label for="transactionDescription">Deskripsi (opsional)</label>
              <textarea id="transactionDescription" placeholder="Contoh: belanja mingguan"></textarea>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan Transaksi</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#transactionAmount");
        document.querySelector("#transactionForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#transactionForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          state.transactions.push({
            id: id(),
            type: document.querySelector("#transactionType").value,
            date: document.querySelector("#transactionDate").value,
            category: document.querySelector("#transactionCategory").value,
            amount: parseFormattedNumber(document.querySelector("#transactionAmount").value),
            description: document.querySelector("#transactionDescription").value.trim(),
          });
          saveState();
          const saved = await flushCloudSave();
          closeModal();
          renderAll();
          if (!saved && cloudSync.enabled) {
            alert("Transaksi tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          }
        });
      }

      function openDebtForm() {
        if (!requireSignedIn()) return;
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
              <input id="debtAmount" type="number" min="0" step="1000" required />
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
        document.querySelector("#debtForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#debtForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          state.debts.push({
            id: id(),
            kind: document.querySelector("#debtKind").value,
            status: document.querySelector("#debtStatus").value,
            person: document.querySelector("#debtPerson").value.trim(),
            date: document.querySelector("#debtDate").value,
            dueDate: document.querySelector("#debtDueDate").value,
            amount: Number(document.querySelector("#debtAmount").value),
            description: document.querySelector("#debtDescription").value.trim(),
          });
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
                    <span>${money(item.amount)}</span>
                  </div>
                  <p style="margin-top: 7px; color: var(--muted); font-size: .9rem">${escapeHtml(item.description)}</p>
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
        if (!requireSignedIn()) return;
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
                <input id="recurringAmount" type="number" min="0" step="1000" required />
              </div>
              <div class="field">
                <label for="recurringDay">Tanggal setiap bulan</label>
                <input id="recurringDay" type="number" min="1" max="28" value="1" required />
              </div>
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
        document.querySelector("#recurringForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitButton = event.submitter || document.querySelector("#recurringForm .button.primary");
          submitButton.disabled = true;
          submitButton.textContent = "Menyimpan...";
          state.recurring.push({
            id: id(),
            type: document.querySelector("#recurringType").value,
            category: document.querySelector("#recurringCategory").value,
            amount: Number(document.querySelector("#recurringAmount").value),
            day: Number(document.querySelector("#recurringDay").value),
            description: document.querySelector("#recurringDescription").value.trim(),
            frequency: "monthly",
            active: true,
          });
          closeModal();
          await persistChanges("Transaksi berulang tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          openView("account");
        });
      }

      function openReminderForm() {
        if (!requireSignedIn()) return;
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

      function openBillReminderForm() {
        if (!requireSignedIn()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Reminder Tagihan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="billReminderForm">
            <div class="field">
              <label for="billTitle">Nama tagihan</label>
              <input id="billTitle" type="text" placeholder="Contoh: Internet, listrik, cicilan" required />
            </div>
            <div class="field">
              <label for="billCategory">Kategori</label>
              <select id="billCategory">
                ${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="billAmount">Nominal</label>
              <div class="currency-input">
                <span>Rp</span>
                <input id="billAmount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required />
              </div>
            </div>
            <div class="field">
              <label for="billDueDate">Jatuh tempo</label>
              <input id="billDueDate" type="date" value="${todayDate()}" required />
            </div>
            <div class="field">
              <label for="billNote">Catatan</label>
              <input id="billNote" type="text" placeholder="Opsional" />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan</button>
            </div>
          </form>
        `;
        showModal();
        attachRupiahInput("#billAmount");
        document.querySelector("#billReminderForm").addEventListener("submit", (event) => {
          event.preventDefault();
          state.billReminders.push(billReminder(
            document.querySelector("#billTitle").value.trim(),
            document.querySelector("#billCategory").value,
            parseFormattedNumber(document.querySelector("#billAmount").value),
            document.querySelector("#billDueDate").value,
            document.querySelector("#billNote").value.trim(),
            "unpaid",
          ));
          closeModal();
          renderAll();
        });
      }

      function openWalletForm() {
        if (!requireSignedIn()) return;
        document.querySelector("#modalTitle").textContent = "Kelola Dompet";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="walletForm">
            <div class="field">
              <label>Dompet saat ini</label>
              <div class="compact-list">${state.wallets.map((wallet) => `<span class="pill">${escapeHtml(wallet)}</span>`).join("")}</div>
            </div>
            <div class="field">
              <label for="walletName">Nama dompet baru</label>
              <input id="walletName" type="text" placeholder="Contoh: BCA, Dana, Tunai" required />
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Tambah Dompet</button>
            </div>
          </form>
        `;
        showModal();
        document.querySelector("#walletForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const wallet = document.querySelector("#walletName").value.trim();
          if (wallet && !state.wallets.includes(wallet)) state.wallets.push(wallet);
          closeModal();
          renderAll();
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
        if (!requireSignedIn()) return;
        const order = [...state.settings.dashboardMenuOrder];
        document.querySelector("#modalTitle").textContent = "Urutan Menu Dashboard";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="dashboardMenuForm">
            <div class="field">
              <label>Urutan saat ini</label>
              <div class="debt-list">
                ${order.map((view, index) => `
                  <article class="debt-item">
                    <div>
                      <strong>${escapeHtml(dashboardMenuViewLabel(view))}</strong>
                    </div>
                    <div class="row-actions">
                      <button class="button" type="button" data-menu-up="${view}" ${index === 0 ? "disabled" : ""}>↑</button>
                      <button class="button" type="button" data-menu-down="${view}" ${index === order.length - 1 ? "disabled" : ""}>↓</button>
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

        const move = (view, direction) => {
          const idx = order.indexOf(view);
          if (idx < 0) return;
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= order.length) return;
          [order[idx], order[target]] = [order[target], order[idx]];
          state.settings.dashboardMenuOrder = [...order];
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
          state.settings.dashboardMenuOrder = [...order];
          closeModal();
          renderAll();
        });
      }

      function openCategoryForm() {
        if (!requireSignedIn()) return;
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
            state.budgets.push({ category, limit: 0 });
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

      function openSavingsGoalForm() {
        if (!requireSignedIn()) return;
        document.querySelector("#modalTitle").textContent = "Tambah Tujuan Tabungan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="savingsGoalForm">
            <div class="field">
              <label for="savingsCategory">Kategori</label>
              <select id="savingsCategory" required>
                ${savingCategories.map((category) => `<option value="${category}">${category}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="savingsTarget">Nominal Target</label>
              <div class="currency-input">
                <span>Rp</span>
                <input id="savingsTarget" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required />
              </div>
            </div>
            <div class="field">
              <label for="savingsTargetDate">Kapan ingin dicapai</label>
              <input id="savingsTargetDate" type="date" value="${targetDateFromShortcut(12)}" required />
            </div>
            <div class="compact-list">
              <button class="button" type="button" data-target-months="6">6 Bulan</button>
              <button class="button" type="button" data-target-months="12">1 Tahun</button>
              <button class="button" type="button" data-target-months="24">2 Tahun</button>
              <button class="button" type="button" data-target-months="60">5 Tahun</button>
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-close-modal>Batal</button>
              <button class="button primary" type="submit">Simpan</button>
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
        document.querySelector("#savingsGoalForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const category = document.querySelector("#savingsCategory").value;
          state.savings.push(savingsGoal(category, parseFormattedNumber(document.querySelector("#savingsTarget").value), document.querySelector("#savingsTargetDate").value));
          closeModal();
          renderAll();
          openView("savings");
        });
      }

      function openSavingsDetail(goalId) {
        const goal = state.savings.find((item) => item.id === goalId);
        if (!goal) return;
        const balance = savingsBalance(goal);
        const percent = savingsPercent(goal);
        document.querySelector("#modalTitle").textContent = goal.title;
        document.querySelector("#modalBody").innerHTML = `
          <div class="form">
            <div class="budget-row">
              <div class="budget-row-top">
                <strong>${money(balance)}</strong>
                <span>Target ${money(goal.target)}</span>
              </div>
              <div class="progress"><i style="width: ${percent}%"></i></div>
              <div class="stat-sub">${percent}% tercapai - Target tanggal ${escapeHtml(goal.targetDate || "-")}</div>
            </div>
            <div class="row-actions">
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
        if (!requireSignedIn()) return;
        const goal = state.savings.find((item) => item.id === goalId);
        if (!goal) return;
        document.querySelector("#modalTitle").textContent = type === "withdraw" ? "Tarik Tabungan" : "Tambah Tabungan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="savingsEntryForm">
            <div class="field">
              <label for="savingsEntryAmount">Nominal</label>
              <div class="currency-input">
                <span>Rp</span>
                <input id="savingsEntryAmount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required />
              </div>
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
        document.querySelector("#savingsEntryForm").addEventListener("submit", (event) => {
          event.preventDefault();
          goal.entries = goal.entries || [];
          goal.entries.push(savingsEntry(type, document.querySelector("#savingsEntryDate").value, parseFormattedNumber(document.querySelector("#savingsEntryAmount").value), document.querySelector("#savingsEntryNote").value.trim()));
          closeModal();
          renderAll();
          openSavingsDetail(goal.id);
        });
      }

      function openPinForm() {
        if (!requireSignedIn()) return;
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
        if (!requireSignedIn()) return;
        document.querySelector("#modalTitle").textContent = "Reset Data Bulanan";
        document.querySelector("#modalBody").innerHTML = `
          <form class="form" id="monthlyResetForm">
            <div class="field">
              <label for="resetMonth">Bulan yang direset</label>
              <input id="resetMonth" type="month" value="${currentMonthKey()}" required />
            </div>
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
          if (!confirm(`Reset data bulan ${monthLabel(month)}? Data yang dihapus tidak akan tampil lagi setelah sync.`)) return;

          let removed = 0;
          if (resetTransactions) {
            const targets = state.transactions.filter((item) => monthOf(item) === month);
            targets.forEach((item) => markDeleted("transactions", item.id));
            state.transactions = state.transactions.filter((item) => monthOf(item) !== month);
            removed += targets.length;
          }
          if (resetDebts) {
            const targets = state.debts.filter((item) => item.date?.slice(0, 7) === month || item.dueDate?.slice(0, 7) === month);
            targets.forEach((item) => markDeleted("debts", item.id));
            state.debts = state.debts.filter((item) => item.date?.slice(0, 7) !== month && item.dueDate?.slice(0, 7) !== month);
            removed += targets.length;
          }
          if (resetBills) {
            const targets = state.billReminders.filter((item) => item.dueDate?.slice(0, 7) === month);
            targets.forEach((item) => markDeleted("billReminders", item.id));
            state.billReminders = state.billReminders.filter((item) => item.dueDate?.slice(0, 7) !== month);
            removed += targets.length;
          }
          if (resetSavings) {
            state.savings.forEach((goal) => {
              const before = goal.entries?.length || 0;
              goal.entries = (goal.entries || []).filter((entry) => monthOf(entry) !== month);
              removed += before - goal.entries.length;
            });
          }

          closeModal();
          await persistChanges("Reset bulanan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          alert(removed ? `${removed} data bulan ${monthLabel(month)} berhasil direset.` : `Tidak ada data pada bulan ${monthLabel(month)}.`);
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
          ["Tanggal", "Kategori", "Deskripsi", "Tipe", "Nominal"],
          ...state.transactions.map((item) => [item.date, item.category, item.description, item.type === "income" ? "Pemasukan" : "Pengeluaran", item.amount]),
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
              ${table("Transaksi", ["Tanggal", "Kategori", "Deskripsi", "Tipe", "Nominal"], state.transactions.map((item) => [item.date, item.category, item.description, item.type, item.amount]))}
              ${table("Anggaran", ["Kategori", "Batas"], state.budgets.map((item) => [item.category, item.limit]))}
              ${table("Hutang Piutang", ["Tanggal", "Jatuh Tempo", "Jenis", "Nama", "Deskripsi", "Nominal", "Status"], state.debts.map((item) => [item.date, item.dueDate, item.kind, item.person, item.description, item.amount, item.status]))}
              ${table("Tabungan", ["Judul", "Kategori", "Target", "Terkumpul", "Target Tanggal"], state.savings.map((item) => [item.title, item.category, item.target, savingsBalance(item), item.targetDate]))}
              ${table("Reminder Tagihan", ["Nama", "Kategori", "Nominal", "Jatuh Tempo", "Catatan", "Status"], state.billReminders.map((item) => [item.title, item.category, item.amount, item.dueDate, item.note, item.status]))}
              ${table("Transaksi Berulang", ["Jenis", "Kategori", "Deskripsi", "Nominal", "Tanggal Bulanan", "Status"], state.recurring.map((item) => [item.type, item.category, item.description, item.amount, item.day, item.active ? "Aktif" : "Nonaktif"]))}
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
          state.transactions.push({
            id: id(),
            recurringId: item.id,
            type: item.type,
            date,
            category: item.category,
            amount: Number(item.amount),
            description: `${item.description} (berulang)`,
          });
          created += 1;
        });

        await persistChanges("Transaksi berulang sudah diterapkan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        alert(created ? `${created} transaksi berulang diterapkan ke bulan ini.` : "Tidak ada transaksi berulang baru untuk diterapkan.");
      }

      function importJson(event) {
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
            state.transactions = normalized.transactions;
            state.budgets = normalized.budgets;
            state.debts = normalized.debts;
            state.savings = normalized.savings;
            state.billReminders = normalized.billReminders;
            state.recurring = normalized.recurring;
            state.categories = normalized.categories;
            state.wallets = normalized.wallets;
            state.deleted = normalized.deleted;
            state.settings = normalized.settings;
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
        if (!isGuest()) await loadCloudState();
        renderAll();
      }

      function showLogin() {
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
        const url = new URL(location.href);
        url.search = "?reset-password=1";
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

      async function loginCloud(email, password) {
        const client = setupCloudClient();
        if (!client) return { ok: false, message: "Koneksi login cloud belum aktif. Tutup lalu buka ulang aplikasi, atau perbarui aplikasi dari browser." };
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error || !data?.user) return { ok: false, message: error?.message || "Email atau password salah." };
        currentUser = buildUserFromCloud(data.user);
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
        const code = params.get("code");
        try {
          if (code) await client.auth.exchangeCodeForSession(code);
        } catch {
          showLogin();
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
        return buildUserFromCloud(user);
      }

      function logout() {
        localStorage.removeItem(sessionStorageKey);
        if (cloudSync.enabled) setupCloudClient()?.auth.signOut();
        currentUser = null;
        const stored = loadState();
        state.transactions = stored.transactions;
        state.budgets = stored.budgets;
        state.debts = stored.debts;
        state.savings = stored.savings;
        state.billReminders = stored.billReminders;
        state.recurring = stored.recurring;
        state.categories = stored.categories;
        state.wallets = stored.wallets;
        state.settings = stored.settings;
        openView("home");
        showLogin();
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
        if (!requireSignedIn()) return;
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

      document.querySelector("#addMenuButton").addEventListener("click", () => {
        document.querySelector("#addBlock").classList.toggle("open");
      });

      document.body.addEventListener("click", async (event) => {
        const opener = event.target.closest("[data-open-form]");
        if (opener?.dataset.openForm === "transaction") openTransactionForm();
        if (opener?.dataset.openForm === "debt") openDebtForm();
        if (opener?.dataset.openForm === "recurring") openRecurringForm();
        if (opener?.dataset.openForm === "reminder") openReminderForm();
        if (opener?.dataset.openForm === "billReminder") openBillReminderForm();
        if (opener?.dataset.openForm === "wallet") openWalletForm();
        if (opener?.dataset.openForm === "category") openCategoryForm();
        if (opener?.dataset.openForm === "dashboardMenu") openDashboardMenuForm();
        if (opener?.dataset.openForm === "savingsGoal") openSavingsGoalForm();        if (opener?.dataset.openForm === "pin") openPinForm();
        if (opener?.dataset.openForm === "feedback") openFeedbackForm();
        if (opener?.dataset.openForm === "thanks") openThanksPopup();
        if (opener?.dataset.openForm === "monthlyReset") openMonthlyResetForm();

        const passwordToggle = event.target.closest("[data-toggle-password]");
        if (passwordToggle) {
          const input = document.querySelector(`#${passwordToggle.dataset.togglePassword}`);
          const visible = input.type === "text";
          input.type = visible ? "password" : "text";
          passwordToggle.setAttribute("aria-label", visible ? "Tampilkan password" : "Sembunyikan password");
        }

        if (event.target.closest("[data-close-modal]")) closeModal();

        const savingsCard = event.target.closest("[data-open-savings]");
        if (savingsCard) {
          openSavingsDetail(savingsCard.dataset.openSavings);
        }

        const savingsEntryButton = event.target.closest("[data-savings-entry]");
        if (savingsEntryButton) {
          openSavingsEntryForm(savingsEntryButton.dataset.goalId, savingsEntryButton.dataset.savingsEntry);
        }

        const deleteButton = event.target.closest("[data-delete-transaction]");
        if (deleteButton) {
          if (!requireSignedIn()) return;
          const target = state.transactions.find((item) => item.id === deleteButton.dataset.deleteTransaction);
          if (target && confirm(`Hapus transaksi "${target.description}"?`)) {
            markDeleted("transactions", target.id);
            state.transactions = state.transactions.filter((item) => item.id !== target.id);
            await persistChanges("Transaksi sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          }
        }

        const categoryDeleteButton = event.target.closest("[data-delete-category]");
        if (categoryDeleteButton) {
          if (!requireSignedIn()) return;
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
          if (!requireSignedIn()) return;
          const target = state.debts.find((item) => item.id === debtButton.dataset.toggleDebt);
          if (target) {
            target.status = target.status === "paid" ? "unpaid" : "paid";
            closeModal();
            await persistChanges();
          }
        }

        const debtDeleteButton = event.target.closest("[data-delete-debt]");
        if (debtDeleteButton) {
          if (!requireSignedIn()) return;
          const target = state.debts.find((item) => item.id === debtDeleteButton.dataset.deleteDebt);
          if (target && confirm(`Hapus catatan "${target.person}"?`)) {
            markDeleted("debts", target.id);
            state.debts = state.debts.filter((item) => item.id !== target.id);
            closeModal();
            await persistChanges("Hutang/piutang sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          }
        }

        const billToggleButton = event.target.closest("[data-toggle-bill]");
        if (billToggleButton) {
          if (!requireSignedIn()) return;
          const target = state.billReminders.find((item) => item.id === billToggleButton.dataset.toggleBill);
          if (target) {
            target.status = target.status === "paid" ? "unpaid" : "paid";
            await persistChanges();
          }
        }

        const billDeleteButton = event.target.closest("[data-delete-bill]");
        if (billDeleteButton) {
          if (!requireSignedIn()) return;
          const target = state.billReminders.find((item) => item.id === billDeleteButton.dataset.deleteBill);
          if (target && confirm(`Hapus reminder tagihan "${target.title}"?`)) {
            markDeleted("billReminders", target.id);
            state.billReminders = state.billReminders.filter((item) => item.id !== target.id);
            await persistChanges();
          }
        }

        const recurringDeleteButton = event.target.closest("[data-delete-recurring]");
        if (recurringDeleteButton) {
          if (!requireSignedIn()) return;
          const target = state.recurring.find((item) => item.id === recurringDeleteButton.dataset.deleteRecurring);
          if (target && confirm(`Hapus transaksi berulang "${target.description}"?`)) {
            markDeleted("recurring", target.id);
            state.recurring = state.recurring.filter((item) => item.id !== target.id);
            await persistChanges("Transaksi berulang sudah dihapus di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
          }
        }
      });

      document.querySelector("#closeModalButton").addEventListener("click", closeModal);
      document.querySelector("#modal").addEventListener("click", (event) => {
        if (event.target.id === "modal") closeModal();
      });

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
      document.querySelector("#viewAllSavingsButton").addEventListener("click", () => openView("savings"));

      document.querySelector("#budgetForm").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!requireSignedIn()) return;
        const category = document.querySelector("#budgetCategory").value;
        const limit = Number(document.querySelector("#budgetLimit").value);
        const existing = state.budgets.find((item) => item.category === category);
        if (existing) existing.limit = limit;
        else state.budgets.push({ category, limit });
        document.querySelector("#budgetLimit").value = "";
        renderAll();
      });

      document.querySelector("#searchInput").addEventListener("input", () => {
        renderTransactions();
      });
      document.querySelector("#monthFilter").addEventListener("change", () => {
        renderTransactions();
        renderCategoryBreakdown();
        renderDailyExpenses();
      });
      document.querySelector("#typeFilter").addEventListener("change", renderTransactions);
      document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
      document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
      document.querySelector("#importJsonFile").addEventListener("change", importJson);
      document.querySelector("#exportExcelButton").addEventListener("click", exportExcel);
      document.querySelector("#debtHistoryButton").addEventListener("click", openDebtHistory);
      document.querySelector("#syncNowButton").addEventListener("click", async () => {
        if (!requireSignedIn()) return;
        const synced = await syncCloudState();
        alert(synced ? "Data berhasil disinkronkan dari cloud." : "Cloud belum bisa disinkronkan.");
      });
      document.querySelector("#applyRecurringButton").addEventListener("click", async () => {
        if (!requireSignedIn()) return;
        await applyRecurringThisMonth();
      });
      document.querySelector("#darkModeToggle").addEventListener("change", (event) => {
        state.settings.darkMode = event.target.checked;
        renderAll();
      });
      document.querySelector("#languageSelect").addEventListener("change", (event) => {
        state.settings.language = event.target.value;
        renderAll();
      });
      document.querySelector("#logoutButton").addEventListener("click", logout);
      document.querySelector("#deleteAccountButton").addEventListener("click", deleteCurrentAccount);
      document.querySelector("#loadDemoButton").addEventListener("click", () => {
        if (confirm("Muat ulang data contoh? Data saat ini akan diganti.")) {
          const fresh = demoState();
          const normalized = normalizeState(fresh);
          state.transactions = normalized.transactions;
          state.budgets = normalized.budgets;
          state.debts = normalized.debts;
          state.savings = normalized.savings;
          state.billReminders = normalized.billReminders;
          state.recurring = normalized.recurring;
          state.categories = normalized.categories;
          state.wallets = normalized.wallets;
          state.deleted = { transactions: [], debts: [], savings: [], billReminders: [], recurring: [] };
          state.settings = normalized.settings;
          renderAll();
        }
      });
      document.querySelector("#clearDataButton").addEventListener("click", () => {
        if (!requireAdmin()) return;
        if (confirm("Kosongkan semua data transaksi, anggaran, dan hutang piutang?")) {
          state.transactions = [];
          state.budgets = categories.map((category) => ({ category, limit: 0 }));
          state.debts = [];
          state.savings = [];
          state.billReminders = [];
          state.recurring = [];
          state.deleted = { transactions: [], debts: [], savings: [], billReminders: [], recurring: [] };
          renderAll();
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
