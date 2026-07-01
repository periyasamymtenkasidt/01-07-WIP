import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas-pro";
import QuotePreview from "../components/QuotePreview";

/**
 * Capture a quote preview as a PNG image and trigger browser download.
 * 
 * Works in two modes:
 * 1. If `element` is provided (e.g., from the active QuotePreviewModal), it captures
 *    the already-rendered DOM node.
 * 2. If `element` is omitted (e.g., from the Documents list card), it dynamically
 *    renders the quote in an offscreen container, captures it, and cleans up.
 * 
 * Uses `html2canvas-pro` to support Tailwind CSS v4's oklch/oklab color formats.
 */
export async function downloadQuoteAsImage(quote, fileName, element) {
  let targetElement = element;
  let printContainer = null;
  let root = null;

  try {
    // 1. Offscreen rendering fallback when no DOM element is passed
    if (!targetElement) {
      if (!quote) return;
      printContainer = document.createElement("div");
      printContainer.id = "quote-download-temp-container";
      
      Object.assign(printContainer.style, {
        position: "absolute",
        left: "-10000px",
        top: "0",
        width: "800px",
        padding: "32px",
        background: "#ffffff",
        zIndex: "-9999",
      });
      document.body.appendChild(printContainer);

      root = createRoot(printContainer);
      flushSync(() => {
        root.render(<QuotePreview quote={quote} />);
      });
      targetElement = printContainer;
    }

    // 2. Wait for images (logo, etc.) to load completely
    const images = targetElement.querySelectorAll("img");
    if (images.length) {
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve();
              img.onload = resolve;
              img.onerror = resolve;
            }),
        ),
      );
    }

    // 3. Settle time for layout and fonts
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Temporarily lift overflow constraints if capturing an active modal element
    let scrollParent = null;
    let savedOverflow = "";
    let savedMaxHeight = "";
    if (element) {
      scrollParent = element.closest(".overflow-y-auto, [style*='overflow']");
      if (scrollParent) {
        savedOverflow = scrollParent.style.overflow;
        savedMaxHeight = scrollParent.style.maxHeight;
        scrollParent.style.overflow = "visible";
        scrollParent.style.maxHeight = "none";
      }
    }

    // 5. Perform the canvas capture
    const canvas = await html2canvas(targetElement, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    // Restore scroll constraints
    if (scrollParent) {
      scrollParent.style.overflow = savedOverflow;
      scrollParent.style.maxHeight = savedMaxHeight;
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.warn("[downloadQuoteAsImage] html2canvas-pro produced an empty canvas");
      return;
    }

    // 6. Convert to blob and trigger download
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      console.warn("[downloadQuoteAsImage] canvas.toBlob returned null");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName?.replace(/\.pdf$/i, ".png") || `${quote?.quoteId || "quote"}.png`;
    a.style.display = "none";
    document.body.appendChild(a);

    // Defer execution slightly to satisfy browser security contexts
    setTimeout(() => {
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 200);
    }, 0);

  } catch (err) {
    console.error("[downloadQuoteAsImage] download failed:", err);
  } finally {
    // 7. Unmount and clean up offscreen container
    if (root) {
      try {
        root.unmount();
      } catch (e) {}
    }
    if (printContainer) {
      try {
        printContainer.remove();
      } catch (e) {}
    }
  }
}
