global.window = global;

await import("../js/core/state.js");
await import("../js/features/bills/bill.service.js");
await import("../js/features/bills/bill.form.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const state = {
  billReminders: [
    { id: "late", title: "Air", amount: 120000, dueDate: "2026-05-28", status: "unpaid" },
    { id: "near", title: "Listrik", amount: 850000, dueDate: "2026-06-05", status: "unpaid" },
    { id: "safe", title: "Internet", amount: 450000, dueDate: "2026-06-10", status: "unpaid" },
    { id: "paid", title: "Cicilan", amount: 1900000, dueDate: "2026-06-01", status: "paid" },
  ],
  budgets: [
    { id: "budget-internet", name: "Internet", category: "Internet", type: "expense", budgetLimit: 450000, isActive: true },
    { id: "budget-inactive", name: "Air", category: "Air", type: "expense", budgetLimit: 120000, isActive: false },
  ],
};

const service = window.AppBillReminderService.createService({
  currentMonthKey: () => "2026-06",
  getState: () => state,
  todayDate: () => "2026-05-31",
});

assert(service.status(state.billReminders[0]) === "overdue", "Tagihan lewat jatuh tempo harus berstatus terlambat.");
assert(service.status(state.billReminders[1]) === "nearing", "Tagihan 1-7 hari harus berstatus mendekati.");
assert(service.status(state.billReminders[2]) === "safe", "Tagihan lebih dari 7 hari harus berstatus aman.");
assert(service.status(state.billReminders[3]) === "paid", "Tagihan lunas harus berstatus terbayar.");
assert(service.dueLabel(state.billReminders[0]) === "Terlambat 3 hari", "Label keterlambatan tidak sesuai.");
assert(service.summary().totalUnpaid === 1420000, "Summary hanya boleh menjumlahkan tagihan belum dibayar.");
assert(service.summary().dueThisMonth === 2, "Summary bulan berjalan hanya boleh menghitung tagihan belum dibayar.");
assert(service.budgetAmount("Internet") === 450000, "Budget aktif harus menjadi nominal awal.");
assert(service.budgetAmount("Air") === "", "Budget nonaktif tidak boleh menjadi nominal awal.");

const normalized = window.AppState.normalizeBillReminder({ amount: "850000", status: "unpaid" });
assert(typeof normalized.amount === "number" && normalized.amount === 850000, "Nominal reminder harus dinormalisasi menjadi number.");

const elements = new Map();
function element(value = "") {
  return {
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    innerHTML: "",
    listeners: {},
    value,
  };
}
elements.set("#modalTitle", element());
elements.set("#modalBody", element());
elements.set("#billCategory", element("Internet"));
elements.set("#billAmount", element());
elements.set("#billReminderForm", element());
global.document = {
  querySelector(selector) {
    return elements.get(selector) || element();
  },
};

const form = window.AppBillReminderForm.createController({
  attachRupiahInput: () => {},
  billReminder: window.AppState.billReminder,
  categorySelectOptions: () => "",
  closeModal: () => {},
  escapeHtml: (value) => String(value ?? ""),
  formatRupiah: (value) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`,
  openView: () => {},
  parseFormattedNumber: Number,
  persistChanges: async () => {},
  requirePrimaryAccount: () => true,
  rupiahInputHtml: () => "",
  service,
  showModal: () => {},
  state,
  todayDate: () => "2026-05-31",
});
form.openBillReminderForm();
assert(elements.get("#billAmount").value === "Rp450.000", "Form harus mengisi nominal dari budget aktif kategori terpilih.");
elements.get("#billCategory").value = "Air";
elements.get("#billCategory").listeners.change();
assert(elements.get("#billAmount").value === "", "Form harus mengosongkan nominal jika kategori tidak punya budget aktif.");

console.log("Bill reminder service OK");
