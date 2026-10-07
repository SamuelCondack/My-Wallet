import { jsPDF } from "jspdf";
import { createTranslator } from "../i18n/translate";
import { deliverPdf } from "./deliverPdf";

const defaultT = createTranslator("en");

function money(value, locale = "en-US") {
  return Number(value || 0).toLocaleString(locale, {
    style: "currency",
    currency: "USD",
  });
}

function shortDate(value, locale = "en-US", { includeYear = true } = {}) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  if (!year || !month) return String(value);
  const d = day || "01";
  if (String(locale).toLowerCase().startsWith("pt")) {
    return includeYear ? `${d}/${month}/${year}` : `${d}/${month}`;
  }
  return includeYear ? `${month}/${d}/${year}` : `${month}/${d}`;
}

/** incomePeriod is YYYY-MM — show month only when year is already in the header. */
function periodMonthLabel(period, locale = "en-US") {
  if (!period || !String(period).includes("-")) return "";
  const [, month] = String(period).split("-");
  if (!month) return "";
  return new Date(2000, Number(month) - 1, 1).toLocaleString(locale, {
    month: "short",
  });
}

/**
 * Day the deal closed / card was charged (beside the name, no year — header has it).
 * Uses occurrenceDate; falls back to period month for older records.
 */
function registrationLabel(item, locale = "en-US") {
  const occurrence = item.occurrenceDate;
  if (occurrence && /^\d{4}-\d{2}-\d{2}$/.test(String(occurrence))) {
    return shortDate(occurrence, locale, { includeYear: false });
  }
  return periodMonthLabel(item.incomePeriod, locale);
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
    const response = await fetch("/favicon.png");
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

function drawHairline(doc, x1, y, x2, color = [226, 232, 240]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.8);
  doc.line(x1, y, x2, y);
}

function ensureSpace(doc, cursorY, needed, pageWidth, pageHeight, marginX, marginBottom) {
  if (cursorY + needed <= pageHeight - marginBottom) {
    return cursorY;
  }
  doc.addPage([pageWidth, pageHeight]);
  return 40;
}

/**
 * Mobile-first payment-due PDF (narrow page, large type, stacked rows).
 * Designed to be readable in WhatsApp on a phone without pinch-zoom.
 *
 * Optional `t` (translate function from useT()) and `locale` (e.g. "pt-BR")
 * localize all PDF strings. Defaults to English.
 */
export async function downloadPendingIncomesPdf({
  incomes = [],
  periodLabel,
  fileStem = "mywallet-payment-due",
  t = defaultT,
  locale = "en-US",
} = {}) {
  const chargeKey = (item) =>
    String(item.occurrenceDate || item.expectedDate || "");
  // Newest charge first, oldest last; same charge → installment order.
  const rows = [...incomes].sort((a, b) => {
    const byCharge = chargeKey(b).localeCompare(chargeKey(a));
    if (byCharge !== 0) return byCharge;
    return (
      (Number(a.installmentNumber) || 1) - (Number(b.installmentNumber) || 1)
    );
  });
  const total = rows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const logoDataUrl = await loadLogoDataUrl();
  const formatMoney = (value) => money(value, locale);

  // Narrow portrait ≈ phone content width so WhatsApp fit-to-width keeps type large.
  const pageWidth = 420;
  const pageHeight = 747;
  const marginX = 28;
  const marginBottom = 48;
  const contentRight = pageWidth - marginX;
  const contentWidth = contentRight - marginX;

  const doc = new jsPDF({
    unit: "pt",
    format: [pageWidth, pageHeight],
    compress: true,
  });

  let cursorY = 36;

  // Header
  let textX = marginX;
  if (logoDataUrl) {
    const logoSize = 32;
    doc.addImage(logoDataUrl, "PNG", marginX, cursorY, logoSize, logoSize);
    textX = marginX + logoSize + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(11, 18, 32);
    doc.text("MyWallet", textX, cursorY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(113, 113, 122);
    doc.text(t("export.pdf.paymentDue"), textX, cursorY + 30);
    cursorY += logoSize + 22;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(11, 18, 32);
    doc.text("MyWallet", marginX, cursorY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(113, 113, 122);
    doc.text(t("export.pdf.paymentDue"), marginX, cursorY + 30);
    cursorY += 48;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(11, 18, 32);
  doc.text(
    String(periodLabel || t("export.pdf.allPeriods")),
    marginX,
    cursorY
  );
  cursorY += 10;

  // Hero total card
  cursorY += 14;
  const heroH = 88;
  doc.setFillColor(62, 146, 235);
  doc.roundedRect(marginX, cursorY, contentWidth, heroH, 14, 14, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(t("export.pdf.totalDueCaps"), marginX + 18, cursorY + 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(formatMoney(total), marginX + 18, cursorY + 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    t(rows.length === 1 ? "export.pdf.itemOne" : "export.pdf.itemMany", {
      count: rows.length,
    }),
    contentRight - 18,
    cursorY + 28,
    { align: "right" }
  );

  cursorY += heroH + 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(t("export.pdf.details"), marginX, cursorY);
  cursorY += 12;
  drawHairline(doc, marginX, cursorY, contentRight);
  cursorY += 8;

  if (rows.length === 0) {
    cursorY = ensureSpace(
      doc,
      cursorY,
      40,
      pageWidth,
      pageHeight,
      marginX,
      marginBottom
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(100, 116, 139);
    doc.text(t("export.pdf.noAmountsDue"), marginX, cursorY + 18);
    cursorY += 40;
  } else {
    rows.forEach((item) => {
      const name = displayName(item);
      const amount = formatMoney(item.amount);
      const registerBesideName = registrationLabel(item, locale);
      const expectedLabel = t("export.pdf.expected", {
        date: shortDate(item.expectedDate, locale),
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const amountWidth = doc.getTextWidth(amount) + 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const dateGap = registerBesideName
        ? doc.getTextWidth(`  ${registerBesideName}`)
        : 0;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      const nameMaxWidth = Math.max(
        80,
        contentWidth - amountWidth - dateGap - 8
      );
      const nameLines = doc.splitTextToSize(name, nameMaxWidth);
      const blockH = Math.max(44, 16 + nameLines.length * 16 + 18);

      cursorY = ensureSpace(
        doc,
        cursorY,
        blockH + 8,
        pageWidth,
        pageHeight,
        marginX,
        marginBottom
      );

      const nameY = cursorY + 16;
      doc.setTextColor(15, 23, 42);
      doc.text(nameLines, marginX, nameY);

      if (registerBesideName) {
        const firstLine = nameLines[0] || "";
        const nameWidth = doc.getTextWidth(firstLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`  ${registerBesideName}`, marginX + nameWidth, nameY);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(11, 18, 32);
      doc.text(amount, contentRight, nameY, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(expectedLabel, marginX, nameY + nameLines.length * 16 + 2);

      cursorY += blockH;
      drawHairline(doc, marginX, cursorY, contentRight);
      cursorY += 4;
    });
  }

  // Closing total
  cursorY = ensureSpace(
    doc,
    cursorY,
    56,
    pageWidth,
    pageHeight,
    marginX,
    marginBottom
  );
  cursorY += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(t("export.pdf.totalDue"), marginX, cursorY);
  doc.setFontSize(16);
  doc.text(formatMoney(total), contentRight, cursorY, { align: "right" });

  // Footers on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const h = doc.internal.pageSize.getHeight();
    const w = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(
      t("export.pdf.generated", { date: new Date().toLocaleString(locale) }),
      marginX,
      h - 22
    );
    if (pageCount > 1) {
      doc.text(`${page}/${pageCount}`, w - marginX, h - 22, { align: "right" });
    }
  }

  const safeStem = String(fileStem || "mywallet-payment-due").replace(
    /[^\w.-]+/g,
    "-"
  );
  await deliverPdf(doc, `${safeStem}.pdf`);
}
