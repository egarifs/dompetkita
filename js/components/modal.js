window.AppModal = {
  show() {
    document.querySelector("#modal")?.classList.add("open");
  },

  close() {
    document.querySelector("#modal")?.classList.remove("open");
  },
};
