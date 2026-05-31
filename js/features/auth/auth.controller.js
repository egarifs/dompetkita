window.AppAuthController = {
  createController(deps) {
    const {
      accountService,
      appConfig,
      appIcon,
      applyRememberedLogin,
      applyState,
      authStorageKey,
      clearRememberedLogin,
      clearSyncRetry,
      closeModal,
      cloudSync,
      deletedAccountsKey,
      demoState,
      emptyState,
      getCurrentUser,
      getHasUnsyncedChanges,
      hydrateStoredStateForCurrentUser,
      id,
      isChildUser,
      isCloudSyncAllowed,
      isGuest,
      loadCloudState,
      loadRememberedLogin,
      loadUsers,
      localSplashQuotes,
      openView,
      renderAll,
      replaceState,
      requirePrimaryAccount,
      resetFailedLogin,
      router,
      saveRememberedLogin,
      saveUsers,
      sessionStorageKey,
      setCurrentUser,
      setGuestTransactionAdds,
      setHasUnsyncedChanges,
      setLocalSyncStatus,
      setUsers,
      setupCloudClient,
      showModal,
      splashReadDelay,
      startCloudRealtimeSync,
      startIdleLogoutTimer,
      stopCloudRealtimeSync,
      stopIdleLogoutTimer,
      storageKey,
      updateForgotPasswordVisibility,
    } = deps;

    async function showApp() {
      document.querySelector("#splashScreen").classList.add("hidden");
      document.querySelector("#authScreen").classList.add("hidden");
      document.querySelector("#appShell").classList.remove("hidden");
      hydrateStoredStateForCurrentUser();
      if (!isGuest() && isCloudSyncAllowed()) {
        const shouldUploadLocal = !isChildUser() && getHasUnsyncedChanges();
        await loadCloudState({ saveAfterLoad: shouldUploadLocal });
        if (isChildUser()) {
          setHasUnsyncedChanges(false);
          setLocalSyncStatus("synced");
        } else if (shouldUploadLocal && !cloudSync.lastError) {
          setHasUnsyncedChanges(false);
          setLocalSyncStatus("synced");
        } else if (shouldUploadLocal) {
          setLocalSyncStatus("failed");
        }
      }
      if (!isGuest() && isCloudSyncAllowed()) startCloudRealtimeSync();
      renderAll();
      startIdleLogoutTimer();
      maybeShowWalletOnboarding();
    }

    function maybeShowWalletOnboarding() {
      const currentUser = getCurrentUser();
      if (!currentUser || isGuest() || isChildUser()) return;
      const key = `dompify_onboarding_wallet_${currentUser.username || currentUser.id}`;
      if (sessionStorage.getItem(key)) return;
      if (deps.state.transactions.length || deps.state.wallets.length > 2) return;
      sessionStorage.setItem(key, "1");
      document.querySelector("#modalTitle").textContent = "Mulai dari Dompet";
      document.querySelector("#modalBody").innerHTML = `
        <div class="form">
          <div class="empty">
            <p>Buat atau sesuaikan dompet pertama agar saldo transaksi lebih rapi sejak awal.</p>
            <button class="button primary" type="button" data-open-form="wallet">Atur Dompet</button>
            <button class="button" type="button" data-close-modal>Nanti</button>
          </div>
        </div>
      `;
      showModal();
    }

    function showLogin() {
      stopIdleLogoutTimer();
      document.querySelector("#splashScreen").classList.add("hidden");
      document.querySelector("#authScreen").classList.remove("hidden");
      document.querySelector("#appShell").classList.add("hidden");
      applyRememberedLogin();
      updateForgotPasswordVisibility();
    }

    function setSplashQuote(quote, author, source = "Internet") {
      document.querySelector("#splashQuote").textContent = `"${quote}"`;
      document.querySelector("#splashQuoteSource").textContent = author ? `Sumber: ${source} - ${author}` : `Sumber: ${source}`;
    }

    function setLocalSplashQuote() {
      const item = localSplashQuotes[Math.floor(Math.random() * localSplashQuotes.length)];
      setSplashQuote(item.quote, item.author, "Quote lokal");
    }

    function loadSplashQuote() {
      const quotes = Array.isArray(globalThis.SPLASH_QUOTES) && globalThis.SPLASH_QUOTES.length
        ? globalThis.SPLASH_QUOTES
        : localSplashQuotes;
      const item = quotes[Math.floor(Math.random() * quotes.length)];
      setSplashQuote(item.quote, item.author, "Quote lokal");
    }

    function showSplash() {
      document.querySelector("#splashScreen").classList.remove("hidden");
      document.querySelector("#authScreen").classList.add("hidden");
      document.querySelector("#appShell").classList.add("hidden");
      loadSplashQuote();
      const button = document.querySelector("#continueToLoginButton");
      const status = document.querySelector("#splashReadStatus");
      button.disabled = true;
      button.textContent = "Baca sebentar...";
      status.textContent = "Quote ditampilkan sebentar agar bisa dibaca.";
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "Mulai Mencatat";
        status.textContent = "Silakan lanjut jika sudah siap.";
      }, splashReadDelay);
    }

    async function enterGuestMode() {
      setGuestTransactionAdds(0);
      setCurrentUser({
        id: "guest",
        username: "guest",
        password: "",
        role: "guest",
        name: "Tamu",
        email: "Mode percobaan",
      });
      replaceState(demoState());
      await showApp();
    }

    function login(username, password) {
      const user = loadUsers().find((item) => item.username === username && item.password === password);
      if (!user) return false;
      setCurrentUser(user);
      localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
      return true;
    }

    function passwordResetRedirectUrl() {
      const configuredUrl = appConfig.resetPasswordRedirectUrl || appConfig.publicUrl || appConfig.appUrl || "";
      const baseUrl = configuredUrl || `${location.origin}${location.pathname}`;
      const url = new URL(baseUrl, location.href);
      url.searchParams.set("reset-password", "1");
      url.hash = "";
      return url.toString();
    }

    function buildUserFromCloud(user) {
      const profile = user.user_metadata || {};
      return {
        id: user.id,
        cloudId: user.id,
        username: user.email,
        password: "",
        role: profile.role || "user",
        name: profile.name || user.email?.split("@")[0] || "User",
        email: user.email || "",
        phone: profile.phone || "",
      };
    }

    async function resolveFamilyAccess(user) {
      const client = setupCloudClient();
      if (!client || !user?.email) return null;
      const { data, error } = await client
        .from("family_members")
        .select("parent_user_id, child_user_id, child_email, child_name, phone, status")
        .eq("child_email", user.email.trim().toLowerCase())
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data?.parent_user_id) return null;
      return data;
    }

    async function applyFamilyAccess(user) {
      cloudSync.readOnly = false;
      const access = await resolveFamilyAccess(user);
      cloudSync.readOnly = Boolean(access);
      if (!access) return;
      const currentUser = getCurrentUser();
      setCurrentUser({
        ...currentUser,
        role: "child",
        familyParentId: access.parent_user_id,
        dataOwnerId: access.parent_user_id,
        name: currentUser.name || access.child_name || currentUser.email?.split("@")[0] || "Anggota Keluarga",
        phone: currentUser.phone || access.phone || "",
      });
    }

    async function loginCloud(email, password) {
      const client = setupCloudClient();
      if (!client) return { ok: false, message: "Koneksi login cloud belum aktif. Tutup lalu buka ulang aplikasi, atau perbarui aplikasi dari browser." };
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data?.user) return { ok: false, message: error?.message || "Email atau password salah." };
      setCurrentUser(buildUserFromCloud(data.user));
      await applyFamilyAccess(data.user);
      return { ok: true };
    }

    async function registerCloud({ name, phone, email, password }) {
      const client = setupCloudClient();
      if (!client) return { ok: false, message: "Cloud belum aktif. Isi config.js terlebih dahulu." };
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name, phone, role: "user" },
          emailRedirectTo: location.href.split("#")[0],
        },
      });
      if (error) return { ok: false, message: error.message };
      if (data?.user && data?.session) {
        setCurrentUser(buildUserFromCloud(data.user));
        return { ok: true, signedIn: true, message: "Registrasi berhasil. Kamu sudah login." };
      }
      const loginResult = await loginCloud(normalizedEmail, password);
      if (loginResult.ok) return { ok: true, signedIn: true, message: "Registrasi berhasil. Kamu sudah login." };
      return {
        ok: true,
        signedIn: false,
        message: "Registrasi berhasil, tetapi akun belum bisa login otomatis. Jika Supabase meminta konfirmasi email, buka Supabase > Authentication > Providers > Email lalu matikan Confirm email agar akun baru bisa langsung login.",
      };
    }

    function registerLocal({ name, phone, email, password }) {
      const users = loadUsers();
      if (window.AppAuth.isAccountDeleted(deletedAccountsKey, email)) {
        return { ok: false, message: "Akun ini sudah dihapus permanen dan tidak dapat digunakan kembali." };
      }
      if (users.some((user) => user.username.toLowerCase() === email.toLowerCase())) {
        return { ok: false, message: "Email sudah terdaftar." };
      }
      const user = { id: id(), username: email, password, role: "user", name, email, phone };
      users.push(user);
      saveUsers(users);
      setCurrentUser(user);
      localStorage.setItem(sessionStorageKey, JSON.stringify({ username: user.username, signedInAt: new Date().toISOString() }));
      replaceState(emptyState());
      return { ok: true, signedIn: true, message: "Registrasi berhasil." };
    }

    async function loginWithGoogle() {
      const client = setupCloudClient();
      if (!client) {
        alert("Login Google membutuhkan koneksi Supabase di config.js.");
        return;
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.href.split("#")[0] },
      });
      if (error) alert(error.message);
    }

    function openResetPasswordRequestForm() {
      document.querySelector("#modalTitle").textContent = "Reset Password";
      document.querySelector("#modalBody").innerHTML = `
        <form class="form" id="resetPasswordRequestForm">
          <p class="form-status">Masukkan email akun kamu. Jika email terdaftar, link reset password akan dikirimkan.</p>
          <div class="field"><label for="resetEmail">Email</label><input id="resetEmail" type="email" autocomplete="email" required /></div>
          <p class="form-status hidden" id="resetRequestStatus"></p>
          <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">Kirim Link Reset Password</button></div>
        </form>
      `;
      showModal();
      const loginEmail = document.querySelector("#loginUsername").value.trim();
      if (loginEmail) document.querySelector("#resetEmail").value = loginEmail;
      document.querySelector("#resetPasswordRequestForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || document.querySelector("#resetPasswordRequestForm .button.primary");
        const status = document.querySelector("#resetRequestStatus");
        const email = document.querySelector("#resetEmail").value.trim().toLowerCase();
        submitButton.disabled = true;
        submitButton.textContent = "Mengirim...";
        status.className = "form-status";
        status.textContent = "Memproses permintaan reset password...";
        try {
          const client = setupCloudClient();
          if (client) {
            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: passwordResetRedirectUrl() });
            if (error) throw error;
          }
          status.className = "form-status success";
          status.textContent = "Jika email terdaftar, link reset password akan dikirimkan.";
        } catch {
          status.className = "form-status success";
          status.textContent = "Jika email terdaftar, link reset password akan dikirimkan.";
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Kirim Link Reset Password";
        }
      });
    }

    function clearPasswordResetUrl() {
      if (!history.replaceState) return;
      const cleanUrl = location.origin === "null" ? location.pathname : `${location.origin}${location.pathname}`;
      history.replaceState({}, document.title, cleanUrl);
    }

    function openNewPasswordForm() {
      showLogin();
      document.querySelector("#modalTitle").textContent = "Buat Password Baru";
      document.querySelector("#modalBody").innerHTML = `
        <form class="form" id="newPasswordForm">
          <p class="form-status">Masukkan password baru untuk akun kamu.</p>
          <div class="field"><label for="newPassword">Password baru</label><div class="password-wrap"><input id="newPassword" type="password" autocomplete="new-password" minlength="8" required /><button class="password-toggle" type="button" data-toggle-password="newPassword" aria-label="Tampilkan password">${appIcon("eye", 19)}</button></div></div>
          <div class="field"><label for="confirmNewPassword">Konfirmasi password baru</label><div class="password-wrap"><input id="confirmNewPassword" type="password" autocomplete="new-password" minlength="8" required /><button class="password-toggle" type="button" data-toggle-password="confirmNewPassword" aria-label="Tampilkan password">${appIcon("eye", 19)}</button></div></div>
          <p class="form-status hidden" id="newPasswordStatus"></p>
          <div class="row-actions"><button class="button primary" type="submit">Reset Password</button></div>
        </form>
      `;
      showModal();
      document.querySelector("#newPasswordForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || document.querySelector("#newPasswordForm .button.primary");
        const status = document.querySelector("#newPasswordStatus");
        const password = document.querySelector("#newPassword").value;
        const confirmation = document.querySelector("#confirmNewPassword").value;
        status.className = "form-status error";
        if (password.length < 8) {
          status.textContent = "Password minimal 8 karakter.";
          return;
        }
        if (password !== confirmation) {
          status.textContent = "Password dan konfirmasi password harus sama.";
          return;
        }
        submitButton.disabled = true;
        submitButton.textContent = "Mereset...";
        status.className = "form-status";
        status.textContent = "Memproses password baru...";
        try {
          const client = setupCloudClient();
          if (!client) throw new Error("Cloud belum aktif.");
          const { error } = await client.auth.updateUser({ password });
          if (error) throw error;
          await client.auth.signOut();
          setCurrentUser(null);
          clearRememberedLogin();
          resetFailedLogin();
          clearPasswordResetUrl();
          closeModal();
          showLogin();
          alert("Password berhasil direset. Silakan login menggunakan password baru.");
        } catch (error) {
          status.className = "form-status error";
          status.textContent = error.message || "Password belum bisa direset. Coba buka ulang link reset password.";
          submitButton.disabled = false;
          submitButton.textContent = "Reset Password";
        }
      });
    }

    function isPasswordRecoveryUrl() {
      const params = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
      return params.get("reset-password") === "1" || params.get("type") === "recovery" || hashParams.get("type") === "recovery";
    }

    async function handlePasswordRecoveryLink() {
      if (!cloudSync.enabled || !isPasswordRecoveryUrl()) return false;
      const client = setupCloudClient();
      if (!client) return false;
      const params = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
      const code = params.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      try {
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session) throw error || new Error("Sesi reset password tidak tersedia.");
      } catch {
        showLogin();
        clearPasswordResetUrl();
        alert("Link reset password tidak valid atau sudah kedaluwarsa. Minta link baru dari menu Lupa password.");
        return true;
      }
      openNewPasswordForm();
      return true;
    }

    function openRegisterForm() {
      document.querySelector("#modalTitle").textContent = "Registrasi Akun";
      document.querySelector("#modalBody").innerHTML = `
        <form class="form" id="registerForm">
          <div class="field"><label for="registerName">Nama</label><input id="registerName" type="text" autocomplete="name" required /></div>
          <div class="field"><label for="registerPhone">Nomor HP</label><input id="registerPhone" type="tel" autocomplete="tel" inputmode="tel" required /></div>
          <div class="field"><label for="registerEmail">Email</label><input id="registerEmail" type="email" autocomplete="email" required /></div>
          <div class="field"><label for="registerPassword">Password</label><div class="password-wrap"><input id="registerPassword" type="password" autocomplete="new-password" minlength="6" required /><button class="password-toggle" type="button" data-toggle-password="registerPassword" aria-label="Tampilkan password">${appIcon("eye", 19)}</button></div></div>
          <div class="row-actions"><button class="button" type="button" data-close-modal>Batal</button><button class="button primary" type="submit">Daftar</button></div>
        </form>
      `;
      showModal();
      document.querySelector("#registerForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.submitter || document.querySelector("#registerForm .button.primary");
        submitButton.disabled = true;
        submitButton.textContent = "Mendaftarkan...";
        const payload = {
          name: document.querySelector("#registerName").value.trim(),
          phone: document.querySelector("#registerPhone").value.trim(),
          email: document.querySelector("#registerEmail").value.trim(),
          password: document.querySelector("#registerPassword").value,
        };
        const result = cloudSync.enabled ? await registerCloud(payload) : registerLocal(payload);
        if (!result.ok) {
          submitButton.disabled = false;
          submitButton.textContent = "Daftar";
          alert(result.message);
          return;
        }
        closeModal();
        saveRememberedLogin(payload.email.trim().toLowerCase(), payload.password);
        alert(result.message);
        if (result.signedIn && getCurrentUser()) await showApp();
      });
    }

    async function loadCloudSessionUser() {
      const client = setupCloudClient();
      if (!client) return null;
      const { data } = await client.auth.getSession();
      const user = data?.session?.user;
      if (!user) return null;
      setCurrentUser(buildUserFromCloud(user));
      await applyFamilyAccess(user);
      return getCurrentUser();
    }

    async function logout(message = "") {
      const logoutMessage = typeof message === "string" ? message : "";
      stopIdleLogoutTimer();
      localStorage.removeItem(sessionStorageKey);
      stopCloudRealtimeSync();
      cloudSync.readOnly = false;
      if (cloudSync.enabled) {
        try {
          await setupCloudClient()?.auth.signOut();
        } catch {
          // Keep local logout moving even when cloud sign out is temporarily unavailable.
        }
      }
      setCurrentUser(null);
      applyState(emptyState());
      router.clearHistory();
      openView("home", { replace: true });
      showLogin();
      if (logoutMessage) alert(logoutMessage);
    }

    async function autoLoginRememberedUser() {
      const saved = loadRememberedLogin();
      if (!saved) return false;
      const result = cloudSync.enabled ? await loginCloud(saved.email, saved.password) : { ok: login(saved.email, saved.password), message: "" };
      if (!result.ok) {
        clearRememberedLogin();
        return false;
      }
      resetFailedLogin();
      await showApp();
      return true;
    }

    async function deleteCurrentAccount() {
      if (!requirePrimaryAccount()) return;
      const deletingUser = getCurrentUser();
      const storedUsers = loadUsers();
      const remainingAdmins = storedUsers.filter((user) => user.role === "admin" && user.username !== deletingUser.username);
      if (!deletingUser.cloudId && deletingUser.role === "admin" && !remainingAdmins.length) {
        alert("Tidak bisa menghapus admin terakhir.");
        return;
      }
      if (!confirm(`Hapus akun ${deletingUser.username} secara permanen?\n\nSemua data lokal dan cloud akun ini akan dihapus. Akun tidak dapat digunakan untuk login kembali.`)) return;
      const deleteButton = document.querySelector("#deleteAccountButton");
      deleteButton.disabled = true;
      deleteButton.textContent = "Menghapus...";
      clearTimeout(cloudSync.saveTimer);
      cloudSync.saveTimer = null;
      clearSyncRetry();
      const result = await accountService.deleteCurrentAccountPermanently();
      if (!result.ok) {
        deleteButton.disabled = false;
        deleteButton.textContent = "Hapus";
        alert(result.message);
        return;
      }
      setUsers(window.AppAuth.deleteLocalAccountData({
        authStorageKey,
        deletedAccountsKey,
        rememberedLoginKey: deps.rememberedLoginKey,
        sessionStorageKey,
        storageKey,
        username: deletingUser.username,
      }));
      setHasUnsyncedChanges(false);
      await logout("Akun dan seluruh data terkait berhasil dihapus permanen.");
    }

    return {
      applyFamilyAccess,
      autoLoginRememberedUser,
      buildUserFromCloud,
      clearPasswordResetUrl,
      deleteCurrentAccount,
      enterGuestMode,
      handlePasswordRecoveryLink,
      isPasswordRecoveryUrl,
      loadCloudSessionUser,
      loadSplashQuote,
      login,
      loginCloud,
      loginWithGoogle,
      logout,
      maybeShowWalletOnboarding,
      openNewPasswordForm,
      openRegisterForm,
      openResetPasswordRequestForm,
      passwordResetRedirectUrl,
      registerCloud,
      registerLocal,
      resolveFamilyAccess,
      setLocalSplashQuote,
      setSplashQuote,
      showApp,
      showLogin,
      showSplash,
    };
  },
};
