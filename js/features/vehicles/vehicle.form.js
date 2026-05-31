window.AppVehicleForm = {
  createController(deps) {
    const {
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
    } = deps;
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


    return {
      openVehicleExpenseForm,
      openVehicleForm,
      openVehicleOilForm,
      openVehiclePartForm,
      openVehicleServiceForm,
      openVehicleTaxForm,
      requireVehicleData,
    };
  },
};