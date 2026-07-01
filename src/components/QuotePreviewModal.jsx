import { useState, useRef } from "react";
import { Printer, Loader2 } from "lucide-react";
import Modal from "./Modal";
import QuotePreview from "./QuotePreview";

// View-only modal: shows the rendered quote preview with a Save as PDF
// action only. Used by the "Quote" header button and the Documents card —
// neither of those should let the user edit or resend.
const QuotePreviewModal = ({ quote, fileName, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { createRoot } = await import("react-dom/client");
      const { flushSync } = await import("react-dom");

      // 1. Create a temporary container directly on body
      let printContainer = document.getElementById("quote-print-temp-container");
      if (!printContainer) {
        printContainer = document.createElement("div");
        printContainer.id = "quote-print-temp-container";
        document.body.appendChild(printContainer);
      }

      // 2. Render QuotePreview into the temporary container
      const root = createRoot(printContainer);
      flushSync(() => {
        root.render(<QuotePreview quote={quote} />);
      });

      // 3. Set printing class on body to isolate the container and hide the rest
      document.body.classList.add("printing-quote-mode");

      // 4. Set up safe, once-callable cleanup after print dialog closes
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        
        try {
          document.body.classList.remove("printing-quote-mode");
        } catch (e) {}
        try {
          window.removeEventListener("afterprint", cleanup);
        } catch (e) {}
        try {
          root.unmount();
        } catch (e) {}
        try {
          printContainer.remove();
        } catch (e) {}
      };

      // Register listener BEFORE triggering print dialog to avoid race conditions
      window.addEventListener("afterprint", cleanup);

      // 5. Trigger print
      window.print();

      // 6. Synchronous fallback: run cleanup immediately after print dialog returns (blocking call)
      cleanup();
    } catch (err) {
      console.error("[QuotePreviewModal] print failed, falling back to basic print:", err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const footer = (
    <div className="flex justify-end items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={downloading}
        className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-bg-soft transition-all disabled:opacity-50"
      >
        Close
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading || !quote}
        className="min-w-[160px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg bg-select-blue text-white text-sm font-medium hover:bg-primary shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Preparing…
          </>
        ) : (
          <>
            <Printer size={14} /> Save as PDF
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      title={`Quote ${quote?.quoteId || ""}`.trim()}
      subtitle={
        quote?.sentAt
          ? `Sent on ${new Date(quote.sentAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          : "Quote preview"
      }
      onClose={downloading ? undefined : onClose}
      footer={footer}
      maxWidth="max-w-[760px]"
    >
      <div ref={previewRef} className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {quote ? (
          <QuotePreview quote={quote} />
        ) : (
          <p className="text-center text-text-muted text-sm py-10">
            No quote available to preview.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default QuotePreviewModal;
