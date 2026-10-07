import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createTranslator } from "../i18n/translate";
import { PAYMENT_METHOD_LABEL_KEYS } from "../constants/quickAdd";
import { deliverPdf } from "./deliverPdf";

const defaultT = createTranslator("en");

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function shortDate(value, locale = "en-US") {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  if (!year || !month) return String(value);
  if (String(locale).toLowerCase().startsWith("pt")) {
    return `${day || "01"}/${month}/${year}`;
  }
  return `${month}/${day || "01"}/${year}`;
}

/**
 * Build and download a monthly expenses PDF for the visible Dashboard period.
 *
 * Optional `t` (translate function from useT()) and `locale` (e.g. "pt-BR")
 * localize all PDF strings. Defaults to English.
 */
export async function downloadMonthExpensesPdf({
  expenses = [],
  categoriesMap = {},
  categoryTotals = [],
  periodLabel,
  fileStem = "mywallet-expenses",
  totalSpendings = 0,
  t = defaultT,
  locale = "en-US",
} = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let cursorY = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(11, 18, 32);
  doc.text("MyWallet", marginX, cursorY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(113, 113, 122);
  doc.text(t("export.pdf.expenseReport"), marginX, cursorY + 18);

  cursorY += 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 18, 32);
  doc.text(String(periodLabel || t("export.pdf.defaultPeriod")), marginX, cursorY);

  cursorY += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(
    t("export.pdf.totalSpendings", { amount: money(totalSpendings) }),
    marginX,
    cursorY
  );
  doc.text(
    t("export.pdf.expensesCount", { count: expenses.length }),
    marginX + 220,
    cursorY
  );

  const categoryRows = [...categoryTotals]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .map((item) => [
      categoriesMap[item.categoryId]?.name ||
        item.categoryId ||
        t("common.other"),
      money(item.value),
    ]);

  if (categoryRows.length > 0) {
    cursorY += 18;
    autoTable(doc, {
      startY: cursorY,
      head: [[t("export.pdf.colCategory"), t("export.pdf.colSpent")]],
      body: categoryRows,
      margin: { left: marginX, right: marginX },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [62, 146, 235],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: "right" },
      },
    });
    cursorY = doc.lastAutoTable.finalY + 20;
  } else {
    cursorY += 24;
  }

  const expenseRows = expenses.map((expense) => [
    expense.name || "—",
    shortDate(expense.inclusionDate, locale),
    money(expense.value),
    categoriesMap[expense.categoryId]?.name || expense.categoryId || "—",
    PAYMENT_METHOD_LABEL_KEYS[expense.method]
      ? t(PAYMENT_METHOD_LABEL_KEYS[expense.method])
      : expense.method || "—",
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        t("export.pdf.colName"),
        t("export.pdf.colDate"),
        t("export.pdf.colAmount"),
        t("export.pdf.colCategory"),
        t("export.pdf.colMethod"),
      ],
    ],
    body:
      expenseRows.length > 0
        ? expenseRows
        : [[t("export.pdf.noExpenses"), "", "", "", ""]],
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [15, 23, 42],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 70 },
      2: { halign: "right", cellWidth: 70 },
      3: { cellWidth: 90 },
      4: { cellWidth: 80 },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      t("export.pdf.generatedPro", {
        date: new Date().toLocaleString(locale),
      }),
      marginX,
      doc.internal.pageSize.getHeight() - 24
    );
    doc.text(
      t("export.pdf.pageOf", { page, total: pageCount }),
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 24,
      { align: "right" }
    );
  }

  const safeStem = String(fileStem || "mywallet-expenses").replace(
    /[^\w.-]+/g,
    "-"
  );
  await deliverPdf(doc, `${safeStem}.pdf`);
}
