window.AppDebtRender = {
  createRenderer(deps) {
    const {
      appIcon,
      debtPaymentTransactions,
      escapeHtml,
      getState,
      money,
      transactionDateLabel,
      trashIcon,
      walletName,
    } = deps;

    function paymentHistoryHtml(debt) {
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

    function renderDebts() {
      const state = getState();
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
            ${paymentHistoryHtml(item)}
            <div class="tags" style="display:flex; flex-wrap:wrap; gap:7px; margin-top:10px">
              <span class="pill debt">Tanggal ${escapeHtml(item.date)}</span>
              <span class="pill debt">Jatuh tempo ${escapeHtml(item.dueDate || "-")}</span>
              <span class="pill ${item.status === "partial" ? "debt" : item.status === "paid" ? "income" : "expense"}">${item.status === "partial" ? "Sebagian" : item.status === "paid" ? "Lunas" : "Belum lunas"}</span>
              <button class="icon-button" type="button" title="Ubah status" data-toggle-debt="${item.id}">
                ${appIcon("check", 17)}
              </button>
              <button class="icon-button" type="button" title="Hapus hutang piutang" data-delete-debt="${item.id}">
                ${trashIcon()}
              </button>
            </div>
          </article>
        `).join("");
    }

    return {
      paymentHistoryHtml,
      renderDebts,
    };
  },
};
