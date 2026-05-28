window.AppAuth = {
  defaultUsers() {
    return [
      { id: "admin", username: "admin@keuangan.local", password: "admin123", role: "admin", name: "Admin Keuangan", email: "admin@keuangan.local" },
      { id: "user", username: "user@keuangan.local", password: "user123", role: "user", name: "User Keuangan", email: "user@keuangan.local" },
    ];
  },

  loadUsers(authStorageKey) {
    try {
      const users = JSON.parse(localStorage.getItem(authStorageKey));
      if (Array.isArray(users) && users.length) return users;
    } catch {
      return window.AppAuth.defaultUsers();
    }
    const users = window.AppAuth.defaultUsers();
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
