window.AppState = {
  mergeById(primary = [], secondary = []) {
    const map = new Map();
    primary.forEach((item) => map.set(item.id, item));
    secondary.forEach((item) => {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
        return;
      }
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (!Number.isFinite(existingTime) || !Number.isFinite(itemTime) || itemTime >= existingTime) {
        map.set(item.id, item);
      }
    });
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

  toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const normalized = text.replace(/[^\d-]/g, "");
    return Number(normalized || 0);
  },

  transactionSourceModule(item = {}) {
    if (item.sourceModule) return item.sourceModule;
    if (item.vehicleId || item.vehicleRecordId) return "vehicles";
    if (item.recurringId) return "recurring";
    return "manual";
  },

  transactionSourceId(item = {}) {
    if (item.sourceId) return item.sourceId;
    if (item.debtId) return item.debtId;
    if (item.receivableId) return item.receivableId;
    if (item.vehicleRecordId) return item.vehicleRecordId;
    if (item.recurringId) return item.recurringId;
    return "";
  },

  walletIdFromName(name = "") {
    const slug = String(name || "wallet")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `wallet-${slug || "default"}`;
  },

  budgetIdFromName(name = "", index = 0) {
    const slug = String(name || "budget")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `budget-${slug || index + 1}`;
  },

  normalizeWallet(item, index = 0) {
    const now = new Date().toISOString();
    if (typeof item === "string") {
      return {
        id: window.AppState.walletIdFromName(item),
        userId: "",
        name: item,
        initialBalance: 0,
        currentBalance: 0,
        type: item.toLowerCase().includes("bank") ? "Bank" : "Cash",
        color: "",
        icon: "",
        createdAt: now,
        updatedAt: now,
      };
    }
    const name = item?.name || item?.label || `Dompet ${index + 1}`;
    const createdAt = item?.createdAt || now;
    return {
      ...item,
      id: item?.id || window.AppState.walletIdFromName(name),
      userId: item?.userId || "",
      name,
      initialBalance: window.AppState.toNumber(item?.initialBalance ?? item?.openingBalance ?? 0),
      currentBalance: window.AppState.toNumber(item?.currentBalance ?? item?.initialBalance ?? item?.openingBalance ?? 0),
      type: item?.type || "Cash",
      color: item?.color || "",
      icon: item?.icon || "",
      createdAt,
      updatedAt: item?.updatedAt || createdAt,
    };
  },

  tx(id, type, date, category, description, amount, meta = {}) {
    const timestamp = meta.createdAt || new Date().toISOString();
    return {
      ...meta,
      id,
      type,
      date,
      category,
      description,
      amount: window.AppState.toNumber(amount),
      subcategory: meta.subcategory || "",
      budgetId: meta.budgetId || meta.categoryId || "",
      sourceModule: window.AppState.transactionSourceModule(meta),
      sourceId: window.AppState.transactionSourceId(meta),
      walletId: meta.walletId || meta.dompetId || "",
      createdAt: timestamp,
      updatedAt: meta.updatedAt || timestamp,
    };
  },

  normalizeTransaction(item) {
    const sourceModule = window.AppState.transactionSourceModule(item);
    const sourceId = window.AppState.transactionSourceId(item);
    const timestamp = item.createdAt || (item.date ? `${item.date}T00:00:00.000Z` : new Date().toISOString());
    const transactionType = item.transactionType || item.debtPaymentType || item.type || "expense";
    const type = transactionType === "debt_payment" ? "expense" : transactionType === "receivable_payment" ? "income" : item.type || "expense";
    return {
      ...item,
      id: item.id,
      type,
      transactionType,
      date: item.date || "",
      category: item.category || "Lainnya",
      description: item.description || "",
      amount: window.AppState.toNumber(item.amount || 0),
      subcategory: item.subcategory || "",
      budgetId: item.budgetId || item.categoryId || "",
      sourceModule,
      sourceId,
      walletId: item.walletId || item.dompetId || "",
      debtId: item.debtId || "",
      receivableId: item.receivableId || "",
      debtPaymentType: item.debtPaymentType || (transactionType === "debt_payment" || transactionType === "receivable_payment" ? transactionType : ""),
      createdAt: timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  },

  normalizeBudget(item = {}, index = 0) {
    const now = new Date().toISOString();
    const name = item.name || item.category || `Anggaran ${index + 1}`;
    const timestamp = item.createdAt || now;
    const budgetLimit = window.AppState.toNumber(item.budgetLimit ?? item.limit ?? 0);
    return {
      ...item,
      id: item.id || window.AppState.budgetIdFromName(name, index),
      userId: item.userId || "",
      name,
      category: item.category || name,
      type: ["expense", "income", "debt_payment", "receivable_payment"].includes(item.type) ? item.type : "expense",
      parentId: item.parentId || null,
      budgetLimit,
      limit: budgetLimit,
      usedAmount: window.AppState.toNumber(item.usedAmount || 0),
      remainingAmount: window.AppState.toNumber(item.remainingAmount ?? budgetLimit),
      period: item.period || "monthly",
      icon: item.icon || "",
      color: item.color || "",
      isActive: item.isActive !== false,
      createdAt: timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  },

  normalizeDebt(item = {}) {
    const totalAmount = window.AppState.toNumber(item.totalAmount ?? item.amount ?? 0);
    const paidAmount = window.AppState.toNumber(item.paidAmount || 0);
    const remainingAmount = Math.max(0, window.AppState.toNumber(item.remainingAmount ?? (totalAmount - paidAmount)));
    const normalizedStatus = item.status === "paid" ? "paid" : paidAmount > 0 ? "partial" : item.status === "partial" ? "partial" : "unpaid";
    return {
      ...item,
      id: item.id,
      kind: item.kind || "payable",
      status: remainingAmount <= 0 ? "paid" : normalizedStatus === "paid" ? "unpaid" : normalizedStatus,
      person: item.person || "",
      date: item.date || "",
      dueDate: item.dueDate || "",
      amount: totalAmount,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentHistory: Array.isArray(item.paymentHistory) ? item.paymentHistory : [],
      relatedTransactionIds: Array.isArray(item.relatedTransactionIds) ? item.relatedTransactionIds : [],
      description: item.description || "",
    };
  },

  savingsEntry(id, type, date, amount, note, meta = {}) {
    const timestamp = meta.createdAt || new Date().toISOString();
    return {
      id,
      type,
      date,
      amount: window.AppState.toNumber(amount),
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
      target: window.AppState.toNumber(target),
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
      amount: window.AppState.toNumber(entry.amount || 0),
      note: entry.note || "",
      createdAt: timestamp,
      updatedAt: entry.updatedAt || timestamp,
    };
  },

  normalizeSavingsGoal(goal) {
    const timestamp = goal.updatedAt || goal.createdAt || new Date().toISOString();
    return {
      ...goal,
      target: window.AppState.toNumber(goal.target || 0),
      entries: Array.isArray(goal.entries) ? goal.entries.map(window.AppState.normalizeSavingsEntry) : [],
      updatedAt: timestamp,
    };
  },

  familyMember(id, parentUserId, childEmail, childName, phone = "", status = "active", meta = {}) {
    const timestamp = meta.createdAt || new Date().toISOString();
    return {
      id,
      parentUserId,
      childUserId: meta.childUserId || "",
      childEmail: String(childEmail || "").trim().toLowerCase(),
      childName,
      phone,
      role: "child",
      status,
      createdAt: timestamp,
      updatedAt: meta.updatedAt || timestamp,
    };
  },

  normalizeFamilyMember(item = {}) {
    const timestamp = item.createdAt || new Date().toISOString();
    return {
      ...item,
      id: item.id || item.childUserId || item.childEmail || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parentUserId: item.parentUserId || "",
      childUserId: item.childUserId || "",
      childEmail: String(item.childEmail || item.email || "").trim().toLowerCase(),
      childName: item.childName || item.name || "",
      phone: item.phone || "",
      role: "child",
      status: item.status === "inactive" ? "inactive" : "active",
      createdAt: timestamp,
      updatedAt: item.updatedAt || timestamp,
    };
  },

  billReminder(id, title, category, amount, dueDate, note = "", status = "unpaid") {
    return { id, title, category, amount: window.AppState.toNumber(amount), dueDate, note, status };
  },

  normalizeBillReminder(item = {}) {
    return {
      ...item,
      amount: window.AppState.toNumber(item.amount),
      status: item.status === "paid" ? "paid" : "unpaid",
    };
  },

  normalizeState(data, deps) {
    const { defaultCategories, translations } = deps;
    const deleted = {
      transactions: window.AppState.deletionList(data, "transactions"),
      debts: window.AppState.deletionList(data, "debts"),
      savings: window.AppState.deletionList(data, "savings"),
      billReminders: window.AppState.deletionList(data, "billReminders"),
      budgets: window.AppState.deletionList(data, "budgets"),
      recurring: window.AppState.deletionList(data, "recurring"),
      wallets: window.AppState.deletionList(data, "wallets"),
      vehicles: window.AppState.deletionList(data, "vehicles"),
      vehicleServices: window.AppState.deletionList(data, "vehicleServices"),
      vehicleOilChanges: window.AppState.deletionList(data, "vehicleOilChanges"),
      vehicleParts: window.AppState.deletionList(data, "vehicleParts"),
      vehicleTaxes: window.AppState.deletionList(data, "vehicleTaxes"),
      familyMembers: window.AppState.deletionList(data, "familyMembers"),
    };
    return {
      syncStatus: ["synced", "pending", "failed"].includes(data.syncStatus) ? data.syncStatus : "synced",
      localChangedAt: data.localChangedAt || "",
      transactions: window.AppState.withoutDeleted(Array.isArray(data.transactions) ? data.transactions : [], deleted.transactions).map(window.AppState.normalizeTransaction),
      budgets: window.AppState.withoutDeleted(Array.isArray(data.budgets) ? data.budgets : [], deleted.budgets).map(window.AppState.normalizeBudget),
      debts: window.AppState.withoutDeleted(Array.isArray(data.debts) ? data.debts : [], deleted.debts).map(window.AppState.normalizeDebt),
      savings: window.AppState.withoutDeleted(Array.isArray(data.savings) ? data.savings : [], deleted.savings).map(window.AppState.normalizeSavingsGoal),
      billReminders: window.AppState.withoutDeleted(Array.isArray(data.billReminders) ? data.billReminders : [], deleted.billReminders).map(window.AppState.normalizeBillReminder),
      recurring: window.AppState.withoutDeleted(Array.isArray(data.recurring) ? data.recurring : [], deleted.recurring),
      wallets: window.AppState.withoutDeleted(Array.isArray(data.wallets) ? data.wallets : [], deleted.wallets).map(window.AppState.normalizeWallet),
      vehicles: window.AppState.withoutDeleted(Array.isArray(data.vehicles) ? data.vehicles : [], deleted.vehicles),
      vehicleServices: window.AppState.withoutDeleted(Array.isArray(data.vehicleServices) ? data.vehicleServices : [], deleted.vehicleServices),
      vehicleOilChanges: window.AppState.withoutDeleted(Array.isArray(data.vehicleOilChanges) ? data.vehicleOilChanges : [], deleted.vehicleOilChanges),
      vehicleParts: window.AppState.withoutDeleted(Array.isArray(data.vehicleParts) ? data.vehicleParts : [], deleted.vehicleParts),
      vehicleTaxes: window.AppState.withoutDeleted(Array.isArray(data.vehicleTaxes) ? data.vehicleTaxes : [], deleted.vehicleTaxes),
      familyMembers: window.AppState.withoutDeleted(Array.isArray(data.familyMembers) ? data.familyMembers : [], deleted.familyMembers).map(window.AppState.normalizeFamilyMember),
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : [...defaultCategories],
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
          : ["wallets", "insight", "latestTransactions"],
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
      wallets: [
        { id: "wallet-cash", userId: "", name: "Cash", initialBalance: 500000, currentBalance: 0, type: "Cash", color: "", icon: "", createdAt: `${month}-01T00:00:00.000Z`, updatedAt: `${month}-01T00:00:00.000Z` },
        { id: "wallet-bank-bca", userId: "", name: "Bank BCA", initialBalance: 2000000, currentBalance: 0, type: "Bank", color: "", icon: "", createdAt: `${month}-01T00:00:00.000Z`, updatedAt: `${month}-01T00:00:00.000Z` },
        { id: "wallet-e-wallet", userId: "", name: "E-Wallet", initialBalance: 150000, currentBalance: 0, type: "E-Wallet", color: "", icon: "", createdAt: `${month}-01T00:00:00.000Z`, updatedAt: `${month}-01T00:00:00.000Z` },
      ],
      settings: { reminderEnabled: false, reminderTime: "20:00", darkMode: false, language: "id", pin: "" },
    };
  },
};
