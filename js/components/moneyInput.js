window.AppMoneyInput = {
  attach(selector) {
    const input = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!input || input.dataset.moneyInputAttached === "true") return;
    input.dataset.moneyInputAttached = "true";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.value = window.AppUtils.formatRupiah(input.value);
    input.addEventListener("input", () => {
      input.value = window.AppUtils.formatRupiah(input.value);
    });
  },

  attachAll(selectors = []) {
    selectors.forEach((selector) => window.AppMoneyInput.attach(selector));
  },

  html(id, value = "", attributes = "") {
    const formattedValue = value === "" || value === null || value === undefined ? "" : window.AppUtils.formatRupiah(value);
    return `
      <div class="money-input">
        <div class="currency-input">
          <input id="${id}" type="text" inputmode="numeric" autocomplete="off" value="${formattedValue}" placeholder="Rp0" ${attributes} />
        </div>
        <button class="money-calculator-link" type="button" data-open-money-calculator="${id}">Gunakan Kalkulator</button>
      </div>
    `;
  },
};
