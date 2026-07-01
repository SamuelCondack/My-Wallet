export function buildExpensesByMonth(expensesList, referenceDate = new Date()) {
  const expensesByMonth = {};

  expensesList.forEach((expense) => {
    if (!expense.inclusionDate || expense.isMonthly) {
      return;
    }

    const [year, month] = expense.inclusionDate.split("-");
    if (!year || !month || Number.isNaN(Number(year)) || Number.isNaN(Number(month))) {
      return;
    }

    const installments = expense.installments ? parseInt(expense.installments, 10) : 1;

    for (let i = 0; i < installments; i += 1) {
      const installmentMonth = new Date(Number(year), Number(month) - 1 + i, 1);
      const monthKey = `${installmentMonth.getFullYear()}-${String(
        installmentMonth.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!expensesByMonth[monthKey]) {
        expensesByMonth[monthKey] = [];
      }

      expensesByMonth[monthKey].push({
        ...expense,
        value: expense.value / installments,
        installmentNumber: i + 1,
        totalValue: expense.value,
        installments,
      });
    }
  });

  function addExpenseToMonth(expense, date) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!expensesByMonth[monthKey]) {
      expensesByMonth[monthKey] = [];
    }

    const existingExpenseIndex = expensesByMonth[monthKey].findIndex((e) => e.id === expense.id);

    const payload = {
      ...expense,
      installmentNumber: null,
      totalValue: expense.value,
      installments: 1,
    };

    if (existingExpenseIndex === -1) {
      expensesByMonth[monthKey].push(payload);
    } else {
      expensesByMonth[monthKey][existingExpenseIndex] = payload;
    }
  }

  expensesList.forEach((expense) => {
    if (!expense.isMonthly || !expense.inclusionDate) {
      return;
    }

    const [year, month] = expense.inclusionDate.split("-");
    const inclusionDate = new Date(Number(year), Number(month) - 1, 1);
    let currentMonth = new Date(inclusionDate);

    addExpenseToMonth(expense, inclusionDate);

    if (expense.isPaused && expense.pauseDate) {
      const [pauseYear, pauseMonth] = expense.pauseDate.split("-");
      const pauseDate = new Date(Number(pauseYear), Number(pauseMonth) - 1, 1);

      if (pauseDate > inclusionDate) {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        while (currentMonth <= pauseDate) {
          addExpenseToMonth(expense, currentMonth);
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
      }
    } else {
      const currentMonthStart = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        1
      );

      if (inclusionDate <= currentMonthStart) {
        const propagationLimit = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth() + 2,
          1
        );

        currentMonth.setMonth(currentMonth.getMonth() + 1);
        while (currentMonth <= propagationLimit) {
          addExpenseToMonth(expense, currentMonth);
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
      }
    }
  });

  return expensesByMonth;
}

export function getMonthTotal(expensesByMonth, monthKey) {
  const items = expensesByMonth[monthKey] || [];
  return items.reduce((sum, expense) => sum + Number(expense.value || 0), 0);
}

export function getCategoryTotals(expensesByMonth, monthKey, defaultCategoryId = "other") {
  const items = expensesByMonth[monthKey] || [];
  const totals = {};

  items.forEach((expense) => {
    const categoryId = expense.categoryId || defaultCategoryId;
    totals[categoryId] = (totals[categoryId] || 0) + Number(expense.value || 0);
  });

  return totals;
}

export function getUpcomingMonthlyReminders(expensesList, daysAhead = 7) {
  const today = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + daysAhead);

  return expensesList
    .filter((expense) => expense.isMonthly && !expense.isPaused && expense.inclusionDate)
    .map((expense) => {
      const day = Number(expense.inclusionDate.split("-")[2] || 1);
      const dueDate = new Date(today.getFullYear(), today.getMonth(), day);
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      return { ...expense, dueDate };
    })
    .filter((expense) => expense.dueDate <= limit)
    .sort((a, b) => a.dueDate - b.dueDate);
}
