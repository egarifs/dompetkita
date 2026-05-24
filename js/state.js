window.AppState = {
  mergeById(primary = [], secondary = []) {
    const map = new Map();
    primary.forEach((item) => map.set(item.id, item));
    secondary.forEach((item) => map.set(item.id, item));
    return [...map.values()];
  },

  deletionList(data, collection) {
    return Array.isArray(data?.deleted?.[collection]) ? data.deleted[collection] : [];
  },

  mergeDeletedIds(cloudData, localData, collection) {
    return [...new Set([
      ...window.AppState.deletionList(cloudData, collection),
      ...window.AppState.deletionList(localData, collection),
    ])];
  },

  withoutDeleted(items = [], deletedIds = []) {
    const deleted = new Set(deletedIds);
    return items.filter((item) => !deleted.has(item.id));
  },

  tx(id, type, date, category, description, amount, meta = {}) {
    const timestamp = meta.createdAt || new Date().toISOString();
    return {
      id,
      type,
      date,
      category,
      description,
      amount: Number(amount),
      subcategory: meta.subcategory || "",
      sourceModule: meta.sourceModule || "manual",
      sourceId: meta.sourceId || "",
      createdAt: timestamp,
      updatedAt: meta.updatedAt || timestamp,
      ...meta,
    };
  },

  normalizeTransaction(item) {
    const sourceModule = item.sourceModule || (item.vehicleId ? "vehicles" : item.recurringId ? "recurring" : "manual");
    const sourceId = item.sourceId || item.vehicleRecordId || item.recurringId || "";
    const timestamp = item.createdAt || (item.date ? `${item.date}T00:00:00.000Z` : new Date().toISOString());
    return {
      ...item,
      id: item.id,
      type: item.type || "expense",
      date: item.date || "",
      category: item.category || "Lainnya",
      description: item.description || "",
      amount: Number(item.amount || 0),
      subcategory: item.subcategory || "",
      sourceModule,
      sourceId,
      createdAt: timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  },

  savingsEntry(id, type, date, amount, note, meta = {}) {
    const timestamp = meta.createdAt || new Date().toISOString();
    return {
      id,
      type,
      date,
      amount: Number(amount),
      note,
      createdAt: timestamp,
      updatedAt: meta.updatedAt || timestamp,
      ...meta,
    };
  },

  savingsGoal(id, todayDate, category, target, targetDate, entries = []) {
    return {
      id,
      title: category,
      category,
      target: Number(target),
      targetDate,
      createdAt: todayDate,
      updatedAt: new Date().toISOString(),
      entries,
    };
  },

  normalizeSavingsEntry(entry) {
    const timestamp = entry.createdAt || (entry.date ? `${entry.date}T00:00:00.000Z` : new Date().toISOString());
    return {
      ...entry,
      id: entry.id,
      type: entry.type || "deposit",
      date: entry.date || "",
      amount: Number(entry.amount || 0),
      note: entry.note || "",
      createdAt: timestamp,
      updatedAt: entry.updatedAt || timestamp,
    };
  },

  normalizeSavingsGoal(goal) {
    const timestamp = goal.updatedAt || goal.createdAt || new Date().toISOString();
    return {
      ...goal,
      target: Number(goal.target || 0),
      entries: Array.isArray(goal.entries) ? goal.entries.map(window.AppState.normalizeSavingsEntry) : [],
      updatedAt: timestamp,
    };
  },

  billReminder(id, title, category, amount, dueDate, note = "", status = "unpaid") {
    return { id, title, category, amount: Number(amount), dueDate, note, status };
  },

  normalizeState(data, deps) {
    const { defaultCategories, translations } = deps;
    const deleted = {
      transactions: window.AppState.deletionList(data, "transactions"),
      debts: window.AppState.deletionList(data, "debts"),
      savings: window.AppState.deletionList(data, "savings"),
      billReminders: window.AppState.deletionList(data, "billReminders"),
      recurring: window.AppState.deletionList(data, "recurring"),
      vehicles: window.AppState.deletionList(data, "vehicles"),
      vehicleServices: window.AppState.deletionList(data, "vehicleServices"),
      vehicleOilChanges: window.AppState.deletionList(data, "vehicleOilChanges"),
      vehicleParts: window.AppState.deletionList(data, "vehicleParts"),
      vehicleTaxes: window.AppState.deletionList(data, "vehicleTaxes"),
    };
    return {
      transactions: window.AppState.withoutDeleted(Array.isArray(data.transactions) ? data.transactions : [], deleted.transactions).map(window.AppState.normalizeTransaction),
      budgets: Array.isArray(data.budgets) ? data.budgets : [],
      debts: window.AppState.withoutDeleted(Array.isArray(data.debts) ? data.debts : [], deleted.debts),
      savings: window.AppState.withoutDeleted(Array.isArray(data.savings) ? data.savings : [], deleted.savings).map(window.AppState.normalizeSavingsGoal),
      billReminders: window.AppState.withoutDeleted(Array.isArray(data.billReminders) ? data.billReminders : [], deleted.billReminders),
      recurring: window.AppState.withoutDeleted(Array.isArray(data.recurring) ? data.recurring : [], deleted.recurring),
      vehicles: window.AppState.withoutDeleted(Array.isArray(data.vehicles) ? data.vehicles : [], deleted.vehicles),
      vehicleServices: window.AppState.withoutDeleted(Array.isArray(data.vehicleServices) ? data.vehicleServices : [], deleted.vehicleServices),
      vehicleOilChanges: window.AppState.withoutDeleted(Array.isArray(data.vehicleOilChanges) ? data.vehicleOilChanges : [], deleted.vehicleOilChanges),
      vehicleParts: window.AppState.withoutDeleted(Array.isArray(data.vehicleParts) ? data.vehicleParts : [], deleted.vehicleParts),
      vehicleTaxes: window.AppState.withoutDeleted(Array.isArray(data.vehicleTaxes) ? data.vehicleTaxes : [], deleted.vehicleTaxes),
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : [...defaultCategories],
      wallets: Array.isArray(data.wallets) && data.wallets.length ? data.wallets : ["Tunai", "Bank"],
      deleted,
      settings: {
        reminderEnabled: Boolean(data.settings?.reminderEnabled),
        reminderTime: data.settings?.reminderTime || "20:00",
        darkMode: Boolean(data.settings?.darkMode),
        cloudSyncEnabled: data.settings?.cloudSyncEnabled !== false,
        language: translations[data.settings?.language] ? data.settings.language : "id",
        pin: data.settings?.pin || "",
        homeSectionOrder: Array.isArray(data.settings?.homeSectionOrder) && data.settings.homeSectionOrder.length
          ? data.settings.homeSectionOrder
          : ["chartBudget", "budgetMonth", "insight", "latestTransactions", "savings", "billReminder"],
        incomeVisible: Boolean(data.settings?.incomeVisible),
        totalBalanceVisible: Boolean(data.settings?.totalBalanceVisible),
        remainingBudgetVisible: Boolean(data.settings?.remainingBudgetVisible),
        debtSummaryVisible: Boolean(data.settings?.debtSummaryVisible),
        dashboardMenuOrder: Array.isArray(data.settings?.dashboardMenuOrder) && data.settings.dashboardMenuOrder.length
          ? data.settings.dashboardMenuOrder
          : ["home", "reports", "budgets", "account"],
      },
    };
  },

  demoState(deps) {
    const {
      currentMonthKey,
      previousMonthKey,
      tx,
      savingsGoal,
      savingsEntry,
      billReminder,
      id,
      defaultCategories,
    } = deps;
    const month = currentMonthKey();
    const prev = previousMonthKey(month);
    return {
      transactions: [
        tx("income", `${month}-01`, "Lainnya", "Saldo awal bulan", 3500000),
        tx("expense", `${month}-02`, "Makanan", "Belanja dapur mingguan", 420000),
        tx("expense", `${month}-04`, "Transportasi", "Bensin dan parkir", 185000),
        tx("expense", `${month}-07`, "Tagihan", "Internet rumah", 330000),
        tx("income", `${month}-10`, "Lainnya", "Pemasukan proyek kecil", 1250000),
        tx("expense", `${month}-13`, "Kesehatan", "Vitamin dan obat", 210000),
        tx("expense", `${month}-17`, "Belanja", "Perlengkapan kerja", 575000),
        tx("expense", `${prev}-08`, "Makanan", "Makan di luar", 620000),
        tx("expense", `${prev}-16`, "Transportasi", "Transport bulan lalu", 310000),
        tx("expense", `${prev}-22`, "Tagihan", "Tagihan listrik", 480000),
        tx("income", `${prev}-25`, "Lainnya", "Pemasukan bulan lalu", 2800000),
      ],
      budgets: [
        { category: "Makanan", limit: 1600000 },
        { category: "Transportasi", limit: 800000 },
        { category: "Tagihan", limit: 1200000 },
        { category: "Belanja", limit: 1000000 },
        { category: "Kesehatan", limit: 650000 },
        { category: "Hiburan", limit: 500000 },
        { category: "Pendidikan", limit: 500000 },
        { category: "Lainnya", limit: 700000 },
      ],
      debts: [
        { id: id(), kind: "receivable", person: "Rina", date: `${month}-06`, dueDate: `${month}-28`, description: "Piutang makan bersama", amount: 150000, status: "unpaid" },
        { id: id(), kind: "payable", person: "Budi", date: `${month}-09`, dueDate: `${month}-24`, description: "Pinjam sementara", amount: 300000, status: "unpaid" },
      ],
      savings: [
        savingsGoal("Dana Darurat", 50000000, `${Number(month.slice(0, 4)) + 1}-${month.slice(5, 7)}-01`, [savingsEntry("deposit", `${month}-05`, 1000000, "Setoran awal")]),
        savingsGoal("Pendidikan", 25000000, `${Number(month.slice(0, 4)) + 2}-${month.slice(5, 7)}-01`, [savingsEntry("deposit", `${month}-08`, 750000, "Tabungan sekolah"), savingsEntry("deposit", `${month}-18`, 500000, "Tambahan bulanan")]),
        savingsGoal("Pernikahan", 80000000, `${Number(month.slice(0, 4)) + 3}-${month.slice(5, 7)}-01`, [savingsEntry("deposit", `${month}-11`, 2000000, "Setoran bersama")]),
        savingsGoal("Liburan", 12000000, `${month}-28`, [savingsEntry("deposit", `${month}-03`, 1500000, "Dana liburan"), savingsEntry("withdraw", `${month}-14`, 250000, "Booking tiket")]),
      ],
      billReminders: [
        billReminder("Internet rumah", "Tagihan", 330000, `${month}-07`, "Paket bulanan", "unpaid"),
        billReminder("Listrik", "Tagihan", 480000, `${month}-20`, "Token/listrik bulanan", "unpaid"),
        billReminder("Cicilan motor", "Transportasi", 950000, `${month}-25`, "Angsuran bulanan", "paid"),
      ],
      recurring: [{ id: id(), type: "expense", category: "Tagihan", description: "Internet bulanan", amount: 330000, frequency: "monthly", day: 7, active: true }],
      categories: [...defaultCategories],
      wallets: ["Tunai", "Bank", "E-Wallet"],
      settings: { reminderEnabled: false, reminderTime: "20:00", darkMode: false, language: "id", pin: "" },
    };
  },
};
