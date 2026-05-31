window.AppNavigationEvents = {
  register({ goBackView, openView }) {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => openView(button.dataset.view));
      if (button.getAttribute("role") === "button") {
        button.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openView(button.dataset.view);
        });
      }
    });

    document.querySelector("#backButton").addEventListener("click", goBackView);
  },
};
