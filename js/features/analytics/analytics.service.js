window.AppAnalyticsService = {
  createService(deps) {
    const {
      budgetDisplayName,
      getState,
      transactionMatchesBudget,
      transactionTypeMatchesBudget,
    } = deps;

    function budgetStatus(percent) {
      if (percent > 100) return { label: "Melebihi Budget", className: "danger", key: "over" };
      if (percent > 90) return { label: "Hampir Habis", className: "warn", key: "nearly" };
      if (percent > 70) return { label: "Perlu Dipantau", className: "watch", key: "watch" };
      return { label: "Aman", className: "success", key: "safe" };
    }

    function periodKey(year, month) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }

    function activeBudgets() {
      return getState().budgets.filter((budget) => budget.isActive !== false);
    }

    function budgetById(budgetId) {
      return activeBudgets().find((budget) => budget.id === budgetId);
    }

    function childBudgets(parentId) {
      return activeBudgets().filter((budget) => budget.parentId === parentId);
    }

    function descendants(budget) {
      return childBudgets(budget.id).flatMap((child) => [child, ...descendants(child)]);
    }

    function directTransactions(budget, selectedPeriod) {
      return getState().transactions
        .filter((transaction) => String(transaction.date || "").slice(0, 7) === selectedPeriod)
        .filter((transaction) => transactionTypeMatchesBudget(transaction, budget))
        .filter((transaction) => transactionMatchesBudget(transaction, budget));
    }

    function transactionsForBudget(budget, selectedPeriod) {
      const budgets = [budget, ...descendants(budget)];
      const transactions = budgets.flatMap((item) => directTransactions(item, selectedPeriod));
      return [...new Map(transactions.map((transaction) => [transaction.id, transaction])).values()]
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    }

    function progressForBudget(budget, selectedPeriod) {
      const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
      const transactions = transactionsForBudget(budget, selectedPeriod);
      const actual = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const remaining = limit - actual;
      const percent = limit > 0 ? Math.round((actual / limit) * 100) : actual > 0 ? 101 : 0;
      return {
        actual,
        budget,
        limit,
        name: budgetDisplayName(budget),
        percent,
        remaining,
        status: budgetStatus(percent),
        transactions,
      };
    }

    function progressRows(year, month) {
      const selectedPeriod = periodKey(year, month);
      return activeBudgets()
        .filter((budget) => !budget.parentId)
        .map((budget) => progressForBudget(budget, selectedPeriod))
        .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, "id"));
    }

    function summary(rows) {
      const counts = { safe: 0, watch: 0, nearly: 0, over: 0 };
      rows.forEach((row) => {
        counts[row.status.key] += 1;
      });
      const totalPlan = rows.reduce((sum, row) => sum + row.limit, 0);
      const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
      return {
        counts,
        totalActual,
        totalPlan,
        totalRemaining: totalPlan - totalActual,
      };
    }

    return {
      budgetById,
      budgetStatus,
      periodKey,
      progressForBudget,
      progressRows,
      summary,
      transactionsForBudget,
    };
  },
};
