window.AppBillReminderForm = {
  createController(deps) {
    const {
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
      service,
      showModal,
      state,
      todayDate,
    } = deps;

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
              ${categorySelectOptions(editing?.category || "")}
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
      const categoryInput = document.querySelector("#billCategory");
      const amountInput = document.querySelector("#billAmount");
      const fillAmountFromBudget = () => {
        const amount = service.budgetAmount(categoryInput.value);
        amountInput.value = amount === "" ? "" : formatRupiah(amount);
      };
      categoryInput.addEventListener("change", fillAmountFromBudget);
      if (!editing) fillAmountFromBudget();

      document.querySelector("#billReminderForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = {
          title: document.querySelector("#billTitle").value.trim(),
          category: categoryInput.value,
          amount: Number(parseFormattedNumber(amountInput.value)),
          dueDate: document.querySelector("#billDueDate").value,
          note: document.querySelector("#billNote").value.trim(),
        };
        if (values.amount <= 0) return alert("Nominal reminder tagihan wajib lebih dari 0.");
        if (editing) Object.assign(editing, values, { updatedAt: new Date().toISOString() });
        else state.billReminders.push(billReminder(values.title, values.category, values.amount, values.dueDate, values.note, "unpaid"));
        closeModal();
        await persistChanges("Reminder tagihan tersimpan di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        openView("billReminders");
      });
    }

    return { openBillReminderForm };
  },
};
