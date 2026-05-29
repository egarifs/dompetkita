window.AppVehicleRender = {
  createRenderer({
    addMonths,
    appIcon,
    currentMonthKey,
    editIcon,
    escapeHtml,
    formatNumber,
    getState,
    money,
    monthOf,
    todayDate,
    trashIcon,
    vehicleName,
    vehicleOptions,
    vehicleStatusBySchedule,
    vehicleTransactions,
  }) {
    function latestVehicleOil(vehicleId) {
      const state = getState();
      return [...state.vehicleOilChanges].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (b.lastOilDate || "").localeCompare(a.lastOilDate || ""))[0];
    }

    function nearestVehiclePart(vehicleId) {
      const state = getState();
      return [...state.vehicleParts].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (partNextDate(a) || "9999").localeCompare(partNextDate(b) || "9999"))[0];
    }

    function nearestVehicleService(vehicleId) {
      const state = getState();
      return [...state.vehicleServices].filter((item) => item.vehicleId === vehicleId).sort((a, b) => (b.serviceDate || "").localeCompare(a.serviceDate || ""))[0];
    }

    function vehicleTax(vehicleId) {
      const state = getState();
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
      appIcon();
    }

    function renderVehicleDashboard() {
      const state = getState();
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
      const state = getState();
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
      const state = getState();
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
      const state = getState();
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
      const state = getState();
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
      const state = getState();
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

    return {
      latestVehicleOil,
      nearestVehiclePart,
      nearestVehicleService,
      oilNextDate,
      oilNextKm,
      partNextDate,
      partNextKm,
      renderVehicleDashboard,
      renderVehicleExpenseFilters,
      renderVehicleExpenses,
      renderVehicleList,
      renderVehicleOilChanges,
      renderVehicleParts,
      renderVehicleServices,
      renderVehicleTaxes,
      renderVehicles,
      vehicleBadge,
      vehicleMonthlyTotal,
      vehicleTax,
      vehicleYearTotal,
    };
  },
};
