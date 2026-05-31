window.AppModalEvents = {
  register({ closeModal, updateMoneyCalculatorResult }) {
    document.body.addEventListener("input", (event) => {
      if (event.target.closest("#moneyCalculatorExpression")) updateMoneyCalculatorResult();
    });

    document.querySelector("#closeModalButton").addEventListener("click", closeModal);
    document.querySelector("#modal").addEventListener("click", (event) => {
      if (event.target.id === "modal") closeModal();
    });

    document.addEventListener("invalid", (event) => {
      const step = event.target.closest?.(".form-step");
      if (step) step.open = true;
    }, true);
  },
};
