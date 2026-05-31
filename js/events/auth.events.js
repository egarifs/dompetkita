window.AppAuthEvents = {
  register(deps) {
    const {
      clearRememberedLogin,
      cloudSync,
      enterGuestMode,
      login,
      loginCloud,
      loginWithGoogle,
      openRegisterForm,
      openResetPasswordRequestForm,
      recordFailedLogin,
      resetFailedLogin,
      saveRememberedLogin,
      showApp,
      showLogin,
    } = deps;

    document.querySelector("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = document.querySelector("#loginUsername").value.trim();
      const password = document.querySelector("#loginPassword").value;
      const result = cloudSync.enabled ? await loginCloud(username, password) : { ok: login(username, password), message: "Email atau password salah." };
      if (!result.ok) {
        recordFailedLogin();
        alert(result.message);
        return;
      }
      resetFailedLogin();
      if (document.querySelector("#rememberLogin").checked) {
        saveRememberedLogin(username.toLowerCase(), password);
      } else {
        clearRememberedLogin();
      }
      document.querySelector("#loginPassword").value = "";
      await showApp();
    });

    document.querySelector("#continueToLoginButton").addEventListener("click", showLogin);
    document.querySelector("#skipSplashButton")?.addEventListener("click", showLogin);
    document.querySelector("#forgotPasswordButton").addEventListener("click", openResetPasswordRequestForm);
    document.querySelector("#registerButton").addEventListener("click", openRegisterForm);
    document.querySelector("#googleLoginButton").addEventListener("click", loginWithGoogle);
    document.querySelector("#accessRequestButton").addEventListener("click", openRegisterForm);
    document.querySelector("#guestLoginButton").addEventListener("click", enterGuestMode);
  },
};
