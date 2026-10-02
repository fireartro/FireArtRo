import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cookie, Settings2, X } from "lucide-react";

import useManagedContent from "@/hooks/useManagedContent";

export const COOKIE_CONSENT_STORAGE_KEY = "fireartro-cookie-consent-v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "fireartro-open-cookie-settings";
export const COOKIE_CONSENT_UPDATED_EVENT = "fireartro-cookie-consent-updated";

const defaultChoice = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const readCookieConsent = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || "null");
    if (!value?.savedAt) return null;
    return value;
  } catch {
    return null;
  }
};

const persistConsent = (choice, retentionDays) => {
  const payload = {
    ...choice,
    necessary: true,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + retentionDays * 86_400_000).toISOString(),
  };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: payload }));
  return payload;
};

export default function CookieConsent() {
  const settings = useManagedContent("cookieSettings", CMS_DEFAULTS.cookieSettings);
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choice, setChoice] = useState(defaultChoice);
  const firstButtonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const stored = readCookieConsent();
    const expired = stored?.expiresAt && new Date(stored.expiresAt).getTime() <= Date.now();
    if (!stored || expired) {
      if (expired) window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
      setVisible(true);
    } else {
      setChoice({
        necessary: true,
        analytics: Boolean(stored.analytics),
        marketing: Boolean(stored.marketing),
      });
    }

    const openSettings = () => {
      const current = readCookieConsent();
      if (current) setChoice({ necessary: true, analytics: !!current.analytics, marketing: !!current.marketing });
      setCustomizing(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (!visible) return;
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
      if (event.key === "Escape" && readCookieConsent()) setVisible(false);
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
  }, [visible]);

  const save = (nextChoice) => {
    persistConsent(nextChoice, settings.retentionDays || 180);
    setChoice(nextChoice);
    setVisible(false);
    setCustomizing(false);
  };

  if (!visible) return null;

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
            <p id="cookie-consent-summary">{settings.summary}</p>
          </div>
          {readCookieConsent() && (
            <button type="button" onClick={() => setVisible(false)} aria-label="Închide setările cookies">
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
                checked={choice.marketing}
                onChange={(event) => setChoice((current) => ({ ...current, marketing: event.target.checked }))}
              />
            </label>
          </div>
        )}

        <div className="cookie-consent-links">
          <a href="/cookies">Citește politica de cookies</a>
          <span>Preferința este păstrată {settings.retentionDays || 180} zile.</span>
        </div>

        <div className="cookie-consent-actions">
          {customizing ? (
            <>
              <button ref={firstButtonRef} type="button" className="is-secondary" onClick={() => save(defaultChoice)}>
                Doar necesare
              </button>
              <button type="button" className="is-primary" onClick={() => save(choice)}>
                Salvează preferințele
              </button>
            </>
          ) : (
            <>
              <button ref={firstButtonRef} type="button" className="is-secondary" onClick={() => save(defaultChoice)}>
                Doar necesare
              </button>
              <button type="button" className="is-secondary" onClick={() => setCustomizing(true)}>
                <Settings2 /> Personalizează
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => save({ necessary: true, analytics: true, marketing: true })}
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
