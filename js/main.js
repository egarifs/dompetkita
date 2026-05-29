window.AppMain = {
  createBootstrap(deps) {
    const {
      applyDarkMode,
      autoLoginRememberedUser,
      cloudSync,
      getDeferredInstallPrompt,
      handlePasswordRecoveryLink,
      loadCloudSessionUser,
      loadUsers,
      openNewPasswordForm,
      setCurrentUser,
      setDeferredInstallPrompt,
      setupCloudClient,
      showApp,
      showSplash,
    } = deps;

    function installPromptButton() {
      return document.querySelector("#installAppButton");
    }

    function registerInstallPrompt() {
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        setDeferredInstallPrompt(event);
        installPromptButton()?.classList.remove("hidden");
      });

      installPromptButton()?.addEventListener("click", async () => {
        const deferredInstallPrompt = getDeferredInstallPrompt();
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          installPromptButton()?.classList.add("hidden");
        }
        setDeferredInstallPrompt(null);
      });

      window.addEventListener("appinstalled", () => {
        installPromptButton()?.classList.add("hidden");
        setDeferredInstallPrompt(null);
      });
    }

    function registerServiceWorker() {
      if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }

    function registerCloudRecoveryListener() {
      if (!cloudSync.enabled) return;
      setupCloudClient()?.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") openNewPasswordForm();
      });
    }

    async function bootstrapUser() {
      if (await handlePasswordRecoveryLink()) return;
      if (cloudSync.enabled) {
        setCurrentUser(await loadCloudSessionUser());
      }
      if (deps.currentUser()) {
        await showApp();
        return;
      }
      const rememberedLoggedIn = await autoLoginRememberedUser();
      if (!rememberedLoggedIn) showSplash();
    }

    async function start() {
      registerInstallPrompt();
      registerServiceWorker();
      loadUsers();
      applyDarkMode();
      registerCloudRecoveryListener();
      await bootstrapUser();
    }

    return {
      start,
    };
  },
};
