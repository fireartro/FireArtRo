import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import { useEffect, useRef, useState } from "react";
import { Cookie, Settings2, X } from "lucide-react";

import useManagedContent from "@/hooks/useManagedContent";

export const COOKIE_CONSENT_STORAGE_KEY = "fireartro-cookie-consent-v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "fireartro-open-cookie-settings";

const defaultChoice = {
  necessary: true,
  analytics: false,
  marketing: false,
};

const readConsent = () => {
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
  window.dispatchEvent(new CustomEvent("fireartro-cookie-consent-updated", { detail: payload }));
  return payload;
};

export default function CookieConsent() {
  const settings = useManagedContent("cookieSettings", CMS_DEFAULTS.cookieSettings);
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choice, setChoice] = useState(defaultChoice);
  const firstButtonRef = useRef(null);

  useEffect(() => {
    const stored = readConsent();
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
      const current = readConsent();
      if (current) setChoice({ necessary: true, analytics: !!current.analytics, marketing: !!current.marketing });
      setCustomizing(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (!visible) return;
    firstButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && readConsent()) setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, customizing]);

  const save = (nextChoice) => {
    persistConsent(nextChoice, settings.retentionDays || 180);
    setChoice(nextChoice);
    setVisible(false);
    setCustomizing(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent-layer" data-testid="cookie-consent">
      <section
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
          {readConsent() && (
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
    </div>
  );
}
