window.AppDebtService = {
  createService(deps) {
    const { getState } = deps;

    function paymentTransactionTypeForDebt(debt) {
      return debt?.kind === "receivable" ? "receivable_payment" : "debt_payment";
    }

    function transactionPaymentDebtId(transaction) {
      return transaction.debtId || transaction.receivableId || "";
    }

    function isPaymentTransaction(transaction) {
      return transaction?.transactionType === "debt_payment"
        || transaction?.transactionType === "receivable_payment"
        || transaction?.debtPaymentType === "debt_payment"
        || transaction?.debtPaymentType === "receivable_payment";
    }

    function paymentTransactions(debtId, options = {}) {
      const state = getState();
      return state.transactions.filter((transaction) => {
        if (!isPaymentTransaction(transaction)) return false;
        if (transactionPaymentDebtId(transaction) !== debtId) return false;
        if (options.excludeTransactionId && transaction.id === options.excludeTransactionId) return false;
        return true;
      });
    }

    function paidAmount(debt, options = {}) {
      return paymentTransactions(debt.id, options).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    }

    function remainingAmount(debt, options = {}) {
      return Math.max(0, Number(debt?.totalAmount ?? debt?.amount ?? 0) - paidAmount(debt, options));
    }

    function syncPaymentState() {
      const state = getState();
      state.debts.forEach((debt) => {
        const totalAmount = Number(debt.totalAmount ?? debt.amount ?? 0);
        const payments = paymentTransactions(debt.id);
        const keepManualPaid = !payments.length && debt.status === "paid" && Number(debt.paidAmount || 0) >= totalAmount && !(debt.relatedTransactionIds || []).length;
        const paid = payments.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const effectivePaidAmount = keepManualPaid ? totalAmount : paid;
        const remaining = Math.max(0, totalAmount - effectivePaidAmount);
        debt.amount = totalAmount;
        debt.totalAmount = totalAmount;
        debt.paidAmount = effectivePaidAmount;
        debt.remainingAmount = remaining;
        debt.relatedTransactionIds = payments.map((transaction) => transaction.id);
        debt.paymentHistory = payments.map((transaction) => ({
          transactionId: transaction.id,
          date: transaction.date,
          amount: Number(transaction.amount || 0),
          walletId: transaction.walletId || "",
        }));
        debt.status = remaining <= 0 && totalAmount > 0 ? "paid" : effectivePaidAmount > 0 ? "partial" : "unpaid";
      });
    }

    function active(kind) {
      const state = getState();
      return state.debts.filter((item) => item.kind === kind && item.status !== "paid");
    }

    return {
      active,
      isPaymentTransaction,
      paidAmount,
      paymentTransactionTypeForDebt,
      paymentTransactions,
      remainingAmount,
      syncPaymentState,
      transactionPaymentDebtId,
    };
  },
};
