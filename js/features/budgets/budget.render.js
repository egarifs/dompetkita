window.AppBudgetRender = {
  createRenderer(deps) {
    const {
      activeBudgets,
      budgetRemainingAmount,
      budgetTypeLabel,
      budgetUsedAmount,
      childBudgets,
      currentMonthKey,
      editIcon,
      escapeHtml,
      money,
      trashIcon,
    } = deps;

    function renderBudgets() {
      const month = currentMonthKey();
      const parents = activeBudgets().filter((budget) => !budget.parentId);
      const rows = parents.map((budget) => {
        const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
        const spent = budgetUsedAmount(budget, month);
        const percent = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
        const statusClass = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
        const children = childBudgets(budget.id);
        return `
          <details class="budget-row budget-parent" open>
            <summary class="budget-row-top">
              <div>
                <strong>${escapeHtml(budget.name)}</strong>
                <span>${escapeHtml(budgetTypeLabel(budget.type))} - ${escapeHtml(budget.period || "monthly")}</span>
              </div>
              <span>${money(spent)} / ${money(limit)}</span>
            </summary>
            <div class="progress ${statusClass}"><i style="width: ${percent}%"></i></div>
            <div class="stat-sub">${budgetRemainingAmount(budget, month) >= 0 ? "Sisa" : "Lewat"} ${money(Math.abs(budgetRemainingAmount(budget, month)))}</div>
            <div class="row-actions budget-actions">
              <button class="button" type="button" data-add-sub-budget="${budget.id}">Tambah Sub Kategori</button>
              <button class="button" type="button" data-edit-budget="${budget.id}">Edit</button>
              <button class="button danger" type="button" data-delete-budget="${budget.id}">Hapus</button>
            </div>
            ${children.length ? `<div class="budget-sub-list">${children.map((child) => {
              const childLimit = Number(child.budgetLimit ?? child.limit ?? 0);
              const childSpent = budgetUsedAmount(child, month);
              const childPercent = childLimit ? Math.min(100, Math.round((childSpent / childLimit) * 100)) : 0;
              const childStatus = childPercent >= 100 ? "danger" : childPercent >= 80 ? "warn" : "";
              return `
                <article class="budget-row budget-child">
                  <div class="budget-row-top">
                    <div>
                      <strong>${escapeHtml(child.name)}</strong>
                      <span>${money(childSpent)} / ${money(childLimit)}</span>
                    </div>
                    <div class="row-actions">
                      <button class="icon-button" type="button" title="Edit sub kategori" data-edit-budget="${child.id}">${editIcon()}</button>
                      <button class="icon-button danger" type="button" title="Hapus sub kategori" data-delete-budget="${child.id}">${trashIcon()}</button>
                    </div>
                  </div>
                  <div class="progress ${childStatus}"><i style="width: ${childPercent}%"></i></div>
                  <div class="stat-sub">${budgetRemainingAmount(child, month) >= 0 ? "Sisa" : "Lewat"} ${money(Math.abs(budgetRemainingAmount(child, month)))}</div>
                </article>
              `;
            }).join("")}</div>` : `<div class="stat-sub">Belum ada sub kategori.</div>`}
          </details>
        `;
      }).join("");

      const analyticsList = document.querySelector("#homeBudgetList");
      if (analyticsList) analyticsList.innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
      document.querySelector("#budgetPageList").innerHTML = rows || `<div class="empty"><p>Belum ada anggaran.</p></div>`;
    }

    return { renderBudgets };
  },
};
