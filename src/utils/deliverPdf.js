/**
 * Hand off a jsPDF doc as a real file when the OS supports it (iOS/Android share).
 * Avoids blob: URLs that WhatsApp/iOS attach as a link alongside the PDF.
 * Falls back to a normal download when share is unavailable or fails.
 */
export async function deliverPdf(doc, filename) {
  const safeName = String(filename || "document.pdf").replace(
    /[^\w.-]+/g,
    "-"
  );
  const finalName = safeName.toLowerCase().endsWith(".pdf")
    ? safeName
    : `${safeName}.pdf`;

  const blob = doc.output("blob");
  const file = new File([blob], finalName, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function"
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        // files only — no url/text/title (those become a link/caption in WhatsApp).
        await navigator.share({ files: [file] });
        return { shared: true };
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return { shared: false, aborted: true };
      }
      // Fall through to download.
    }
  }

  doc.save(finalName);
  return { shared: false };
}
