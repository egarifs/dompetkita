window.AppVehicleService = {
  createService({
    defaultWalletId,
    escapeHtml,
    getState,
    markDeleted,
    setCategories,
    todayDate,
    transactionRecord,
    updateTransactionRecord,
  }) {
    function vehicleName(vehicleId) {
      const state = getState();
      const vehicle = state.vehicles.find((item) => item.id === vehicleId);
      return vehicle ? vehicle.name : "Kendaraan";
    }

    function ensureVehicleCategory() {
      const state = getState();
      if (!state.categories.includes("Kendaraan")) {
        state.categories.push("Kendaraan");
        setCategories(state.categories);
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
      const state = getState();
      if (!state.vehicles.length) return `<option value="">Belum ada kendaraan</option>`;
      return state.vehicles.map((vehicle) => `<option value="${vehicle.id}" ${vehicle.id === selectedId ? "selected" : ""}>${escapeHtml(vehicle.name)} - ${escapeHtml(vehicle.plate)}</option>`).join("");
    }

    function vehicleTransactions() {
      const state = getState();
      return state.transactions.filter((item) => item.category === "Kendaraan" || item.vehicleId || item.sourceModule === "vehicles");
    }

    function upsertVehicleTransaction(record, subcategory, amount, date, description) {
      const state = getState();
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
      const state = getState();
      if (!record?.transactionId) return;
      markDeleted("transactions", record.transactionId);
      state.transactions = state.transactions.filter((item) => item.id !== record.transactionId);
    }

    return {
      addMonths,
      daysUntil,
      ensureVehicleCategory,
      removeVehicleTransaction,
      upsertVehicleTransaction,
      vehicleName,
      vehicleOptions,
      vehicleStatusBySchedule,
      vehicleTransactions,
    };
  },
};
