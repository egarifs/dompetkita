window.AppAnalyticsRender = {
  createRenderer(deps) {
    const {
      activeBudgets,
      analyticsService,
      appIcon,
      budgetTypeLabel,
      budgetUsedAmount,
      currentMonthKey,
      escapeHtml,
      expenseForCategory,
      getCategories,
      getShowAllDailyExpenses,
      getState,
      latestVehicleOil,
      money,
      monthLabel,
      monthOf,
      nearestVehiclePart,
      oilNextDate,
      oilNextKm,
      partNextDate,
      partNextKm,
      previousMonthKey,
      sumTransactions,
      todayDate,
      transactionsByMonth,
      vehicleStatusBySchedule,
      vehicleTax,
      walletName,
      showModal,
    } = deps;

    function renderInsights() {
      const state = getState();
      const categories = getCategories();
      const month = currentMonthKey();
      const previousMonth = previousMonthKey(month);
      const currentItems = transactionsByMonth(month);
      const previousItems = transactionsByMonth(previousMonth);
      const currentIncome = sumTransactions(currentItems, "income");
      const savingsAdded = state.savings.reduce((sum, goal) => {
        return sum + (goal.entries || [])
          .filter((entry) => entry.type === "deposit" && monthOf(entry) === month)
          .reduce((entrySum, entry) => entrySum + Number(entry.amount || 0), 0);
      }, 0);
      const insights = [];

      const categoryTotals = categories
        .map((category) => ({ category, total: expenseForCategory(category, month) }))
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total);
      if (categoryTotals.length) {
        insights.push({
          title: "Kategori terbesar bulan ini",
          text: `${categoryTotals[0].category} adalah kategori pengeluaran terbesar dengan total ${money(categoryTotals[0].total)}.`,
          tone: "debt",
          category: categoryTotals[0].category,
        });
      }

      categories.forEach((category) => {
        const current = expenseForCategory(category, month);
        const previous = previousItems
          .filter((item) => item.type === "expense" && item.category === category)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        if (current > 0 && previous > 0) {
          const change = ((current - previous) / previous) * 100;
          if (Math.abs(change) >= 20) {
            insights.push({
              title: `Pengeluaran ${category}`,
              text: `Pengeluaran ${category.toLowerCase()} bulan ini ${change > 0 ? "naik" : "turun"} ${Math.abs(change).toFixed(0)}% dari bulan lalu.`,
              tone: change > 0 ? "expense" : "income",
              category,
            });
          }
        }
      });

      if (currentIncome > 0) {
        const percent = Math.round((savingsAdded / currentIncome) * 100);
        insights.push({
          title: "Rasio tabungan",
          text: savingsAdded > 0 ? `Kamu berhasil menabung ${percent}% dari pemasukan bulan ini.` : "Belum ada setoran tabungan dari pemasukan bulan ini.",
          tone: savingsAdded > 0 ? "income" : "debt",
        });
      }

      activeBudgets("expense").filter((budget) => !budget.parentId).forEach((budget) => {
        const spent = budgetUsedAmount(budget, month);
        const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
        const percent = limit ? Math.round((spent / limit) * 100) : 0;
        if (percent >= 80) {
          insights.push({
            title: `Budget ${budget.name}`,
            text: `Budget ${budget.name.toLowerCase()} sudah terpakai ${percent}%.`,
            tone: percent >= 100 ? "expense" : "debt",
          });
        }
      });

      if (!insights.length) {
        insights.push({
          title: "Belum cukup data",
          text: "Tambahkan transaksi, budget, dan tabungan agar insight otomatis semakin akurat.",
          tone: "debt",
        });
      }

      document.querySelector("#insightList").innerHTML = insights.slice(0, 5).map((item) => `
        <article class="debt-row ${item.category ? "clickable-row" : ""}" ${item.category ? `data-insight-category="${escapeHtml(item.category)}"` : ""}>
          <div class="debt-row-top">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="pill ${item.tone}">Insight</span>
          </div>
          <p style="margin-top: 7px; color: var(--muted); font-size: .92rem">${escapeHtml(item.text)}</p>
        </article>
      `).join("");
    }

    function transactionsSince(days) {
      const state = getState();
      const start = new Date(`${todayDate()}T00:00:00`);
      start.setDate(start.getDate() - Number(days || 0));
      const startKey = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      return state.transactions.filter((item) => item.date >= startKey && item.date <= todayDate());
    }

    function categoryGrowthActions(month = currentMonthKey()) {
      const categories = getCategories();
      const previousMonth = previousMonthKey(month);
      return categories
        .map((category) => {
          const current = expenseForCategory(category, month);
          const previous = transactionsByMonth(previousMonth)
            .filter((item) => item.type === "expense" && item.category === category)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
          return { category, current, previous, change };
        })
        .filter((item) => item.current > item.previous && item.previous > 0 && item.change >= 30)
        .sort((a, b) => b.change - a.change);
    }

    function budgetSuggestionAction(month = currentMonthKey()) {
      const categories = getCategories();
      const budgetRows = activeBudgets("expense").filter((budget) => !budget.parentId)
        .map((budget) => {
          const spent = budgetUsedAmount(budget, month);
          const limit = Number(budget.budgetLimit ?? budget.limit ?? 0);
          const percent = limit ? Math.round((spent / limit) * 100) : 0;
          return { category: budget.name || budget.category, spent, limit, percent };
        })
        .filter((item) => item.spent > 0)
        .sort((a, b) => b.percent - a.percent || b.spent - a.spent);
      if (!budgetRows.length) {
        const topCategory = categories
          .map((category) => ({ category, spent: expenseForCategory(category, month) }))
          .filter((item) => item.spent > 0)
          .sort((a, b) => b.spent - a.spent)[0];
        if (!topCategory) return null;
        const suggestedLimit = Math.ceil((topCategory.spent * 1.1) / 10000) * 10000;
        return {
          title: "Saran budget bulan depan",
          text: `Mulai buat budget ${topCategory.category} sekitar ${money(suggestedLimit)} berdasarkan pemakaian bulan ini.`,
          tone: "debt",
        };
      }
      const target = budgetRows[0];
      const suggested = Math.ceil(Math.max(target.spent * 1.1, target.limit || target.spent) / 10000) * 10000;
      return {
        title: "Saran budget bulan depan",
        text: target.limit
          ? `Kategori ${target.category} sudah terpakai ${target.percent}%. Pertimbangkan budget sekitar ${money(suggested)} bulan depan.`
          : `Mulai buat budget ${target.category} sekitar ${money(suggested)} berdasarkan pemakaian bulan ini.`,
        tone: target.percent >= 100 ? "expense" : "debt",
      };
    }

    function upcomingBillAction() {
      const state = getState();
      const bills = state.billReminders
        .filter((item) => item.status !== "paid" && item.dueDate)
        .map((item) => {
          const today = new Date(`${todayDate()}T00:00:00`);
          const target = new Date(`${item.dueDate}T00:00:00`);
          return { ...item, days: Math.ceil((target - today) / 86400000) };
        })
        .filter((item) => item.days <= 7)
        .sort((a, b) => a.days - b.days);
      if (!bills.length) return null;
      const bill = bills[0];
      const label = bill.days < 0 ? `terlambat ${Math.abs(bill.days)} hari` : bill.days === 0 ? "jatuh tempo hari ini" : `${bill.days} hari lagi`;
      return {
        title: "Tagihan mendekati jatuh tempo",
        text: `${bill.title} ${label} dengan nominal ${money(bill.amount)}.`,
        tone: bill.days < 0 ? "expense" : "debt",
      };
    }

    function vehicleAttentionAction() {
      const state = getState();
      const actions = [];
      state.vehicles.forEach((vehicle) => {
        const oil = latestVehicleOil(vehicle.id);
        const part = nearestVehiclePart(vehicle.id);
        const tax = vehicleTax(vehicle.id);
        const checks = [
          oil ? { label: "ganti oli", status: vehicleStatusBySchedule(oilNextDate(oil), oilNextKm(oil) - Number(vehicle.currentKm || 0)) } : null,
          part ? { label: `ganti ${part.partName || "part"}`, status: vehicleStatusBySchedule(partNextDate(part), partNextKm(part) - Number(vehicle.currentKm || 0)) } : null,
          tax ? { label: "pajak tahunan", status: vehicleStatusBySchedule(tax.annualDueDate) } : null,
        ].filter(Boolean);
        checks
          .filter((item) => item.status.className === "danger" || item.status.className === "warn")
          .forEach((item) => actions.push({ vehicle, ...item }));
      });
      if (!actions.length) return null;
      const priority = actions.sort((a, b) => (a.status.className === "danger" ? -1 : 1) - (b.status.className === "danger" ? -1 : 1))[0];
      return {
        title: "Kendaraan butuh perhatian",
        text: `${priority.vehicle.name} perlu cek ${priority.label}. Status: ${priority.status.label}.`,
        tone: priority.status.className === "danger" ? "expense" : "debt",
      };
    }

    function renderActionSummary() {
      const weeklyExpenses = transactionsSince(6)
        .filter((item) => item.type === "expense")
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      const growth = categoryGrowthActions()[0];
      const budgetSuggestion = budgetSuggestionAction();
      const upcomingBill = upcomingBillAction();
      const vehicleAttention = vehicleAttentionAction();
      const actions = [];

      if (weeklyExpenses.length) {
        const expense = weeklyExpenses[0];
        actions.push({
          title: "Pengeluaran terbesar minggu ini",
          text: `${expense.description || expense.category} sebesar ${money(expense.amount)} pada ${expense.date}.`,
          tone: "expense",
        });
      }

      if (growth) {
        actions.push({
          title: "Kategori naik drastis",
          text: `${growth.category} naik ${growth.change.toFixed(0)}% dari bulan lalu, dari ${money(growth.previous)} menjadi ${money(growth.current)}.`,
          tone: "expense",
        });
      }

      [budgetSuggestion, upcomingBill, vehicleAttention].filter(Boolean).forEach((item) => actions.push(item));

      if (!actions.length) {
        actions.push({
          title: "Belum ada prioritas mendesak",
          text: "Data masih aman. Tambahkan transaksi, budget, reminder tagihan, atau data kendaraan agar ringkasan tindakan semakin akurat.",
          tone: "income",
        });
      }

      const target = document.querySelector("#actionSummaryList");
      if (!target) return;
      target.innerHTML = actions.slice(0, 5).map((item) => `
        <article class="action-summary-card">
          <div class="debt-row-top">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="pill ${item.tone}">Aksi</span>
          </div>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `).join("");
    }

    function renderMonthOptions() {
      const state = getState();
      const select = document.querySelector("#monthFilter");
      const months = [...new Set(state.transactions.map(monthOf))].sort().reverse();
      select.innerHTML = `<option value="all">Semua bulan</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
    }

    function renderCategoryBreakdown() {
      const categories = getCategories();
      const month = document.querySelector("#monthFilter")?.value === "all" ? currentMonthKey() : document.querySelector("#monthFilter").value;
      const data = categories.map((category) => ({ category, spent: expenseForCategory(category, month) })).filter((item) => item.spent > 0);
      const max = Math.max(...data.map((item) => item.spent), 1);
      document.querySelector("#categoryBreakdown").innerHTML = data.length
        ? data.map((item) => `
            <article class="category-row">
              <div class="category-row-top">
                <strong>${escapeHtml(item.category)}</strong>
                <span>${money(item.spent)}</span>
              </div>
              <div class="progress"><i style="width: ${Math.round((item.spent / max) * 100)}%"></i></div>
            </article>
          `).join("")
        : `<div class="empty"><p>Belum ada pengeluaran pada bulan ini.</p></div>`;
    }

    function renderDailyExpenses() {
      const state = getState();
      const showAllDailyExpenses = getShowAllDailyExpenses();
      const monthFilter = document.querySelector("#monthFilter")?.value || "all";
      const today = todayDate();
      const dailyDateLabel = (date) => new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(`${date}T00:00:00`));
      const rows = state.transactions
        .filter((item) => item.type === "expense")
        .filter((item) => !showAllDailyExpenses || monthFilter === "all" || monthOf(item) === monthFilter)
        .reduce((summary, item) => {
          if (!summary[item.date]) summary[item.date] = { date: item.date, count: 0, total: 0, transactions: [] };
          summary[item.date].count += 1;
          summary[item.date].total += Number(item.amount || 0);
          summary[item.date].transactions.push(item);
          return summary;
        }, {});

      const allData = Object.values(rows).sort((a, b) => b.date.localeCompare(a.date));
      const data = showAllDailyExpenses ? allData : allData.filter((item) => item.date === today);
      const button = document.querySelector("#showAllDailyExpensesButton");
      const subtitle = document.querySelector("#dailyExpenseSubtitle");
      if (button) {
        button.classList.toggle("hidden", showAllDailyExpenses || allData.length <= data.length);
      }
      if (subtitle) {
        subtitle.textContent = showAllDailyExpenses
          ? "Semua tanggal pengeluaran yang tercatat."
          : `Pengeluaran hari ini, ${dailyDateLabel(today)}.`;
      }
      document.querySelector("#dailyExpenseList").innerHTML = data.length
        ? `
          <div class="daily-expense-list">
            ${data.map((item) => `
              <article class="daily-expense-group">
                <header class="daily-expense-header">
                  <strong>${escapeHtml(dailyDateLabel(item.date))}</strong>
                  <span>-${money(item.total)}</span>
                </header>
                <div class="daily-expense-transactions">
                  ${item.transactions
                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
                    .map((transaction) => {
                      const title = transaction.description?.trim() || transaction.category || "Transaksi";
                      return `
                        <div class="daily-expense-transaction">
                          <div class="daily-expense-icon" aria-hidden="true">
                            ${appIcon("receipt-text", 21)}
                          </div>
                          <div class="daily-expense-detail">
                            <strong>${escapeHtml(title)}</strong>
                            <span>${escapeHtml(transaction.category || "Lainnya")}</span>
                          </div>
                          <span class="daily-expense-amount">${money(transaction.amount)}</span>
                        </div>
                      `;
                    }).join("")}
                </div>
              </article>
            `).join("")}
          </div>
        `
        : `<div class="empty"><p>${showAllDailyExpenses ? "Belum ada pengeluaran untuk ditampilkan." : "Belum ada transaksi hari ini."}</p></div>`;
    }

    function budgetProgressPeriod() {
      const current = currentMonthKey();
      return {
        month: document.querySelector("#budgetProgressMonth")?.value || current.slice(5, 7),
        year: document.querySelector("#budgetProgressYear")?.value || current.slice(0, 4),
      };
    }

    function renderBudgetProgressOptions() {
      const state = getState();
      const monthInput = document.querySelector("#budgetProgressMonth");
      const yearInput = document.querySelector("#budgetProgressYear");
      if (!monthInput || !yearInput) return;
      const current = currentMonthKey();
      const selectedMonth = monthInput.value || current.slice(5, 7);
      const selectedYear = yearInput.value || current.slice(0, 4);
      const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
      const years = [...new Set([
        current.slice(0, 4),
        ...state.transactions.map((transaction) => String(transaction.date || "").slice(0, 4)),
      ].filter(Boolean))].sort().reverse();
      monthInput.innerHTML = months.map((month) => `<option value="${month}">${monthLabel(`2026-${month}`).replace(/\s+2026$/, "")}</option>`).join("");
      yearInput.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
      monthInput.value = months.includes(selectedMonth) ? selectedMonth : current.slice(5, 7);
      yearInput.value = years.includes(selectedYear) ? selectedYear : current.slice(0, 4);
    }

    function renderBudgetProgress() {
      renderBudgetProgressOptions();
      const { month, year } = budgetProgressPeriod();
      const rows = analyticsService.progressRows(year, month);
      const summary = analyticsService.summary(rows);
      const summaryTarget = document.querySelector("#budgetProgressSummary");
      const listTarget = document.querySelector("#budgetProgressList");
      if (!summaryTarget || !listTarget) return;
      summaryTarget.innerHTML = `
        <article class="stat-card"><span class="stat-label">Total Rencana</span><strong class="stat-value">${money(summary.totalPlan)}</strong></article>
        <article class="stat-card"><span class="stat-label">Total Aktual</span><strong class="stat-value">${money(summary.totalActual)}</strong></article>
        <article class="stat-card"><span class="stat-label">${summary.totalRemaining >= 0 ? "Total Sisa" : "Lebih Budget"}</span><strong class="stat-value ${summary.totalRemaining < 0 ? "expense-text" : ""}">${money(Math.abs(summary.totalRemaining))}</strong></article>
        <article class="stat-card"><span class="stat-label">Status Kategori</span><strong class="stat-value budget-progress-counts">${summary.counts.safe} aman</strong><span class="stat-sub">${summary.counts.watch} dipantau, ${summary.counts.nearly} hampir habis, ${summary.counts.over} melebihi budget</span></article>
      `;
      listTarget.innerHTML = rows.length
        ? rows.map((row) => {
          const width = Math.min(100, Math.max(0, row.percent));
          return `
            <button class="budget-progress-row" type="button" data-budget-progress-id="${row.budget.id}">
              <div class="budget-progress-row-top">
                <div>
                  <strong>${escapeHtml(row.name)}</strong>
                  <span>${escapeHtml(budgetTypeLabel(row.budget.type))} - ${escapeHtml(row.budget.period || "monthly")}</span>
                </div>
                <span class="pill ${row.status.className}">${row.status.label}</span>
              </div>
              <div class="progress ${row.status.className}"><i style="width: ${width}%"></i></div>
              <div class="budget-progress-values">
                <span>Rencana <strong>${money(row.limit)}</strong></span>
                <span>Aktual <strong>${money(row.actual)}</strong></span>
                <span>${row.remaining >= 0 ? "Sisa" : "Lebih"} <strong>${money(Math.abs(row.remaining))}</strong></span>
                <span>Progress <strong>${row.percent}%</strong></span>
              </div>
            </button>
          `;
        }).join("")
        : `<div class="empty budget-progress-empty"><p>Belum ada anggaran untuk dibandingkan.</p><button class="button primary" type="button" data-budget-progress-create>Buat Anggaran</button></div>`;
    }

    function openBudgetProgressDetail(budgetId) {
      const budget = analyticsService.budgetById(budgetId);
      if (!budget) return;
      const { month, year } = budgetProgressPeriod();
      const period = analyticsService.periodKey(year, month);
      const row = analyticsService.progressForBudget(budget, period);
      document.querySelector("#modalTitle").textContent = `Detail ${row.name}`;
      document.querySelector("#modalBody").innerHTML = `
        <div class="form">
          <div class="budget-progress-values budget-progress-detail-summary">
            <span>Rencana <strong>${money(row.limit)}</strong></span>
            <span>Aktual <strong>${money(row.actual)}</strong></span>
            <span>${row.remaining >= 0 ? "Sisa" : "Lebih"} <strong>${money(Math.abs(row.remaining))}</strong></span>
            <span>Status <strong>${row.status.label}</strong></span>
          </div>
          <div class="debt-list budget-progress-transactions">
            ${row.transactions.length ? row.transactions.map((transaction) => `
              <article class="debt-row">
                <div class="debt-row-top">
                  <div>
                    <strong>${escapeHtml(transaction.description || transaction.category || "Transaksi")}</strong>
                    <span>${escapeHtml(transaction.date || "")} - ${escapeHtml(walletName(transaction.walletId))}</span>
                  </div>
                  <strong>${money(transaction.amount)}</strong>
                </div>
              </article>
            `).join("") : `<div class="empty"><p>Belum ada transaksi yang masuk ke anggaran ini pada ${escapeHtml(period)}.</p></div>`}
          </div>
        </div>
      `;
      showModal();
    }

    return {
      budgetSuggestionAction,
      categoryGrowthActions,
      renderActionSummary,
      renderCategoryBreakdown,
      renderDailyExpenses,
      renderBudgetProgress,
      renderInsights,
      renderMonthOptions,
      openBudgetProgressDetail,
      transactionsSince,
      upcomingBillAction,
      vehicleAttentionAction,
    };
  },
};
