window.AppSavingsForm = {
  createController(deps) {
    const {
      attachRupiahInput,
      closeModal,
      openSavingsDetail,
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
    } = deps;

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

    return {
      openSavingsEntryForm,
      openSavingsGoalForm,
      targetDateFromShortcut,
    };
  },
};
