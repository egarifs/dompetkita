global.window = global;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function element(overrides = {}) {
  return {
    dataset: {},
    addEventListener(type) {
      this.listeners.push(type);
    },
    getAttribute: () => "",
    listeners: [],
    ...overrides,
  };
}

const elements = new Map();
const selectorLists = new Map();
const getElement = (selector) => {
  if (!elements.has(selector)) elements.set(selector, element());
  return elements.get(selector);
};

global.document = {
  body: element(),
  addEventListener(type) {
    this.listeners.push(type);
  },
  listeners: [],
  querySelector: getElement,
  querySelectorAll(selector) {
    return selectorLists.get(selector) || [];
  },
};

await import("../js/events/navigation.events.js");
await import("../js/events/modal.events.js");
await import("../js/events/auth.events.js");
await import("../js/events/filter.events.js");

const navigationButton = element({ dataset: { view: "home" }, getAttribute: () => "button" });
selectorLists.set("[data-view]", [navigationButton]);
window.AppNavigationEvents.register({ goBackView: () => {}, openView: () => {} });
assert(navigationButton.listeners.includes("click") && navigationButton.listeners.includes("keydown"), "Navigation events tidak terdaftar.");
assert(getElement("#backButton").listeners.includes("click"), "Back button event tidak terdaftar.");

window.AppModalEvents.register({ closeModal: () => {}, updateMoneyCalculatorResult: () => {} });
assert(document.body.listeners.includes("input"), "Modal money input event tidak terdaftar.");
assert(getElement("#closeModalButton").listeners.includes("click"), "Close modal event tidak terdaftar.");
assert(document.listeners.includes("invalid"), "Invalid form event tidak terdaftar.");

window.AppAuthEvents.register({
  clearRememberedLogin: () => {},
  cloudSync: { enabled: false },
  enterGuestMode: () => {},
  login: () => true,
  loginCloud: async () => ({ ok: true }),
  loginWithGoogle: () => {},
  openRegisterForm: () => {},
  openResetPasswordRequestForm: () => {},
  recordFailedLogin: () => {},
  resetFailedLogin: () => {},
  saveRememberedLogin: () => {},
  showApp: async () => {},
  showLogin: () => {},
});
assert(getElement("#loginForm").listeners.includes("submit"), "Login submit event tidak terdaftar.");
assert(getElement("#guestLoginButton").listeners.includes("click"), "Guest login event tidak terdaftar.");

window.AppFilterEvents.register({
  renderBudgetProgress: () => {},
  renderCategoryBreakdown: () => {},
  renderDailyExpenses: () => {},
  renderTransactions: () => {},
  renderVehicleExpenses: () => {},
  renderWalletDetail: () => {},
  setQuickTransactionRange: () => {},
});
assert(getElement("#searchInput").listeners.includes("input"), "Search filter event tidak terdaftar.");
assert(getElement("#monthFilter").listeners.includes("change"), "Month filter event tidak terdaftar.");
assert(getElement("#vehicleExpenseTypeFilter").listeners.includes("change"), "Vehicle filter event tidak terdaftar.");

console.log("Event registration OK");
