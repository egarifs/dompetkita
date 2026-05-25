window.AppStorage = {
  loadState(storageKey, normalizeState, emptyState) {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored && Array.isArray(stored.transactions) && Array.isArray(stored.budgets) && Array.isArray(stored.debts)) {
        return normalizeState(stored);
      }
    } catch {
      return emptyState();
    }
    return emptyState();
  },

  saveState(storageKey, state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  },
};
