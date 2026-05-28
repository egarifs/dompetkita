window.AppDashboard = {
  normalizeHomeSectionOrder(order, defaultHomeSectionOrder) {
    const configured = Array.isArray(order) ? order : [];
    return [...new Set([...configured, ...defaultHomeSectionOrder])].filter((section) => defaultHomeSectionOrder.includes(section));
  },

  sectionLabel(section) {
    const labels = {
      wallets: "Saldo Dompet",
      insight: "Insight",
      latestTransactions: "Transaksi Terbaru",
    };
    return labels[section] || section;
  },

  createDashboard(deps) {
    const {
      getCurrentUser,
      getState,
      activeDebts,
      appIcon,
      currentBudgetTotal,
      currentMonthKey,
      defaultHomeSectionOrder,
      money,
      monthLabel,
      monthOf,
      previousMonthKey,
      sumTransactions,
      totalBalanceUntil,
      transactionsByMonth,
    } = deps;

    function randomizeTotalBalanceGradient() {
      const card = document.querySelector(".total-balance-card");
      if (!card || card.dataset.gradientSeeded === "true") return;
      const percent = (min, max) => `${Math.round(min + Math.random() * (max - min))}%`;
      card.dataset.gradientSeeded = "true";
      card.style.setProperty("--balance-a-x", percent(10, 34));
      card.style.setProperty("--balance-a-y", percent(12, 42));
      card.style.setProperty("--balance-b-x", percent(66, 92));
      card.style.setProperty("--balance-b-y", percent(10, 40));
      card.style.setProperty("--balance-c-x", percent(38, 72));
      card.style.setProperty("--balance-c-y", percent(58, 88));
      card.style.setProperty("--balance-glow-x", percent(62, 90));
      card.style.setProperty("--balance-glow-y", percent(12, 72));
      card.style.setProperty("--balance-flow-duration", `${Math.round(11 + Math.random() * 6)}s`);
      card.style.setProperty("--balance-glow-duration", `${Math.round(7 + Math.random() * 5)}s`);
    }

    function renderGreeting() {
      const currentUser = getCurrentUser();
      const hour = new Date().getHours();
      const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
      const displayName = currentUser?.name || currentUser?.email || currentUser?.username || "Pengguna";
      const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "DP";
      const greetingTarget = document.querySelector("#dashboardGreeting");
      const nameTarget = document.querySelector("#dashboardUserName");
      const avatarTarget = document.querySelector("#dashboardAvatar");
      if (greetingTarget) greetingTarget.textContent = greeting;
      if (nameTarget) nameTarget.textContent = displayName;
      if (avatarTarget) avatarTarget.textContent = initials;
    }

    function maskedMoney() {
      return "Rp •••••••";
    }

    function updateTotalBalanceVisibility(total) {
      const state = getState();
      const target = document.querySelector("#totalBalance");
      const button = document.querySelector("#toggleTotalBalanceVisibilityButton");
      if (!target || !button) return;
      const visible = Boolean(state.settings.totalBalanceVisible);
      target.textContent = visible ? money(total) : maskedMoney();
      button.innerHTML = appIcon(visible ? "eye" : "eye-off", 18);
      button.setAttribute("aria-label", visible ? "Sembunyikan total saldo" : "Tampilkan total saldo");
    }

    function renderStats() {
      const state = getState();
      const month = currentMonthKey();
      const currentItems = transactionsByMonth(month);
      const previousItems = transactionsByMonth(previousMonthKey(month));
      const currentExpense = sumTransactions(currentItems, "expense");
      const previousExpense = sumTransactions(previousItems, "expense");
      const currentIncome = sumTransactions(currentItems, "income");
      const budgetTotal = currentBudgetTotal();
      const remaining = budgetTotal - currentExpense;
      const unpaidReceivable = activeDebts("receivable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);
      const unpaidPayable = activeDebts("payable").reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount ?? 0), 0);

      renderGreeting();
      randomizeTotalBalanceGradient();
      document.querySelector("#monthExpense").textContent = money(currentExpense);
      document.querySelector("#monthIncome").textContent = money(currentIncome);
      updateTotalBalanceVisibility(state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0));
      document.querySelector("#remainingBudget").textContent = money(remaining);
      document.querySelector("#debtSummary").textContent = money(unpaidReceivable - unpaidPayable);

      const trend = document.querySelector("#expenseTrend");
      trend.className = "stat-sub";
      if (!previousExpense && currentExpense) {
        trend.textContent = "Belum ada data bulan lalu";
      } else if (!previousExpense && !currentExpense) {
        trend.textContent = "Belum ada pembanding";
      } else {
        const delta = currentExpense - previousExpense;
        const percent = Math.abs((delta / previousExpense) * 100).toFixed(1);
        trend.textContent = delta >= 0 ? `Naik ${percent}% dari bulan lalu` : `Turun ${percent}% dari bulan lalu`;
        trend.classList.add(delta >= 0 ? "trend-up" : "trend-down");
      }

      const budgetStatus = document.querySelector("#budgetStatus");
      if (!budgetTotal) budgetStatus.textContent = "Belum ada anggaran";
      else if (remaining >= 0) budgetStatus.textContent = `${Math.round((remaining / budgetTotal) * 100)}% masih tersedia`;
      else budgetStatus.textContent = `Lewat anggaran ${money(Math.abs(remaining))}`;
    }

    function renderChart() {
      const box = document.querySelector("#balanceChart");
      const month = currentMonthKey();
      const [year, monthNumber] = month.split("-").map(Number);
      const today = new Date();
      const days = today.getFullYear() === year && today.getMonth() + 1 === monthNumber ? today.getDate() : new Date(year, monthNumber, 0).getDate();
      const budgetTotal = currentBudgetTotal();
      const points = [];

      for (let day = 1; day <= days; day += Math.max(1, Math.floor(days / 10))) {
        const date = `${month}-${String(day).padStart(2, "0")}`;
        const spent = transactionsByMonth(month)
          .filter((item) => item.type === "expense" && item.date <= date)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        points.push({ day, balance: totalBalanceUntil(date), budget: budgetTotal - spent });
      }
      if (!points.some((point) => point.day === days)) {
        const date = `${month}-${String(days).padStart(2, "0")}`;
        const spent = transactionsByMonth(month)
          .filter((item) => item.type === "expense" && item.date <= date)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        points.push({ day: days, balance: totalBalanceUntil(date), budget: budgetTotal - spent });
      }

      const values = points.flatMap((point) => [point.balance, point.budget]);
      const min = Math.min(...values, 0);
      const max = Math.max(...values, 1);
      const width = 820;
      const height = 286;
      const pad = 34;
      const x = (day) => pad + ((day - 1) / Math.max(1, days - 1)) * (width - pad * 2);
      const y = (value) => height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
      const pathFor = (key) => points.map((point, index) => `${index ? "L" : "M"}${x(point.day).toFixed(1)} ${y(point[key]).toFixed(1)}`).join(" ");
      const grid = [0, 1, 2, 3].map((step) => {
        const lineY = pad + step * ((height - pad * 2) / 3);
        return `<line x1="${pad}" y1="${lineY}" x2="${width - pad}" y2="${lineY}" stroke="#e7edf1" />`;
      }).join("");

      box.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik total saldo dan sisa anggaran">
          <rect width="${width}" height="${height}" fill="transparent"></rect>
          ${grid}
          <path d="${pathFor("balance")}" fill="none" stroke="#176b5b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="${pathFor("budget")}" fill="none" stroke="#5d5bd6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map((point) => `<circle cx="${x(point.day).toFixed(1)}" cy="${y(point.balance).toFixed(1)}" r="4" fill="#176b5b" />`).join("")}
          ${points.map((point) => `<circle cx="${x(point.day).toFixed(1)}" cy="${y(point.budget).toFixed(1)}" r="4" fill="#5d5bd6" />`).join("")}
          <text x="${pad}" y="24" fill="#65727d" font-size="13" font-weight="700">${monthLabel(month)}</text>
          <text x="${width - pad}" y="24" text-anchor="end" fill="#65727d" font-size="13" font-weight="700">${money(max)}</text>
          <text x="${width - pad}" y="${height - 13}" text-anchor="end" fill="#65727d" font-size="13" font-weight="700">${money(min)}</text>
        </svg>
      `;
    }

    function quickRangeMatch(item, range) {
      if (range === "all") return true;
      const itemDate = new Date(`${item.date}T00:00:00`);
      if (Number.isNaN(itemDate.getTime())) return false;
      const today = new Date();
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      if (range === "today") return itemDay.getTime() === startToday.getTime();
      if (range === "week") {
        const day = startToday.getDay() || 7;
        const startWeek = new Date(startToday);
        startWeek.setDate(startToday.getDate() - day + 1);
        return itemDay >= startWeek && itemDay <= startToday;
      }
      return monthOf(item) === currentMonthKey();
    }

    function renderMenuOrder() {
      const state = getState();
      const dashboard = document.querySelector("#dashboardSections");
      if (!dashboard) return;
      const sectionMap = new Map([...dashboard.querySelectorAll("[data-home-section]")].map((section) => [section.dataset.homeSection, section]));
      const orderedSections = window.AppDashboard.normalizeHomeSectionOrder(state.settings.homeSectionOrder, defaultHomeSectionOrder);
      state.settings.homeSectionOrder = orderedSections;
      for (const section of orderedSections) {
        const element = sectionMap.get(section);
        if (element) dashboard.appendChild(element);
      }
    }

    return {
      quickRangeMatch,
      randomizeTotalBalanceGradient,
      renderChart,
      renderGreeting,
      renderMenuOrder,
      renderStats,
      updateTotalBalanceVisibility,
    };
  },
};
