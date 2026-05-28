window.AppUtils = {
  ...(window.AppUtils || {}),

  todayDate() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  },

  currentMonthKey() {
    return window.AppUtils.todayDate().slice(0, 7);
  },

  previousMonthKey(month = window.AppUtils.currentMonthKey()) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(year, monthNumber - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  },

  monthLabel(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  },
};
