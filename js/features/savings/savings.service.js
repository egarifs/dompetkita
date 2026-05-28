window.AppSavingsService = {
  createService(deps) {
    const {
      id,
      savingsEntry,
      savingsGoal,
      todayDate,
    } = deps;

    function entry(type, date, amount, note) {
      return savingsEntry(id(), type, date, amount, note);
    }

    function goal(category, target, targetDate, entries = []) {
      return savingsGoal(id(), todayDate(), category, target, targetDate, entries);
    }

    function balance(goal) {
      return (goal.entries || []).reduce((sum, entry) => sum + (entry.type === "withdraw" ? -Number(entry.amount || 0) : Number(entry.amount || 0)), 0);
    }

    function percent(goal) {
      if (!goal.target) return 0;
      return Math.min(100, Math.max(0, Math.round((balance(goal) / Number(goal.target)) * 100)));
    }

    function isAchieved(goal) {
      return Number(goal?.target || 0) > 0 && balance(goal) >= Number(goal.target || 0);
    }

    return {
      balance,
      entry,
      goal,
      isAchieved,
      percent,
    };
  },
};
