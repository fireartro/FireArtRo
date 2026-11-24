import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "@/styles/facebook-review-frame.css";

const WIDGET_ORIGIN = "https://5cd3630c2af747e78e24cbbda99bf22a.elf.site";
const WIDGET_READY_TIMEOUT_MS = 9_000;
const WIDGET_PROBE_INTERVAL_MS = 1_000;

export default function FacebookReviewFrame({ reviewsHref }) {
  const [status, setStatus] = useState("loading");
  const dialogRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const frame = frameRef.current;
    let currentStatus = "loading";
    let timer;
    let probes;

    function restoreInline() {
      if (!dialog.open) return;
      dialog.close();
      dialog.setAttribute("role", "presentation");
    }

    function stopChecks() {
      window.clearTimeout(timer);
      window.clearInterval(probes);
    }

    function waitForReviews() {
      if (currentStatus === "unavailable") return;
      stopChecks();
      currentStatus = "loading";
      setStatus(currentStatus);
      timer = window.setTimeout(() => {
        stopChecks();
        currentStatus = "unavailable";
        setStatus(currentStatus);
      }, WIDGET_READY_TIMEOUT_MS);
    }

    function probeFrame() {
      restoreInline();
      waitForReviews();
      if (currentStatus !== "loading") return;
      const requestReady = () => {
        frame.contentWindow?.postMessage({ type: "fireart:check-review-ready" }, WIDGET_ORIGIN);
      };
      requestReady();
      probes = window.setInterval(requestReady, WIDGET_PROBE_INTERVAL_MS);
    }

    function syncWidget(event) {
      if (event.origin !== WIDGET_ORIGIN || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (message?.type === "fireart:review-ready" && currentStatus === "loading") {
        stopChecks();
        currentStatus = "ready";
        setStatus(currentStatus);
        return;
      }
      if (currentStatus !== "ready") return;
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

    window.addEventListener("message", syncWidget);
    dialog.addEventListener("cancel", cancelDialog);
    frame.addEventListener("load", probeFrame);
    // An iframe load event can also signal a blocked document. Wait for the widget itself.
    waitForReviews();
    return () => {
      stopChecks();
      window.removeEventListener("message", syncWidget);
      dialog.removeEventListener("cancel", cancelDialog);
      frame.removeEventListener("load", probeFrame);
      restoreInline();
    };
  }, []);

  return (
    <div className="nr-shell fa-review-frame-slot" data-widget-state={status}>
      {status !== "ready" && <div className="fa-review-frame-status">
        <p role="status">{status === "loading" ? "Se încarcă recenziile Facebook…" : "Recenziile Facebook nu sunt disponibile aici momentan."}</p>
        <a href={reviewsHref} target="_blank" rel="noopener noreferrer">
          Vezi recenziile pe Facebook <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      </div>}
      {status !== "unavailable" && <dialog ref={dialogRef} className="fa-review-dialog"
        role="presentation" aria-label="Recenzii Facebook" aria-hidden={status === "loading" ? true : undefined}>
        <iframe
          ref={frameRef}
          className="fa-page-reviews__widget"
          title="Recenzii FireArtRo de pe Facebook"
          src={WIDGET_ORIGIN}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </dialog>}
    </div>
  );
}
