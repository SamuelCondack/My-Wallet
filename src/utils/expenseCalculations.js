export function buildExpensesByMonth(expensesList, referenceDate = new Date()) {
  const expensesByMonth = {};

  expensesList.forEach((expense) => {
    if (!expense.inclusionDate || expense.isMonthly) {
      return;
    }

    const [year, month] = expense.inclusionDate.split("-");
    if (!year || !month) {
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
      });
    }
  });

  function addExpenseToMonth(expense, date) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!expensesByMonth[monthKey]) {
      expensesByMonth[monthKey] = [];
    }

    const index = expensesByMonth[monthKey].findIndex((e) => e.id === expense.id);
    const payload = { ...expense };

    if (index === -1) {
      expensesByMonth[monthKey].push(payload);
    } else {
      expensesByMonth[monthKey][index] = payload;
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
  return (expensesByMonth[monthKey] || []).reduce(
    (sum, expense) => sum + Number(expense.value || 0),
    0
  );
}

export function getCategoryTotals(expensesByMonth, monthKey, defaultCategoryId = "other") {
  const totals = {};

  (expensesByMonth[monthKey] || []).forEach((expense) => {
    const categoryId = expense.categoryId || defaultCategoryId;
    totals[categoryId] = (totals[categoryId] || 0) + Number(expense.value || 0);
  });

  return Object.entries(totals).map(([categoryId, value]) => ({ categoryId, value }));
}

export function getUniqueYears(expensesList, expensesByMonth) {
  const uniqueYears = [
    ...new Set([
      ...expensesList.flatMap((expense) => {
        if (!expense.inclusionDate) {
          return [];
        }

        const [year, month] = expense.inclusionDate.split("-");
        const installments = expense.installments ? parseInt(expense.installments, 10) : 1;

        return Array.from({ length: installments }, (_, i) => {
          const installmentYear = new Date(year, month - 1 + i, 1).getFullYear();
          return installmentYear;
        });
      }),
      ...Object.keys(expensesByMonth)
        .filter((monthKey) => monthKey && monthKey.includes("-"))
        .map((monthKey) => {
          const [year] = monthKey.split("-");
          return year && /^\d{4}$/.test(year) ? parseInt(year, 10) : null;
        })
        .filter((year) => year !== null),
    ]),
  ];

  return uniqueYears.sort((a, b) => a - b);
}

export function getUniqueMonthsForYear(expensesList, expensesByMonth, selectedYear) {
  const uniqueMonths = [
    ...new Set([
      ...expensesList.flatMap((expense) => {
        if (!expense.inclusionDate) {
          return [];
        }

        const [year, month] = expense.inclusionDate.split("-");
        if (!year || !month || isNaN(year) || isNaN(month)) {
          return [];
        }

        const installments = expense.installments ? parseInt(expense.installments, 10) : 1;

        if (expense.isMonthly) {
          const inclusionDate = new Date(year, month - 1, 1);
          return inclusionDate.getFullYear().toString() === selectedYear
            ? [inclusionDate.getMonth() + 1]
            : [];
        }

        return Array.from({ length: installments }, (_, i) => {
          const installmentMonth = new Date(year, month - 1 + i, 1);
          if (isNaN(installmentMonth)) {
            return null;
          }

          return installmentMonth.getFullYear().toString() === selectedYear
            ? installmentMonth.getMonth() + 1
            : null;
        }).filter((item) => item !== null);
      }),
      ...Object.keys(expensesByMonth)
        .filter((monthKey) => monthKey && monthKey.includes("-"))
        .flatMap((monthKey) => {
          const [year, month] = monthKey.split("-");
          if (!year || !month || isNaN(year) || isNaN(month)) {
            return [];
          }

          return year === selectedYear ? parseInt(month, 10) : null;
        })
        .filter((month) => month !== null),
    ]),
  ];

  const monthOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return uniqueMonths
    .map((month) => month.toString().padStart(2, "0"))
    .sort(
      (a, b) => monthOrder.indexOf(parseInt(a, 10)) - monthOrder.indexOf(parseInt(b, 10))
    );
}

export function getActiveMonthKeys(expensesByMonth, selectedYear, selectedMonth) {
  const allKeys = Object.keys(expensesByMonth);

  if (selectedYear === "All") {
    return allKeys;
  }

  if (selectedMonth === "All") {
    return allKeys.filter((key) => key.startsWith(`${selectedYear}-`));
  }

  return [`${selectedYear}-${selectedMonth.padStart(2, "0")}`];
}

export function getAggregatedMonthTotal(expensesByMonth, monthKeys) {
  return monthKeys.reduce((sum, key) => sum + getMonthTotal(expensesByMonth, key), 0);
}

export function getAggregatedCategoryTotals(
  expensesByMonth,
  monthKeys,
  defaultCategoryId = "other"
) {
  const totals = {};

  monthKeys.forEach((key) => {
    getCategoryTotals(expensesByMonth, key, defaultCategoryId).forEach(({ categoryId, value }) => {
      totals[categoryId] = (totals[categoryId] || 0) + value;
    });
  });

  return Object.entries(totals).map(([categoryId, value]) => ({ categoryId, value }));
}
