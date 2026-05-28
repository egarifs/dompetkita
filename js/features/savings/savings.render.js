window.AppSavingsRender = {
  createRenderer(deps) {
    const {
      escapeHtml,
      getState,
      isSavingsAchieved,
      money,
      savingsBalance,
      savingsPercent,
      trashIcon,
    } = deps;

    function rows(limit = null) {
      const state = getState();
      const activeGoals = state.savings.filter((goal) => !isSavingsAchieved(goal));
      const goals = [...activeGoals].sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || "")).slice(0, limit ?? activeGoals.length);
      if (!goals.length) {
        return `
          <div class="empty">
            <p>Belum ada tujuan tabungan.</p>
            <button class="button primary" type="button" data-open-form="savingsGoal">Tambah Tujuan</button>
          </div>
        `;
      }

      return goals.map((goal) => {
        const balance = savingsBalance(goal);
        const percent = savingsPercent(goal);
        return `
          <article class="budget-row" data-open-savings="${goal.id}">
            <div class="budget-row-top">
              <div>
                <strong>${escapeHtml(goal.title)}</strong>
                <span>${percent}%</span>
              </div>
              <button class="icon-button danger" type="button" data-delete-savings="${goal.id}" aria-label="Hapus tabungan ${escapeHtml(goal.title)}" title="Hapus tabungan">
                ${trashIcon()}
              </button>
            </div>
            <div class="progress"><i style="width: ${percent}%"></i></div>
            <div class="stat-sub">${money(balance)} dari ${money(goal.target)} - Target ${escapeHtml(goal.targetDate || "-")}</div>
          </article>
        `;
      }).join("");
    }

    function historyRows() {
      const state = getState();
      const achievedGoals = state.savings
        .filter((goal) => isSavingsAchieved(goal))
        .sort((a, b) => (b.targetDate || "").localeCompare(a.targetDate || ""));

      if (!achievedGoals.length) {
        return `<div class="empty"><p>Belum ada riwayat tabungan yang tercapai.</p></div>`;
      }

      return achievedGoals.map((goal) => {
        const balance = savingsBalance(goal);
        return `
          <article class="budget-row" data-open-savings="${goal.id}">
            <div class="budget-row-top">
              <div>
                <strong>${escapeHtml(goal.title)}</strong>
                <span>Tercapai</span>
              </div>
              <button class="icon-button danger" type="button" data-delete-savings="${goal.id}" aria-label="Hapus riwayat tabungan ${escapeHtml(goal.title)}" title="Hapus tabungan">
                ${trashIcon()}
              </button>
            </div>
            <div class="progress success"><i style="width: 100%"></i></div>
            <div class="stat-sub">${money(balance)} dari ${money(goal.target)} - Target ${escapeHtml(goal.targetDate || "-")}</div>
          </article>
        `;
      }).join("");
    }

    function renderSavings() {
      const state = getState();
      const activeCount = state.savings.filter((goal) => !isSavingsAchieved(goal)).length;
      document.querySelector("#homeSavingsList").innerHTML = rows(3);
      document.querySelector("#allSavingsList").innerHTML = rows();
      document.querySelector("#viewAllSavingsButton").classList.toggle("hidden", activeCount <= 3);
    }

    return {
      historyRows,
      renderSavings,
      rows,
    };
  },
};
