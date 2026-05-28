window.AppToast = (() => {
  let snackbarTimer = null;

  function show(message, tone = "success", action = null) {
    const snackbar = document.querySelector("#snackbar");
    if (!snackbar) return;
    snackbar.innerHTML = "";
    const text = document.createElement("span");
    text.textContent = message;
    snackbar.appendChild(text);
    if (action?.label && typeof action.onClick === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "snackbar-action";
      button.textContent = action.label;
      button.addEventListener("click", async () => {
        clearTimeout(snackbarTimer);
        snackbar.className = "snackbar";
        await action.onClick();
      }, { once: true });
      snackbar.appendChild(button);
    }
    snackbar.className = `snackbar show ${tone === "error" ? "error" : ""}`;
    clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(() => {
      snackbar.className = "snackbar";
    }, action ? 6000 : 3200);
  }

  return { show };
})();
