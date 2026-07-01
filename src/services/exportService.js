import { buildExpensesByMonth, getMonthTotal } from "../utils/expenseCalculations";
import { getLastNMonthKeys } from "../utils/finance";

export function exportExpensesToCsv(expenses, categoriesMap) {
  const headers = ["Name", "Category", "Value", "Date", "Method", "Monthly", "Installments"];
  const rows = expenses.map((expense) => [
    expense.name,
    categoriesMap[expense.categoryId || "other"]?.name || "Other",
    expense.value,
    expense.inclusionDate,
    expense.method,
    expense.isMonthly ? "Yes" : "No",
    expense.installments || 1,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mywallet-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getMonthlyTrend(expenses, months = 6) {
  const expensesByMonth = buildExpensesByMonth(expenses);
  return getLastNMonthKeys(months).map((monthKey) => ({
    monthKey,
    total: getMonthTotal(expensesByMonth, monthKey),
  }));
}
