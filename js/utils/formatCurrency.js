window.AppUtils = {
  ...(window.AppUtils || {}),

  money(value) {
    return window.AppConstants.rupiah.format(Number(value || 0));
  },

  formatRupiah(value) {
    const amount = window.AppUtils.parseRupiahToNumber(value);
    if (!amount) return "";
    return `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;
  },

  parseRupiahToNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return 0;
    const number = Number(digits);
    return Number.isFinite(number) ? number : 0;
  },

  formatNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  },

  parseFormattedNumber(value) {
    return window.AppUtils.parseRupiahToNumber(value);
  },
};
