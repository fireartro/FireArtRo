import { useEffect, useRef } from "react";
import "@/styles/facebook-review-frame.css";

const WIDGET_ORIGIN = "https://5cd3630c2af747e78e24cbbda99bf22a.elf.site";

export default function FacebookReviewFrame() {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const frame = frameRef.current;

    function restoreInline() {
      if (!dialog.open) return;
      dialog.close();
      dialog.setAttribute("role", "presentation");
    }

    function syncDialog(event) {
      if (event.origin !== WIDGET_ORIGIN || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (message?.type !== "fireart:review-dialog" || typeof message.open !== "boolean") return;
      if (!message.open) {
        restoreInline();
      } else if (!dialog.open && typeof dialog.showModal === "function") {
        // Promote the same iframe so the review and the provider's keyboard focus survive.
        dialog.removeAttribute("role");
        dialog.showModal();
        if (document.activeElement !== frame) frame.focus({ preventScroll: true });
      }
    }

    function cancelDialog(event) {
      event.preventDefault();
      frame.contentWindow?.postMessage({ type: "fireart:close-review-dialog" }, WIDGET_ORIGIN);
      restoreInline();
    }

    window.addEventListener("message", syncDialog);
    dialog.addEventListener("cancel", cancelDialog);
    frame.addEventListener("load", restoreInline);
    return () => {
      window.removeEventListener("message", syncDialog);
      dialog.removeEventListener("cancel", cancelDialog);
      frame.removeEventListener("load", restoreInline);
      restoreInline();
    };
  }, []);

  return (
    <div className="nr-shell fa-review-frame-slot">
      <dialog ref={dialogRef} className="fa-review-dialog" role="presentation" aria-label="Recenzii Facebook">
        <iframe
          ref={frameRef}
          className="fa-page-reviews__widget"
          title="Recenzii FireArtRo de pe Facebook"
          src={WIDGET_ORIGIN}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </dialog>
    </div>
  );
}
