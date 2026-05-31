window.AppWalletForm = {
  createController(deps) {
    const {
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
    } = deps;

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
        if (walletHasDuplicateName(name, editing?.id || "")) return alert("Nama dompet sudah digunakan.");
        if (editing) updateWallet(editing.id, { name, initialBalance, type });
        else createWallet({ name, initialBalance, type });
        closeModal();
        await persistChanges(editing
          ? "Dompet diperbarui di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun."
          : "Dompet dibuat di perangkat, tetapi belum berhasil tersinkron ke database. Coba tekan Sync di menu Akun.");
        showSnackbar(editing ? "Dompet berhasil diperbarui." : "Dompet berhasil dibuat.");
      });
    }

    return { openWalletForm };
  },
};
