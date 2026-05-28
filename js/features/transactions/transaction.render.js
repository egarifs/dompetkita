window.AppTransactionRender = {
  createRenderer(deps) {
    const {
      editIcon,
      escapeHtml,
      getQuickTransactionRange,
      getSelectedCategoryFilter,
      getState,
      isChildUser,
      money,
      monthOf,
      quickRangeMatch,
      requireSignedIn,
      showModal,
      transactionDateLabel,
      transactionDateTimeLabel,
      transactionTypeLabel,
      trashIcon,
      walletName,
    } = deps;

    function renderCategoryChips() {
      const state = getState();
      const selectedCategoryFilter = getSelectedCategoryFilter();
      const target = document.querySelector("#categoryChipList");
      if (!target) return;
      const usedCategories = [...new Set(state.transactions.map((item) => item.category).filter(Boolean))];
      const items = ["all", ...usedCategories];
      target.innerHTML = items.map((category) => `
        <button class="filter-chip ${selectedCategoryFilter === category ? "active" : ""}" type="button" data-category-filter="${escapeHtml(category)}">
          ${category === "all" ? "Semua kategori" : escapeHtml(category)}
        </button>
      `).join("");
    }

    function renderWalletFilterOptions() {
      const state = getState();
      const select = document.querySelector("#walletFilter");
      if (!select) return;
      const current = select.value || "all";
      select.innerHTML = `<option value="all">Semua dompet</option>${state.wallets.map((wallet) => `<option value="${wallet.id}">${escapeHtml(wallet.name)}</option>`).join("")}`;
      select.value = [...select.options].some((option) => option.value === current) ? current : "all";
    }

    function rows(items, limit = null) {
      const visible = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit ?? items.length);
      if (!visible.length) {
        return `
          <div class="empty">
            <p>Belum ada transaksi yang cocok dengan filter ini.</p>
            <button class="button primary" type="button" data-open-form="transaction">Tambah Transaksi</button>
          </div>
        `;
      }

      return `
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kategori</th>
              <th>Dompet</th>
              <th>Deskripsi</th>
              <th>Tipe</th>
              <th>Nominal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${visible.map((item) => `
              <tr class="transaction-row ${item.type}" data-open-transaction-detail="${item.id}">
                <td>${escapeHtml(transactionDateLabel(item.date))}</td>
                <td><span class="pill">${escapeHtml(item.category)}</span></td>
                <td>${escapeHtml(walletName(item.walletId))}</td>
                <td>${escapeHtml(item.description)}</td>
                <td><span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span></td>
                <td class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
                <td>
                  <button class="icon-button" type="button" title="Edit transaksi" data-edit-transaction="${item.id}">
                    ${editIcon()}
                  </button>
                  <button class="icon-button" type="button" title="Hapus transaksi" data-delete-transaction="${item.id}">
                    ${trashIcon()}
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    function openDetail(transactionId) {
      const state = getState();
      if (!requireSignedIn()) return;
      const item = state.transactions.find((transaction) => transaction.id === transactionId);
      if (!item) return;
      const receiptUrl = item.receiptUrl || item.receiptImage || item.strukUrl || "";
      document.querySelector("#modalTitle").textContent = "Detail Transaksi";
      document.querySelector("#modalBody").innerHTML = `
        <div class="transaction-detail" id="transactionDetailView">
          <section class="receipt-preview">
            ${receiptUrl
              ? `<button class="receipt-preview-button" type="button" data-preview-receipt="${item.id}" aria-label="Lihat detail foto struk"><img src="${escapeHtml(receiptUrl)}" alt="Foto struk transaksi" /></button>`
              : `<div class="receipt-empty"><strong>Belum ada foto struk</strong><span>Unggah foto struk agar transaksi lebih mudah diaudit.</span></div>`}
          </section>
          ${isChildUser() ? "" : `
            <div class="row-actions receipt-actions">
              <label class="button receipt-upload" for="receiptUploadInput">${receiptUrl ? "Ganti Foto Struk" : "Unggah Foto Struk"}</label>
              ${receiptUrl ? `
                <button class="button" type="button" data-preview-receipt="${item.id}">Preview Struk</button>
                <button class="button danger" type="button" data-delete-receipt="${item.id}">Hapus Struk</button>
              ` : ""}
            </div>
            <input class="hidden" id="receiptUploadInput" type="file" accept="image/*" data-receipt-transaction="${item.id}" />
          `}
          <section class="transaction-detail-summary">
            <div>
              <span class="stat-label">Nominal</span>
              <strong class="amount ${item.type}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</strong>
            </div>
            <span class="pill ${item.type}">${escapeHtml(transactionTypeLabel(item))}</span>
          </section>
          <div class="compact-list transaction-detail-meta">
            <span class="pill">${escapeHtml(transactionDateLabel(item.date))}</span>
            <span class="pill">${escapeHtml(walletName(item.walletId))}</span>
            <span class="pill">${escapeHtml(item.category || "Lainnya")}</span>
            <span class="pill">${escapeHtml(item.sourceModule || "manual")}</span>
          </div>
          <div class="debt-row">
            <div class="debt-row-top">
              <div>
                <strong>Deskripsi</strong>
                <span>${escapeHtml(item.description || "-")}</span>
              </div>
            </div>
          </div>
          <div class="compact-list transaction-detail-meta">
            <span class="pill">Dibuat ${escapeHtml(transactionDateTimeLabel(item.createdAt))}</span>
            <span class="pill">Diubah ${escapeHtml(transactionDateTimeLabel(item.updatedAt))}</span>
          </div>
          <div class="row-actions">
            <button class="button" type="button" data-close-modal>Tutup</button>
            ${isChildUser() ? "" : `
              <button class="button" type="button" data-edit-transaction="${item.id}">Edit</button>
              <button class="button danger" type="button" data-delete-transaction="${item.id}">Hapus</button>
            `}
          </div>
        </div>
      `;
      showModal();
    }

    function openReceiptPreview(transactionId) {
      const state = getState();
      const item = state.transactions.find((transaction) => transaction.id === transactionId);
      const receiptUrl = item?.receiptUrl || item?.receiptImage || item?.strukUrl || "";
      if (!item || !receiptUrl) return;
      document.querySelector("#modalTitle").textContent = "Preview Struk";
      document.querySelector("#modalBody").innerHTML = `
        <div class="receipt-preview-detail">
          <img src="${escapeHtml(receiptUrl)}" alt="Preview struk transaksi" />
          <div class="row-actions">
            <button class="button" type="button" data-open-transaction-detail="${item.id}">Kembali ke Detail</button>
            ${isChildUser() ? "" : `<button class="button danger" type="button" data-delete-receipt="${item.id}">Hapus Struk</button>`}
          </div>
        </div>
      `;
      showModal();
    }

    function renderTransactions() {
      const state = getState();
      renderWalletFilterOptions();
      renderCategoryChips();
      const latestTarget = document.querySelector("#latestTransactions");
      if (latestTarget) latestTarget.innerHTML = rows(state.transactions, 5);
      const query = document.querySelector("#searchInput")?.value.toLowerCase().trim() || "";
      const month = document.querySelector("#monthFilter")?.value || "all";
      const type = document.querySelector("#typeFilter")?.value || "all";
      const wallet = document.querySelector("#walletFilter")?.value || "all";
      const selectedCategoryFilter = getSelectedCategoryFilter();
      const filtered = state.transactions
        .filter((item) => month === "all" || monthOf(item) === month)
        .filter((item) => type === "all" || item.transactionType === type || item.type === type)
        .filter((item) => wallet === "all" || item.walletId === wallet)
        .filter((item) => selectedCategoryFilter === "all" || item.category === selectedCategoryFilter)
        .filter((item) => quickRangeMatch(item, getQuickTransactionRange()))
        .filter((item) => `${item.category} ${item.description} ${walletName(item.walletId)}`.toLowerCase().includes(query));
      document.querySelector("#allTransactions").innerHTML = rows(filtered);
    }

    return {
      openDetail,
      openReceiptPreview,
      renderCategoryChips,
      renderTransactions,
      renderWalletFilterOptions,
      rows,
    };
  },
};
