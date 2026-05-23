window.AppCloud = {
  setupCloudClient(cloudSync, cloudConfig) {
    if (!cloudSync.enabled || cloudSync.client) return cloudSync.client;
    cloudSync.client = globalThis.supabase.createClient(cloudConfig.url, cloudConfig.anonKey);
    return cloudSync.client;
  },

  cloudUserKey(currentUser) {
    if (currentUser?.cloudId) return currentUser.cloudId;
    return "";
  },

  hasStateData(state) {
    return Boolean(
      state?.transactions?.length ||
        state?.budgets?.length ||
        state?.debts?.length ||
        state?.savings?.length ||
        state?.billReminders?.length ||
        state?.recurring?.length,
    );
  },

  async ensureCloudSession(client) {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session) return data.session;

    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data?.session) throw new Error("Sesi login cloud tidak aktif. Silakan logout lalu login kembali.");
    return refreshed.data.session;
  },

  queueCloudSave(ctx) {
    const { cloudSync, currentUser, cloudUserKey, saveCloudState } = ctx;
    if (!currentUser || !cloudSync.enabled || !cloudSync.loadedUsers.has(cloudUserKey())) return;
    clearTimeout(cloudSync.saveTimer);
    cloudSync.saveTimer = setTimeout(() => {
      saveCloudState();
    }, 700);
  },

  async flushCloudSave(ctx) {
    const { cloudSync, isGuest, cloudUserKey, saveCloudState } = ctx;
    clearTimeout(cloudSync.saveTimer);
    if (isGuest() || !cloudSync.enabled || !cloudUserKey()) return true;
    await saveCloudState();
    return !cloudSync.lastError;
  },

  async loadCloudState(ctx) {
    const {
      cloudSync,
      setupCloudClient,
      cloudConfig,
      cloudUserKey,
      replaceState,
      mergeStateData,
      emptyState,
      state,
      saveCloudState,
    } = ctx;

    const userKey = cloudUserKey();
    const client = setupCloudClient(cloudSync, cloudConfig);
    if (!client || !userKey) return;

    try {
      await window.AppCloud.ensureCloudSession(client);
      const { data, error } = await client
        .from(cloudConfig.table)
        .select("payload, updated_at")
        .eq("user_id", userKey)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      cloudSync.loadedUsers.add(userKey);
      if (data?.payload) {
        replaceState(mergeStateData(data.payload, state));
        cloudSync.lastSyncedAt = data.updated_at || new Date().toISOString();
        await saveCloudState();
      } else {
        if (!window.AppCloud.hasStateData(state) && typeof emptyState === "function") replaceState(emptyState());
        await saveCloudState();
      }
      cloudSync.lastError = "";
    } catch (error) {
      cloudSync.lastError = error.message || "Cloud belum bisa diakses.";
    }
  },

  async saveCloudState(ctx) {
    const {
      cloudSync,
      setupCloudClient,
      cloudConfig,
      cloudUserKey,
      normalizeState,
      state,
      renderAccount,
    } = ctx;

    const userKey = cloudUserKey();
    const client = setupCloudClient(cloudSync, cloudConfig);
    if (!client || !userKey) return false;
    if (cloudSync.isSaving) {
      cloudSync.pendingSave = true;
      await cloudSync.savePromise;
      if (cloudSync.pendingSave) {
        cloudSync.pendingSave = false;
        return window.AppCloud.saveCloudState(ctx);
      }
      return !cloudSync.lastError;
    }

    cloudSync.isSaving = true;
    cloudSync.savePromise = (async () => {
      try {
        await window.AppCloud.ensureCloudSession(client);
        const { error } = await client.from(cloudConfig.table).upsert({
          user_id: userKey,
          payload: normalizeState(state),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
        cloudSync.loadedUsers.add(userKey);
        cloudSync.lastSyncedAt = new Date().toISOString();
        cloudSync.lastError = "";
        return true;
      } catch (error) {
        cloudSync.lastError = error.message || "Data belum tersinkron.";
        return false;
      } finally {
        cloudSync.isSaving = false;
        renderAccount();
      }
    })();
    const saved = await cloudSync.savePromise;
    if (cloudSync.pendingSave) {
      cloudSync.pendingSave = false;
      return window.AppCloud.saveCloudState(ctx);
    }
    return saved;
  },

  syncStatusText(cloudSync) {
    if (!cloudSync.enabled) return "Mode lokal aktif. Isi config.js untuk menghubungkan Supabase.";
    if (cloudSync.lastError) return `Cloud bermasalah: ${cloudSync.lastError}`;
    if (cloudSync.isSaving) return "Sedang menyimpan ke cloud...";
    if (!cloudSync.lastSyncedAt) return "Cloud siap, menunggu sinkronisasi pertama.";
    const label = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cloudSync.lastSyncedAt));
    return `Terakhir tersinkron ${label}.`;
  },
};
