/**
 * Deliver a jsPDF as a reviewable preview first (like the old iOS Quick Look flow).
 * Share is opt-in from the preview and sends only the File — no blob: URL / caption.
 * Desktop (no file share) keeps a normal download.
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

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    (() => {
      try {
        return navigator.canShare({ files: [file] });
      } catch {
        return false;
      }
    })();

  // Desktop / unsupported: classic download (opens system preview where available).
  if (!canShareFiles) {
    doc.save(finalName);
    return { shared: false };
  }

  return openPdfPreview({ file, blob, finalName });
}

function openPdfPreview({ file, blob, finalName }) {
  const isPt = String(navigator.language || "")
    .toLowerCase()
    .startsWith("pt");
  const labels = {
    share: isPt ? "Compartilhar" : "Share",
    close: isPt ? "Fechar" : "Close",
    title: finalName,
  };

  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", labels.title);
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "100000",
      display: "flex",
      flexDirection: "column",
      background: "#0b1220",
      color: "#f8fafc",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "12px 14px",
      paddingTop: "max(12px, env(safe-area-inset-top))",
      borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
      background: "rgba(15, 23, 42, 0.96)",
    });

    const title = document.createElement("p");
    title.textContent = labels.title;
    Object.assign(title.style, {
      margin: "0",
      fontSize: "14px",
      fontWeight: "600",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      flex: "1",
      minWidth: "0",
    });

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      display: "flex",
      gap: "8px",
      flexShrink: "0",
    });

    const makeBtn = (text, { primary = false } = {}) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      Object.assign(btn.style, {
        border: primary ? "none" : "1px solid rgba(148, 163, 184, 0.45)",
        background: primary ? "#3e92eb" : "transparent",
        color: "#fff",
        borderRadius: "999px",
        padding: "8px 14px",
        fontSize: "13px",
        fontWeight: "700",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      });
      return btn;
    };

    const shareBtn = makeBtn(labels.share, { primary: true });
    const closeBtn = makeBtn(labels.close);

    const frame = document.createElement("iframe");
    frame.title = labels.title;
    frame.src = objectUrl;
    Object.assign(frame.style, {
      flex: "1",
      width: "100%",
      border: "none",
      background: "#fff",
    });

    const cleanup = (result) => {
      window.removeEventListener("keydown", onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const onKey = (event) => {
      if (event.key === "Escape") cleanup({ shared: false });
    };

    shareBtn.addEventListener("click", async () => {
      shareBtn.disabled = true;
      try {
        // files only — no url/text (avoids blob: caption in WhatsApp).
        await navigator.share({ files: [file] });
        cleanup({ shared: true });
      } catch (error) {
        shareBtn.disabled = false;
        if (error?.name === "AbortError") return;
      }
    });

    closeBtn.addEventListener("click", () => cleanup({ shared: false }));
    window.addEventListener("keydown", onKey);

    actions.append(shareBtn, closeBtn);
    header.append(title, actions);
    overlay.append(header, frame);
    document.body.appendChild(overlay);
  });
}
