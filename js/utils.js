window.AppUtils = {
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

  id() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },

  money(value) {
    return window.AppConstants.rupiah.format(Number(value || 0));
  },

  formatNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  },

  parseFormattedNumber(value) {
    return Number(String(value || "").replace(/\D/g, ""));
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },
};