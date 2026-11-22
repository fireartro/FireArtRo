import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { currentCookieSettings } from "@/data/businessContent";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cookie, Settings2, X } from "lucide-react";

import { useManagedContentSnapshot } from "@/content/ManagedContentProvider";
import useManagedContent from "@/hooks/useManagedContent";
import {
  consentRetentionDays,
  NECESSARY_ONLY,
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
  useCookieConsent,
  watchConsentWithdrawals,
} from "@/lib/cookieConsent";

export { COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_UPDATED_EVENT, OPEN_COOKIE_SETTINGS_EVENT, readCookieConsent } from "@/lib/cookieConsent";

export default function CookieConsent({ autoPrompt = true }) {
  const settings = currentCookieSettings(useManagedContent("cookieSettings", CMS_DEFAULTS.cookieSettings));
  const publication = useManagedContentSnapshot();
  const retentionDays = consentRetentionDays(settings.retentionDays);
  const stored = useCookieConsent();
  const [introActive, setIntroActive] = useState(() => Boolean(document.documentElement.dataset.fireartIntro));
  const [customizing, setCustomizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [choice, setChoice] = useState(NECESSARY_ONLY);
  const firstButtonRef = useRef(null);
  const panelRef = useRef(null);
  const activeSave = useRef(null);
  const dialogOpen = ready && !introActive && (settingsOpen || (autoPrompt && !stored));

  const closeSettings = () => {
    setSettingsOpen(false);
    setCustomizing(false);
    setFailure(false);
    setCopyStatus("");
  };

  useEffect(watchConsentWithdrawals, []);

  useEffect(() => {
    // Never overlap the startup and cookie modal locks. Restoring an inert
    // attribute captured during the intro would leave the finished site inert.
    const syncIntro = () => setIntroActive(Boolean(document.documentElement.dataset.fireartIntro));
    window.addEventListener("fireart:intro-dismissed", syncIntro);
    syncIntro(); // The intro can finish between the first render and this effect.
    return () => window.removeEventListener("fireart:intro-dismissed", syncIntro);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      setChoice(readCookieConsent() || NECESSARY_ONLY);
      setCustomizing(true);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    setReady(true);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (!activeSave.current) setChoice(stored || NECESSARY_ONLY);
  }, [stored]);

  useEffect(() => {
    if (!dialogOpen) return;
    const opener = document.activeElement;
    const panel = panelRef.current;
    const layer = panel.parentElement;
    const priorInert = new Map();
    const isolateBackground = () => {
      Array.from(document.body.children).forEach((element) => {
        if (element === layer || priorInert.has(element)) return;
        priorInert.set(element, element.getAttribute("inert"));
        element.setAttribute("inert", "");
      });
    };
    isolateBackground();
    const observer = new MutationObserver(isolateBackground);
    observer.observe(document.body, { childList: true });
    firstButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !activeSave.current && (readCookieConsent() || !autoPrompt)) closeSettings();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last) || !panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    const retainFocus = (event) => { if (!panel.contains(event.target)) firstButtonRef.current?.focus(); };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", retainFocus);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", retainFocus);
      observer.disconnect();
      priorInert.forEach((value, element) => {
        if (value === null) element.removeAttribute("inert");
        else element.setAttribute("inert", value);
      });
      if (opener?.isConnected) opener.focus();
    };
  }, [autoPrompt, dialogOpen]);

  const save = async (nextChoice, method = "preferences") => {
    const optional = nextChoice.analytics || nextChoice.marketing;
    if (optional && activeSave.current) return;
    const operation = {};
    activeSave.current = optional ? operation : null;
    setSaving(Boolean(optional));
    setFailure(false);
    if (optional) setSettingsOpen(true);
    const saved = await saveCookieConsent(nextChoice, retentionDays, {
      method,
      contentRevision: publication.status === "ready" ? publication.revisionId : null,
    });
    if (optional && activeSave.current !== operation) return;
    activeSave.current = null;
    setSaving(false);
    if (!saved && optional) {
      setSettingsOpen(true);
      setFailure(true);
      return;
    }
    closeSettings();
  };

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(stored.receiptId);
      setCopyStatus("Codul a fost copiat.");
    } catch {
      setCopyStatus("Poți selecta și copia manual codul afișat.");
    }
  };

  if (!dialogOpen) return null;

  return createPortal(
    <div className="cookie-consent-layer" data-testid="cookie-consent">
      <section
        ref={panelRef}
        className={`cookie-consent-panel ${customizing ? "is-customizing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-summary"
      >
        <header>
          <span><Cookie /></span>
          <div>
            <h2 id="cookie-consent-title">{settings.title}</h2>
            <p id="cookie-consent-summary">{settings.summary} Poți schimba sau retrage alegerea din „Setări cookies”, în subsolul paginii.</p>
          </div>
          {(stored || !autoPrompt) && (
            <button type="button" disabled={saving} onClick={closeSettings} aria-label="Închide setările cookies">
              <X />
            </button>
          )}
        </header>

        {customizing && (
          <div className="cookie-preferences">
            <label>
              <span>
                <strong>{settings.necessaryLabel}</strong>
                <small>{settings.necessaryDescription}</small>
              </span>
              <input type="checkbox" checked disabled aria-label="Cookies strict necesare, active permanent" />
            </label>
            <label>
              <span>
                <strong>{settings.analyticsLabel}</strong>
                <small>{settings.analyticsDescription}</small>
              </span>
              <input
                type="checkbox"
                disabled={saving}
                checked={choice.analytics}
                onChange={(event) => setChoice((current) => ({ ...current, analytics: event.target.checked }))}
              />
            </label>
            <label>
              <span>
                <strong>{settings.marketingLabel}</strong>
                <small>{settings.marketingDescription}</small>
              </span>
              <input
                type="checkbox"
                disabled={saving}
                checked={choice.marketing}
                onChange={(event) => setChoice((current) => ({ ...current, marketing: event.target.checked }))}
              />
            </label>
          </div>
        )}

        {customizing && stored?.receiptId && (
          <div className="cookie-receipt">
            <p>Codul dovezii acordului</p>
            <code>{stored.receiptId}</code>
            <button type="button" onClick={copyReceipt}>Copiază codul</button>
            <span role="status">{copyStatus}</span>
          </div>
        )}
        {saving && <p className="cookie-receipt" role="status">Se salvează dovada acordului…</p>}
        {failure && <p className="cookie-receipt" role="status">Acordul nu a putut fi confirmat. Poți reîncerca sau continua cu „Doar necesare”.</p>}
        <div className="cookie-consent-links">
          <a href="/cookies">Citește politica de cookies</a>
          <span>Preferința este păstrată {retentionDays} zile.</span>
        </div>

        <div className="cookie-consent-actions">
          {customizing ? (
            <>
              <button ref={firstButtonRef} type="button" className="is-secondary" onClick={() => save(NECESSARY_ONLY)}>
                Doar necesare
              </button>
              <button type="button" className="is-primary" disabled={saving} onClick={() => save(choice)}>
                Salvează preferințele
              </button>
            </>
          ) : (
            <>
              <button ref={firstButtonRef} type="button" className="is-primary" onClick={() => save(NECESSARY_ONLY)}>
                Doar necesare
              </button>
              <button type="button" className="is-secondary" disabled={saving} onClick={() => setCustomizing(true)}>
                <Settings2 /> Personalizează
              </button>
              <button
                type="button"
                className="is-primary"
                disabled={saving}
                onClick={() => save({ necessary: true, analytics: true, marketing: true }, "accept_all")}
              >
                Acceptă toate
              </button>
            </>
          )}
        </div>
      </section>
    </div>, document.body,
  );
}
