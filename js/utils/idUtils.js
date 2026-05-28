window.AppUtils = {
  ...(window.AppUtils || {}),

  id() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },
};
