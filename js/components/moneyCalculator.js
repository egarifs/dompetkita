window.AppMoneyCalculator = {
  calculate(expression) {
    const normalized = String(expression || "")
      .replace(/[xX×]/g, "*")
      .replace(/[÷:]/g, "/")
      .replace(/rp/gi, "")
      .replace(/\./g, "")
      .replace(/,/g, "");
    if (!/^[\d+\-*/()\s]+$/.test(normalized)) throw new Error("Ekspresi hanya boleh berisi angka dan operator.");
    if (!/\d/.test(normalized)) return 0;
    if (/\/\s*0+(?!\d)/.test(normalized)) throw new Error("Pembagian dengan 0 tidak diizinkan.");
    const result = Function(`"use strict"; return (${normalized});`)();
    if (!Number.isFinite(result)) throw new Error("Ekspresi tidak valid.");
    if (result < 0) throw new Error("Hasil negatif tidak diizinkan untuk nominal ini.");
    return Math.round(result);
  },

  ensure() {
    let calculator = document.querySelector("#moneyCalculator");
    if (calculator) return calculator;
    calculator = document.createElement("div");
    calculator.className = "money-calculator hidden";
    calculator.id = "moneyCalculator";
    calculator.innerHTML = `
      <div class="money-calculator-card" role="dialog" aria-modal="true" aria-labelledby="moneyCalculatorTitle">
        <div class="modal-header">
          <h3 id="moneyCalculatorTitle">Kalkulator Nominal</h3>
          <button class="icon-button" type="button" data-money-cancel title="Tutup">${window.AppIcons.icon("x", 18)}</button>
        </div>
        <div class="money-calculator-body">
          <div class="money-calculator-display" aria-live="polite">
            <span id="moneyCalculatorResult">Rp0</span>
            <input id="moneyCalculatorExpression" class="money-calculator-expression" type="text" inputmode="none" aria-label="Ekspresi nominal" readonly tabindex="-1" />
          </div>
          <p class="form-status hidden" id="moneyCalculatorStatus"></p>
          <div class="money-keypad">
            ${["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", "000", "⌫", "+", "C", "=", "Batal", "Gunakan"].map((key) => `<button class="button ${key === "Gunakan" ? "primary" : key === "Batal" ? "danger" : ""}" type="button" data-money-key="${key}">${key}</button>`).join("")}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(calculator);
    return calculator;
  },

  open(input) {
    if (!input || input.dataset.calculatorOpening === "true") return;
    input.blur();
    input.dataset.calculatorOpening = "true";
    setTimeout(() => {
      input.dataset.calculatorOpening = "false";
    }, 250);
    const calculator = window.AppMoneyCalculator.ensure();
    const expressionInput = calculator.querySelector("#moneyCalculatorExpression");
    const status = calculator.querySelector("#moneyCalculatorStatus");
    calculator.dataset.targetInput = input.id;
    expressionInput.value = window.AppUtils.parseRupiahToNumber(input.value) || "";
    window.AppMoneyCalculator.updateResult();
    status.className = "form-status hidden";
    status.textContent = "";
    calculator.classList.remove("hidden");
  },

  close() {
    document.querySelector("#moneyCalculator")?.classList.add("hidden");
  },

  updateResult() {
    const calculator = document.querySelector("#moneyCalculator");
    const expressionInput = calculator?.querySelector("#moneyCalculatorExpression");
    const result = calculator?.querySelector("#moneyCalculatorResult");
    if (!expressionInput || !result) return;
    try {
      result.textContent = window.AppUtils.money(window.AppMoneyCalculator.calculate(expressionInput.value));
    } catch {
      result.textContent = "Rp0";
    }
  },
};
