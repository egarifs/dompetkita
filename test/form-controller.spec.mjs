global.window = global;

await import("../js/features/wallets/wallet.form.js");
await import("../js/features/savings/savings.form.js");
await import("../js/features/vehicles/vehicle.form.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const blocked = () => false;
const walletForm = window.AppWalletForm.createController({
  attachRupiahInput: () => {},
  closeModal: () => {},
  createWallet: () => {},
  escapeHtml: (value) => String(value ?? ""),
  parseFormattedNumber: Number,
  persistChanges: async () => {},
  requirePrimaryAccount: blocked,
  rupiahInputHtml: () => "",
  showModal: () => {},
  showSnackbar: () => {},
  state: { wallets: [] },
  updateWallet: () => {},
  walletHasDuplicateName: () => false,
});
assert(typeof walletForm.openWalletForm === "function", "Wallet form controller tidak mengekspor openWalletForm.");
assert(walletForm.openWalletForm() === undefined, "Wallet form tidak menghormati guard akun utama.");

const savingsForm = window.AppSavingsForm.createController({
  attachRupiahInput: () => {},
  closeModal: () => {},
  openSavingsDetail: () => {},
  openView: () => {},
  parseFormattedNumber: Number,
  persistChanges: async () => {},
  requirePrimaryAccount: blocked,
  rupiahInputHtml: () => "",
  saveState: () => {},
  savingCategories: [],
  savingsEntry: () => {},
  savingsGoal: () => {},
  showModal: () => {},
  showSnackbar: () => {},
  state: { savings: [] },
  todayDate: () => "2026-05-31",
  touchSavingsGoal: () => {},
});
assert(typeof savingsForm.openSavingsGoalForm === "function", "Savings form controller tidak mengekspor openSavingsGoalForm.");
assert(typeof savingsForm.openSavingsEntryForm === "function", "Savings form controller tidak mengekspor openSavingsEntryForm.");
assert(/^\d{4}-\d{2}-\d{2}$/.test(savingsForm.targetDateFromShortcut(12)), "Shortcut target tabungan tidak menghasilkan tanggal ISO.");
assert(savingsForm.openSavingsGoalForm() === undefined, "Savings goal form tidak menghormati guard akun utama.");
assert(savingsForm.openSavingsEntryForm("goal", "deposit") === undefined, "Savings entry form tidak menghormati guard akun utama.");

const vehicleForm = window.AppVehicleForm.createController({
  addMonths: () => "",
  attachRupiahInput: () => {},
  closeModal: () => {},
  defaultWalletId: () => "",
  escapeHtml: (value) => String(value ?? ""),
  id: () => "vehicle",
  openView: () => {},
  parseFormattedNumber: Number,
  persistChanges: async () => {},
  removeVehicleTransaction: () => {},
  requirePrimaryAccount: blocked,
  rupiahInputHtml: () => "",
  showModal: () => {},
  state: { vehicles: [] },
  todayDate: () => "2026-05-31",
  upsertVehicleTransaction: () => "",
  vehicleOptions: () => "",
  walletOptions: () => "",
});
[
  "openVehicleExpenseForm",
  "openVehicleForm",
  "openVehicleOilForm",
  "openVehiclePartForm",
  "openVehicleServiceForm",
  "openVehicleTaxForm",
].forEach((name) => {
  assert(typeof vehicleForm[name] === "function", `Vehicle form controller tidak mengekspor ${name}.`);
  assert(vehicleForm[name]() === undefined, `${name} tidak menghormati guard akun utama.`);
});

console.log("Form controllers OK");
