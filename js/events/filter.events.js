window.AppFilterEvents = {
  register(deps) {
    const {
      renderBudgetProgress,
      renderCategoryBreakdown,
      renderDailyExpenses,
      renderTransactions,
      renderVehicleExpenses,
      renderWalletDetail,
      setQuickTransactionRange,
    } = deps;

    document.querySelector("#searchInput").addEventListener("input", renderTransactions);
    document.querySelector("#monthFilter").addEventListener("change", () => {
      const quickRange = document.querySelector("#monthFilter").value === "all" ? "all" : "month";
      setQuickTransactionRange(quickRange);
      document.querySelectorAll("[data-quick-range]").forEach((button) => button.classList.toggle("active", button.dataset.quickRange === quickRange));
      renderTransactions();
      renderCategoryBreakdown();
      renderDailyExpenses();
    });
    document.querySelector("#budgetProgressMonth").addEventListener("change", renderBudgetProgress);
    document.querySelector("#budgetProgressYear").addEventListener("change", renderBudgetProgress);
    document.querySelector("#typeFilter").addEventListener("change", (event) => {
      document.querySelectorAll("[data-transaction-type-tab]").forEach((button) => button.classList.toggle("active", button.dataset.transactionTypeTab === event.target.value));
      renderTransactions();
    });
    document.querySelector("#walletFilter").addEventListener("change", renderTransactions);
    ["#walletMutationSearch", "#walletMutationMonth", "#walletMutationStartDate", "#walletMutationEndDate"].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("input", renderWalletDetail);
      document.querySelector(selector)?.addEventListener("change", renderWalletDetail);
    });
    document.querySelector("#vehicleExpenseVehicleFilter").addEventListener("change", renderVehicleExpenses);
    document.querySelector("#vehicleExpenseMonthFilter").addEventListener("change", renderVehicleExpenses);
    document.querySelector("#vehicleExpenseTypeFilter").addEventListener("change", renderVehicleExpenses);
  },
};
