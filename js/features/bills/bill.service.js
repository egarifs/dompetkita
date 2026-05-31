window.AppBillReminderService = {
  createService({ currentMonthKey, getState, todayDate }) {
    function dayDifference(dueDate) {
      if (!dueDate) return 0;
      const today = new Date(`${todayDate()}T00:00:00`);
      const due = new Date(`${dueDate}T00:00:00`);
      return Math.round((due.getTime() - today.getTime()) / 86400000);
    }

    function status(item) {
      if (item.status === "paid") return "paid";
      const days = dayDifference(item.dueDate);
      if (days < 0) return "overdue";
      if (days <= 7) return "nearing";
      return "safe";
    }

    function dueLabel(item) {
      if (item.status === "paid") return "Terbayar";
      const days = dayDifference(item.dueDate);
      if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
      if (days === 0) return "Jatuh tempo hari ini";
      return `${days} hari lagi`;
    }

    function summary() {
      const unpaid = getState().billReminders.filter((item) => item.status !== "paid");
      return {
        dueThisMonth: unpaid.filter((item) => String(item.dueDate || "").slice(0, 7) === currentMonthKey()).length,
        totalUnpaid: unpaid.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      };
    }

    function sorted() {
      return [...getState().billReminders].sort((a, b) => {
        if (a.status !== b.status) return a.status === "paid" ? 1 : -1;
        return String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
      });
    }

    function budgetAmount(category) {
      const budget = getState().budgets.find((item) => (
        item.isActive !== false
        && item.type === "expense"
        && (item.category === category || item.name === category)
      ));
      return budget ? Number(budget.budgetLimit ?? budget.limit ?? 0) : "";
    }

    return {
      budgetAmount,
      dayDifference,
      dueLabel,
      sorted,
      status,
      summary,
    };
  },
};
