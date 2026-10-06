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

function displayName(item) {
  const base = item.description || "—";
  const total = Number(item.installments) || 1;
  const number = Number(item.installmentNumber) || 1;
  if (total > 1) {
    return `${base} · ${number}/${total}`;
  }
  return base;
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch("/apple-touch-icon-180.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Build and download a client-facing PDF of amounts due
 * (name, expected date, amount + total).
 */
export async function downloadPendingIncomesPdf({
  incomes = [],
  periodLabel = "All periods",
  fileStem = "mywallet-payment-due",
} = {}) {
  const rows = [...incomes].sort((a, b) =>
    String(a.expectedDate || "").localeCompare(String(b.expectedDate || ""))
  );
  const total = rows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const logoDataUrl = await loadLogoDataUrl();

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let cursorY = 48;
  let textX = marginX;

  if (logoDataUrl) {
    const logoSize = 28;
    doc.addImage(logoDataUrl, "PNG", marginX, cursorY - 20, logoSize, logoSize);
    textX = marginX + logoSize + 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(11, 18, 32);
  doc.text("MyWallet", textX, cursorY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(113, 113, 122);
  doc.text("Payment due", textX, cursorY + 18);

  cursorY += 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 18, 32);
  doc.text(String(periodLabel), marginX, cursorY);

  cursorY += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total due: ${money(total)}`, marginX, cursorY);
  doc.text(`Items: ${rows.length}`, marginX + 220, cursorY);

  cursorY += 18;

  const bodyRows = rows.map((item) => [
    displayName(item),
    shortDate(item.expectedDate),
    money(item.amount),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["Name", "Expected date", "Amount"]],
    body:
      bodyRows.length > 0
        ? bodyRows
        : [["No amounts due in this period", "", ""]],
    foot: [
      [
        { content: "Total due", styles: { fontStyle: "bold" } },
        "",
        {
          content: money(total),
          styles: { halign: "right", fontStyle: "bold" },
        },
      ],
    ],
    showFoot: "lastPage",
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
      textColor: [15, 23, 42],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [62, 146, 235],
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 280 },
      1: { cellWidth: 110 },
      2: { halign: "right", cellWidth: 90 },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated ${new Date().toLocaleString()} · MyWallet`,
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

  const safeStem = String(fileStem || "mywallet-payment-due").replace(
    /[^\w.-]+/g,
    "-"
  );
  doc.save(`${safeStem}.pdf`);
}
