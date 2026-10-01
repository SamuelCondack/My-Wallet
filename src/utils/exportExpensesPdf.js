import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function shortDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  if (!year || !month) return String(value);
  return `${month}/${day || "01"}/${year}`;
}

/**
 * Build and download a monthly expenses PDF for the visible Dashboard period.
 */
export function downloadMonthExpensesPdf({
  expenses = [],
  categoriesMap = {},
  categoryTotals = [],
  periodLabel = "Period",
  fileStem = "mywallet-expenses",
  totalSpendings = 0,
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
  doc.text("Expense report", marginX, cursorY + 18);

  cursorY += 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 18, 32);
  doc.text(String(periodLabel), marginX, cursorY);

  cursorY += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total spendings: ${money(totalSpendings)}`, marginX, cursorY);
  doc.text(`Expenses: ${expenses.length}`, marginX + 220, cursorY);

  const categoryRows = [...categoryTotals]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .map((item) => [
      categoriesMap[item.categoryId]?.name || item.categoryId || "Other",
      money(item.value),
    ]);

  if (categoryRows.length > 0) {
    cursorY += 18;
    autoTable(doc, {
      startY: cursorY,
      head: [["Category", "Spent"]],
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
    shortDate(expense.inclusionDate),
    money(expense.value),
    categoriesMap[expense.categoryId]?.name || expense.categoryId || "—",
    expense.method || "—",
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["Name", "Date", "Amount", "Category", "Method"]],
    body:
      expenseRows.length > 0
        ? expenseRows
        : [["No expenses in this period", "", "", "", ""]],
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
      `Generated ${new Date().toLocaleString()} · MyWallet Pro`,
      marginX,
      doc.internal.pageSize.getHeight() - 24
    );
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 24,
      { align: "right" }
    );
  }

  const safeStem = String(fileStem || "mywallet-expenses").replace(
    /[^\w.-]+/g,
    "-"
  );
  doc.save(`${safeStem}.pdf`);
}
