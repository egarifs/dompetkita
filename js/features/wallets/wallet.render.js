window.AppWalletRender = {
  createRenderer(deps) {
    const {
      clearSelectedWalletDetailId,
      escapeHtml,
      getSelectedWalletDetailId,
      getState,
      money,
      monthLabel,
      monthOf,
      openView,
      recalculateWalletBalances,
      requireSignedIn,
      setSelectedWalletDetailId,
      transactionDateLabel,
      transactionTypeLabel,
      editIcon,
      trashIcon,
    } = deps;

    function mutationRows(items) {
      if (!items.length) {
        return `<div class="empty"><p>Belum ada mutasi yang cocok dengan filter ini.</p></div>`;
      }
      const groups = [...items]
        .sort((a, b) => b.date.localeCompare(a.date))
        .reduce((result, item) => {
          const month = monthOf(item) || "Tanpa bulan";
          if (!result[month]) result[month] = [];
          result[month].push(item);
          return result;
        }, {});

      return Object.entries(groups).map(([month, rows]) => `
        <section class="wallet-mutation-month">
          <h4>${escapeHtml(month === "Tanpa bulan" ? month : monthLabel(month))}</h4>
          <table class="transaction-table wallet-mutation-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Tipe</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((item) => `
                <tr class="transaction-row ${item.type}" data-open-transaction-detail="${item.id}">
                  <td>${escapeHtml(transactionDateLabel(item.date))}</td>
                  <td><span class="pill">${escapeHtml(item.category || "Lainnya")}</span></td>
                  <td><span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span></td>
                  <td class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
      `).join("");
    }

    function renderMutationMonthOptions(walletId) {
      const state = getState();
      const input = document.querySelector("#walletMutationMonth");
      if (!input) return;
      const months = [...new Set(state.transactions.filter((item) => item.walletId === walletId).map(monthOf).filter(Boolean))].sort().reverse();
      if (!input.value && months.length) input.value = months[0];
    }

    function renderDetail() {
      const state = getState();
      const selectedWalletDetailId = getSelectedWalletDetailId();
      const view = document.querySelector("#walletDetailView");
      if (!view || !selectedWalletDetailId) return;
      recalculateWalletBalances();
      const wallet = state.wallets.find((item) => item.id === selectedWalletDetailId);
      if (!wallet) {
        clearSelectedWalletDetailId();
        openView("wallets", { replace: true });
        return;
      }
      document.querySelector("#walletDetailType").textContent = wallet.type || "Dompet";
      document.querySelector("#walletDetailName").textContent = wallet.name;
      document.querySelector("#walletDetailInitial").textContent = `Saldo awal ${money(wallet.initialBalance || 0)}`;
      document.querySelector("#walletDetailBalance").textContent = money(wallet.currentBalance || 0);
      renderMutationMonthOptions(wallet.id);

      const query = document.querySelector("#walletMutationSearch")?.value.toLowerCase().trim() || "";
      const month = document.querySelector("#walletMutationMonth")?.value || "";
      const start = document.querySelector("#walletMutationStartDate")?.value || "";
      const end = document.querySelector("#walletMutationEndDate")?.value || "";
      const rows = state.transactions
        .filter((item) => item.walletId === wallet.id)
        .filter((item) => !month || monthOf(item) === month)
        .filter((item) => !start || item.date >= start)
        .filter((item) => !end || item.date <= end)
        .filter((item) => `${item.category} ${item.type === "income" ? "credit pemasukan" : "debit pengeluaran"}`.toLowerCase().includes(query));

      document.querySelector("#walletMutationList").innerHTML = mutationRows(rows);
    }

    function openDetail(walletId) {
      const state = getState();
      if (!requireSignedIn()) return;
      if (!state.wallets.some((wallet) => wallet.id === walletId)) return;
      setSelectedWalletDetailId(walletId);
      ["#walletMutationSearch", "#walletMutationMonth", "#walletMutationStartDate", "#walletMutationEndDate"].forEach((selector) => {
        const input = document.querySelector(selector);
        if (input) input.value = "";
      });
      openView("walletDetail");
      renderDetail();
    }

    function card(wallet, compact = false) {
      const isMinus = Number(wallet.currentBalance || 0) < 0;
      return `
        <article class="wallet-card ${isMinus ? "negative" : ""}" data-open-wallet-detail="${wallet.id}" tabindex="0" role="button" aria-label="Buka detail dompet ${escapeHtml(wallet.name)}">
          <div>
            <span class="stat-label">${escapeHtml(wallet.type || "Dompet")}</span>
            <strong>${escapeHtml(wallet.name)}</strong>
            <span class="stat-sub">Saldo awal ${money(wallet.initialBalance || 0)}</span>
          </div>
          <div class="wallet-balance">
            <strong>${money(wallet.currentBalance || 0)}</strong>
            ${isMinus ? `<span class="pill expense">Minus</span>` : `<span class="pill income">Aktif</span>`}
          </div>
          ${compact ? "" : `
            <div class="row-actions wallet-actions">
              <button class="icon-button" type="button" data-edit-wallet="${wallet.id}" title="Edit dompet">${editIcon()}</button>
              <button class="icon-button danger" type="button" data-delete-wallet="${wallet.id}" title="Hapus dompet">${trashIcon()}</button>
            </div>
          `}
        </article>
      `;
    }

    function renderWallets() {
      const state = getState();
      recalculateWalletBalances();
      const total = state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0);
      const homeTarget = document.querySelector("#homeWalletList");
      if (homeTarget) {
        homeTarget.innerHTML = state.wallets.length
          ? state.wallets.slice(0, 4).map((wallet) => card(wallet, true)).join("")
          : `<div class="empty"><p>Belum ada dompet.</p><button class="button primary" type="button" data-open-form="wallet">Tambah Dompet</button></div>`;
      }
      const walletTarget = document.querySelector("#walletList");
      if (walletTarget) {
        walletTarget.innerHTML = state.wallets.length
          ? state.wallets.map((wallet) => card(wallet)).join("")
          : `<div class="empty"><p>Belum ada dompet.</p><button class="button primary" type="button" data-open-form="wallet">Tambah Dompet</button></div>`;
      }
      const totalLabel = document.querySelector("#walletTotalBalance");
      if (totalLabel) totalLabel.textContent = money(total);
      const countLabel = document.querySelector("#walletCount");
      if (countLabel) countLabel.textContent = String(state.wallets.length);
    }

    return {
      card,
      mutationRows,
      openDetail,
      renderDetail,
      renderMutationMonthOptions,
      renderWallets,
    };
  },
};
