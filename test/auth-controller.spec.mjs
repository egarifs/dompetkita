global.window = global;

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
global.sessionStorage = global.localStorage;
global.AppAuth = {
  isAccountDeleted: () => false,
};

await import("../js/features/auth/auth.controller.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let currentUser = null;
let users = [];
let replacedState = null;
let cloudClient = null;

const controller = window.AppAuthController.createController({
  accountService: {},
  appConfig: {},
  appIcon: () => "",
  applyRememberedLogin: () => {},
  applyState: () => {},
  authStorageKey: "test-auth",
  clearRememberedLogin: () => {},
  clearSyncRetry: () => {},
  closeModal: () => {},
  cloudSync: { enabled: false, readOnly: false },
  deletedAccountsKey: "test-deleted",
  demoState: () => ({}),
  emptyState: () => ({ empty: true }),
  getCurrentUser: () => currentUser,
  getHasUnsyncedChanges: () => false,
  hydrateStoredStateForCurrentUser: () => {},
  id: () => "local-user",
  isChildUser: () => currentUser?.role === "child",
  isCloudSyncAllowed: () => false,
  isGuest: () => currentUser?.role === "guest",
  loadCloudState: async () => {},
  loadRememberedLogin: () => null,
  loadUsers: () => users,
  localSplashQuotes: [{ quote: "Test", author: "Test" }],
  openView: () => {},
  rememberedLoginKey: "test-remembered",
  renderAll: () => {},
  replaceState: (state) => {
    replacedState = state;
  },
  requirePrimaryAccount: () => true,
  resetFailedLogin: () => {},
  router: { clearHistory: () => {} },
  saveRememberedLogin: () => {},
  saveUsers: (nextUsers) => {
    users = nextUsers;
  },
  sessionStorageKey: "test-session",
  setCurrentUser: (user) => {
    currentUser = user;
  },
  setGuestTransactionAdds: () => {},
  setHasUnsyncedChanges: () => {},
  setLocalSyncStatus: () => {},
  setUsers: (nextUsers) => {
    users = nextUsers;
  },
  setupCloudClient: () => cloudClient,
  showModal: () => {},
  splashReadDelay: 0,
  startCloudRealtimeSync: () => {},
  startIdleLogoutTimer: () => {},
  state: { transactions: [], wallets: [] },
  stopCloudRealtimeSync: () => {},
  stopIdleLogoutTimer: () => {},
  storageKey: "test-state",
  updateForgotPasswordVisibility: () => {},
});

const registration = controller.registerLocal({
  name: "User Lokal",
  phone: "0812",
  email: "local@dompify.test",
  password: "Password123",
});
assert(registration.ok && registration.signedIn, "Registrasi lokal gagal.");
assert(currentUser?.id === "local-user" && replacedState?.empty, "Registrasi lokal tidak memperbarui user atau state.");
assert(controller.login("local@dompify.test", "Password123"), "Login lokal gagal.");
assert(JSON.parse(localStorage.getItem("test-session")).username === "local@dompify.test", "Session login lokal tidak tersimpan.");

cloudClient = {
  auth: {
    async signInWithPassword() {
      return {
        data: {
          user: {
            id: "cloud-child",
            email: "child@dompify.test",
            user_metadata: { name: "Anak" },
          },
        },
        error: null,
      };
    },
  },
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        return {
          data: {
            parent_user_id: "cloud-parent",
            child_name: "Anak",
            phone: "0813",
            status: "active",
          },
          error: null,
        };
      },
    };
  },
};

const cloudLogin = await controller.loginCloud("child@dompify.test", "Password123");
assert(cloudLogin.ok, "Login cloud gagal.");
assert(currentUser?.role === "child" && currentUser.dataOwnerId === "cloud-parent", "Akses child cloud tidak diterapkan.");

console.log("Auth controller OK");
