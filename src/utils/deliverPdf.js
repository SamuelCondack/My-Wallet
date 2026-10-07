/**
 * Save/open the PDF the classic way (native iOS Quick Look / browser download).
 */
export async function deliverPdf(doc, filename) {
  const safeName = String(filename || "document.pdf").replace(
    /[^\w.-]+/g,
    "-"
  );
  const finalName = safeName.toLowerCase().endsWith(".pdf")
    ? safeName
    : `${safeName}.pdf`;

  doc.save(finalName);
  return { shared: false };
}
