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
        state?.recurring?.length ||
        state?.vehicles?.length ||
        state?.vehicleServices?.length ||
        state?.vehicleOilChanges?.length ||
        state?.vehicleParts?.length ||
        state?.vehicleTaxes?.length,
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
      saveAfterLoad = true,
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
        if (saveAfterLoad) await saveCloudState();
      } else {
        if (!window.AppCloud.hasStateData(state) && typeof emptyState === "function") replaceState(emptyState());
        if (saveAfterLoad) await saveCloudState();
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
        const { data, error } = await client.from(cloudConfig.table).upsert({
          user_id: userKey,
          payload: normalizeState(state),
        }, { onConflict: "user_id" }).select("updated_at").single();
        if (error) throw error;
        cloudSync.loadedUsers.add(userKey);
        cloudSync.lastSyncedAt = data?.updated_at || new Date().toISOString();
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

  stopRealtimeSync(cloudSync) {
    clearInterval(cloudSync.pollTimer);
    cloudSync.pollTimer = null;
    if (cloudSync.channel && cloudSync.client) {
      cloudSync.client.removeChannel(cloudSync.channel);
    }
    cloudSync.channel = null;
    cloudSync.realtimeUserKey = "";
  },

  startRealtimeSync(ctx) {
    const {
      cloudSync,
      setupCloudClient,
      cloudConfig,
      cloudUserKey,
      applyCloudPayload,
      loadCloudState,
    } = ctx;
    const userKey = cloudUserKey();
    const client = setupCloudClient(cloudSync, cloudConfig);
    if (!cloudSync.enabled || !client || !userKey) return;
    if (cloudSync.channel && cloudSync.realtimeUserKey === userKey) return;

    window.AppCloud.stopRealtimeSync(cloudSync);
    cloudSync.realtimeUserKey = userKey;
    cloudSync.channel = client
      .channel(`finance-sync-${userKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: cloudConfig.table,
          filter: `user_id=eq.${userKey}`,
        },
        (event) => {
          const row = event.new || {};
          if (!row.payload) return;
          const remoteAt = row.updated_at || new Date().toISOString();
          applyCloudPayload(row.payload, remoteAt);
        },
      )
      .subscribe((status) => {
        cloudSync.realtimeStatus = status;
      });

    clearInterval(cloudSync.pollTimer);
    cloudSync.pollTimer = null;
  },

  syncStatusText(cloudSync) {
    if (!cloudSync.enabled) return "Mode lokal aktif. Isi config.js untuk menghubungkan Supabase.";
    if (cloudSync.lastError) return `Cloud bermasalah: ${cloudSync.lastError}`;
    if (cloudSync.isSaving) return "Sedang menyimpan ke cloud...";
    if (!cloudSync.lastSyncedAt) return "Cloud siap, menunggu sinkronisasi pertama.";
    const label = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cloudSync.lastSyncedAt));
    const realtime = cloudSync.realtimeStatus === "SUBSCRIBED" ? " Realtime aktif." : " Event-based sync aktif.";
    return `Terakhir tersinkron ${label}.${realtime}`;
  },
};
