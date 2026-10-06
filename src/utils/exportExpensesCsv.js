import { createTranslator } from "../i18n/translate";
import { PAYMENT_METHOD_LABEL_KEYS } from "../constants/quickAdd";

const defaultT = createTranslator("en");

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string for expense rows (name, date, value, category, method).
 * Optional `t` localizes the header row and payment method labels.
 */
export function buildMonthExpensesCsv(
  expenses,
  categoriesMap = {},
  t = defaultT
) {
  const header = [
    t("export.csv.name"),
    t("export.csv.date"),
    t("export.csv.value"),
    t("export.csv.category"),
    t("export.csv.method"),
  ];
  const lines = [header.join(",")];

  for (const expense of expenses) {
    const category =
      categoriesMap[expense.categoryId]?.name || expense.categoryId || "";
    lines.push(
      [
        escapeCsvCell(expense.name),
        escapeCsvCell(expense.inclusionDate || ""),
        escapeCsvCell(Number(expense.value || 0).toFixed(2)),
        escapeCsvCell(category),
        escapeCsvCell(
          PAYMENT_METHOD_LABEL_KEYS[expense.method]
            ? t(PAYMENT_METHOD_LABEL_KEYS[expense.method])
            : expense.method || ""
        ),
      ].join(",")
    );
  }

  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(
  filename,
  content,
  mime = "text/csv;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
