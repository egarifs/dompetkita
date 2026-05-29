window.AppWalletService = {
  createService(deps) {
    const {
      getState,
      currentUserId,
      escapeHtml,
      id,
      money,
      normalizeWallet,
    } = deps;

    function record(name, initialBalance = 0, type = "Cash") {
      const timestamp = new Date().toISOString();
      return normalizeWallet({
        id: id(),
        userId: currentUserId(),
        name,
        initialBalance,
        currentBalance: initialBalance,
        type,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    function name(walletId) {
      const state = getState();
      return state.wallets.find((wallet) => wallet.id === walletId)?.name || "Tanpa dompet";
    }

    function inUse(walletId) {
      const state = getState();
      return state.transactions.some((item) => item.walletId === walletId);
    }

    function deleteBlockReason(walletId) {
      const state = getState();
      if (state.wallets.length <= 1) return "Minimal harus ada satu dompet aktif.";
      if (inUse(walletId)) return "Dompet tidak bisa dihapus karena sudah digunakan pada transaksi.";
      return "";
    }

    function options(selectedId = "") {
      const state = getState();
      if (!state.wallets.length) return `<option value="">Belum ada dompet</option>`;
      return state.wallets.map((wallet) => `<option value="${wallet.id}" ${wallet.id === selectedId ? "selected" : ""}>${escapeHtml(wallet.name)} - ${money(wallet.currentBalance || 0)}</option>`).join("");
    }

    function defaultId() {
      const state = getState();
      return state.wallets[0]?.id || "";
    }

    function ensureTransactionWallets() {
      const state = getState();
      if (!state.wallets.length) return;
      const fallbackWalletId = state.wallets[0].id;
      state.transactions.forEach((transaction) => {
        if (!transaction.walletId) transaction.walletId = fallbackWalletId;
      });
    }

    function recalculateBalances() {
      const state = getState();
      state.wallets.forEach((wallet) => {
        wallet.currentBalance = Number(wallet.initialBalance || 0);
      });
      state.transactions.forEach((transaction) => {
        const wallet = state.wallets.find((item) => item.id === transaction.walletId);
        if (!wallet) return;
        const amount = Number(transaction.amount || 0);
        wallet.currentBalance += transaction.type === "income" ? amount : -amount;
      });
    }

    return {
      defaultId,
      deleteBlockReason,
      ensureTransactionWallets,
      inUse,
      name,
      options,
      recalculateBalances,
      record,
    };
  },
};
