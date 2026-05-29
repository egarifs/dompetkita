window.AppWalletService = {
  createService(deps) {
    const {
      getState,
      currentUserId,
      escapeHtml,
      id,
      markDeleted,
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

    function hasDuplicateName(name, editingId = "") {
      const state = getState();
      const normalizedName = String(name || "").trim().toLowerCase();
      return state.wallets.some((wallet) => wallet.id !== editingId && wallet.name.toLowerCase() === normalizedName);
    }

    function createWallet({ name, initialBalance = 0, type = "Cash" }) {
      const state = getState();
      const wallet = record(name, initialBalance, type);
      state.wallets.push(wallet);
      return wallet;
    }

    function updateWallet(walletId, { name, initialBalance = 0, type = "Cash" }) {
      const state = getState();
      const wallet = state.wallets.find((item) => item.id === walletId);
      if (!wallet) return null;
      Object.assign(wallet, normalizeWallet({
        ...wallet,
        name,
        initialBalance,
        type,
        userId: wallet.userId || currentUserId(),
        updatedAt: new Date().toISOString(),
      }));
      return wallet;
    }

    function deleteBlockReason(walletId) {
      if (inUse(walletId)) return "Dompet tidak bisa dihapus karena sudah digunakan pada transaksi.";
      return "";
    }

    function deleteWallet(walletId) {
      const state = getState();
      const blockedReason = deleteBlockReason(walletId);
      if (blockedReason) return { ok: false, message: blockedReason, wallet: null };
      const wallet = state.wallets.find((item) => item.id === walletId);
      if (!wallet) return { ok: false, message: "Dompet tidak ditemukan.", wallet: null };
      if (typeof markDeleted === "function") markDeleted("wallets", walletId);
      state.wallets = state.wallets.filter((item) => item.id !== walletId);
      return { ok: true, message: "", wallet };
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
      createWallet,
      defaultId,
      deleteBlockReason,
      deleteWallet,
      ensureTransactionWallets,
      hasDuplicateName,
      inUse,
      name,
      options,
      recalculateBalances,
      record,
      updateWallet,
    };
  },
};
