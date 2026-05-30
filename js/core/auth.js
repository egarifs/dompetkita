window.AppAuth = {
  defaultUsers() {
    return [
      { id: "admin", username: "admin@keuangan.local", password: "admin123", role: "admin", name: "Admin Keuangan", email: "admin@keuangan.local" },
      { id: "user", username: "user@keuangan.local", password: "user123", role: "user", name: "User Keuangan", email: "user@keuangan.local" },
    ];
  },

  normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
  },

  loadDeletedAccounts(deletedAccountsKey) {
    if (!deletedAccountsKey) return [];
    try {
      const accounts = JSON.parse(localStorage.getItem(deletedAccountsKey));
      return Array.isArray(accounts) ? accounts.map(window.AppAuth.normalizeUsername).filter(Boolean) : [];
    } catch {
      return [];
    }
  },

  isAccountDeleted(deletedAccountsKey, username) {
    const normalizedUsername = window.AppAuth.normalizeUsername(username);
    return Boolean(normalizedUsername && window.AppAuth.loadDeletedAccounts(deletedAccountsKey).includes(normalizedUsername));
  },

  markAccountDeleted(deletedAccountsKey, username) {
    if (!deletedAccountsKey) return;
    const normalizedUsername = window.AppAuth.normalizeUsername(username);
    if (!normalizedUsername) return;
    const accounts = new Set(window.AppAuth.loadDeletedAccounts(deletedAccountsKey));
    accounts.add(normalizedUsername);
    localStorage.setItem(deletedAccountsKey, JSON.stringify([...accounts]));
  },

  loadUsers(authStorageKey, deletedAccountsKey = "") {
    const deletedAccounts = new Set(window.AppAuth.loadDeletedAccounts(deletedAccountsKey));
    const withoutDeletedAccounts = (users) => users.filter((user) => !deletedAccounts.has(window.AppAuth.normalizeUsername(user.username)));
    try {
      const users = JSON.parse(localStorage.getItem(authStorageKey));
      if (Array.isArray(users)) return withoutDeletedAccounts(users);
    } catch {
      return withoutDeletedAccounts(window.AppAuth.defaultUsers());
    }
    const users = withoutDeletedAccounts(window.AppAuth.defaultUsers());
    localStorage.setItem(authStorageKey, JSON.stringify(users));
    return users;
  },

  saveUsers(authStorageKey, users) {
    localStorage.setItem(authStorageKey, JSON.stringify(users));
  },

  loadRememberedLogin(rememberedLoginKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(rememberedLoginKey));
      if (saved?.email && saved?.password) return saved;
    } catch {
      return null;
    }
    return null;
  },

  saveRememberedLogin(rememberedLoginKey, email, password) {
    localStorage.setItem(rememberedLoginKey, JSON.stringify({ email, password }));
  },

  clearRememberedLogin(rememberedLoginKey) {
    localStorage.removeItem(rememberedLoginKey);
  },

  deleteLocalAccountData({
    authStorageKey,
    deletedAccountsKey,
    rememberedLoginKey,
    sessionStorageKey,
    storageKey,
    username,
  }) {
    const normalizedUsername = window.AppAuth.normalizeUsername(username);
    window.AppAuth.markAccountDeleted(deletedAccountsKey, normalizedUsername);
    const users = window.AppAuth.loadUsers(authStorageKey, deletedAccountsKey)
      .filter((user) => window.AppAuth.normalizeUsername(user.username) !== normalizedUsername);
    window.AppAuth.saveUsers(authStorageKey, users);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(sessionStorageKey);
    localStorage.removeItem(rememberedLoginKey);
    return users;
  },

  failedLoginCount(failedLoginKey) {
    return Number(sessionStorage.getItem(failedLoginKey) || 0);
  },

  recordFailedLogin(failedLoginKey) {
    sessionStorage.setItem(failedLoginKey, String(window.AppAuth.failedLoginCount(failedLoginKey) + 1));
  },

  resetFailedLogin(failedLoginKey) {
    sessionStorage.removeItem(failedLoginKey);
  },

  loadSessionUser(sessionStorageKey, users) {
    try {
      const session = JSON.parse(localStorage.getItem(sessionStorageKey));
      if (!session?.username) return null;
      return users.find((user) => user.username === session.username) || null;
    } catch {
      return null;
    }
  },
};
