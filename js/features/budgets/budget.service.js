window.AppBudgetService = {
  createService(deps) {
    const {
      escapeHtml,
      getCategories,
      getState,
      setCategories,
      currentMonthKey,
      transactionsByMonth,
    } = deps;

    function active(type = "") {
      const state = getState();
      return state.budgets.filter((budget) => budget.isActive !== false && (!type || budget.type === type));
    }

    function byId(budgetId) {
      const state = getState();
      return state.budgets.find((budget) => budget.id === budgetId);
    }

    function children(parentId) {
      return active().filter((budget) => budget.parentId === parentId);
    }

    function displayName(budget) {
      const parent = budget?.parentId ? byId(budget.parentId) : null;
      return parent ? `${parent.name} - ${budget.name}` : budget?.name || budget?.category || "";
    }

    function typeLabel(type) {
      if (type === "income") return "Pemasukan";
      if (type === "debt_payment") return "Bayar Hutang";
      if (type === "receivable_payment") return "Terima Piutang";
      return "Pengeluaran";
    }

    function transactionTypeMatches(transaction, budget) {
      const transactionType = transaction.transactionType || transaction.debtPaymentType || transaction.type;
      return transactionType === budget.type;
    }

    function transactionMatches(transaction, budget) {
      if (!budget) return false;
      return transaction.budgetId === budget.id || (!transaction.budgetId && transaction.category === (budget.category || budget.name));
    }

    function usedAmount(budget, month = currentMonthKey()) {
      const childItems = children(budget.id);
      const selfUsed = transactionsByMonth(month)
        .filter((item) => transactionTypeMatches(item, budget))
        .filter((item) => transactionMatches(item, budget))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const childUsed = childItems.reduce((sum, child) => sum + usedAmount(child, month), 0);
      return selfUsed + childUsed;
    }

    function remainingAmount(budget, month = currentMonthKey()) {
      return Number(budget?.budgetLimit ?? budget?.limit ?? 0) - usedAmount(budget, month);
    }

    function options(type = "expense", selectedId = "") {
      const parents = active(type).filter((budget) => !budget.parentId);
      return parents.map((parent) => {
        const childItems = children(parent.id).filter((child) => child.type === type);
        return `
          <option value="${parent.id}" ${selectedId === parent.id ? "selected" : ""}>${escapeHtml(parent.name)}</option>
          ${childItems.map((child) => `<option value="${child.id}" ${selectedId === child.id ? "selected" : ""}>-- ${escapeHtml(child.name)}</option>`).join("")}
        `;
      }).join("");
    }

    function syncCategoriesFromBudgets() {
      const state = getState();
      const names = active().map((budget) => budget.name).filter(Boolean);
      state.categories = [...new Set([...(state.categories || []), ...names])];
      setCategories(state.categories?.length ? state.categories : getCategories());
    }

    function hasCircularParent(budgetId, parentId) {
      let cursor = parentId;
      while (cursor) {
        if (cursor === budgetId) return true;
        cursor = byId(cursor)?.parentId || null;
      }
      return false;
    }

    function validateSubLimit({ parentId, budgetLimit, editingId = "" }) {
      if (!parentId) return true;
      const parent = byId(parentId);
      if (!parent || !Number(parent.budgetLimit || parent.limit || 0)) return true;
      const siblingTotal = active()
        .filter((budget) => budget.parentId === parentId && budget.id !== editingId)
        .reduce((sum, budget) => sum + Number(budget.budgetLimit ?? budget.limit ?? 0), 0);
      return siblingTotal + Number(budgetLimit || 0) <= Number(parent.budgetLimit ?? parent.limit ?? 0);
    }

    function syncUsageState(month = currentMonthKey()) {
      const state = getState();
      state.budgets.forEach((budget) => {
        const spent = budget.isActive === false ? Number(budget.usedAmount || 0) : usedAmount(budget, month);
        const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
        budget.usedAmount = spent;
        budget.remainingAmount = limit - spent;
        budget.limit = limit;
        budget.budgetLimit = limit;
      });
    }

    return {
      active,
      byId,
      children,
      displayName,
      hasCircularParent,
      options,
      remainingAmount,
      syncCategoriesFromBudgets,
      syncUsageState,
      transactionMatches,
      transactionTypeMatches,
      typeLabel,
      usedAmount,
      validateSubLimit,
    };
  },
};
