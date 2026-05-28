window.AppRouter = {
  createRouter({ currentPageCopy }) {
    const viewHistory = [];

    function activeView() {
      return document.querySelector(".view.active")?.id?.replace("View", "") || "home";
    }

    function updateBackButton(view) {
      const backButton = document.querySelector("#backButton");
      if (!backButton) return;
      backButton.classList.toggle("hidden", view === "home");
    }

    function navViewFor(view) {
      if (["finance", "wallets", "walletDetail", "budgets", "debts", "savings", "balanceSheet", "analytics"].includes(view)) return "finance";
      if (["vehicles"].includes(view)) return "vehicles";
      if (["reports"].includes(view)) return "reports";
      return view;
    }

    function openView(view, options = {}) {
      const targetView = document.querySelector(`#${view}View`);
      if (!targetView) return;
      const previousView = activeView();
      if (!options.fromBack && !options.replace && previousView !== view) {
        viewHistory.push(previousView);
      }
      document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
      targetView.classList.add("active");
      const activeNav = navViewFor(view);
      document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeNav));
      const copy = currentPageCopy(view);
      document.querySelector("#pageHeading").textContent = copy[0];
      document.querySelector("#pageSubtitle").textContent = copy[1];
      updateBackButton(view);
      document.querySelector("#addBlock").classList.remove("open");
    }

    function goBackView() {
      const previousView = viewHistory.pop() || "home";
      openView(previousView, { fromBack: true });
    }

    function clearHistory() {
      viewHistory.length = 0;
    }

    return {
      activeView,
      clearHistory,
      goBackView,
      navViewFor,
      openView,
      updateBackButton,
    };
  },
};
