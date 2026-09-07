import { useEffect, useRef } from "react";


const SCRIPT_ID = "fireartro-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);

  let script = document.getElementById(SCRIPT_ID);
  if (!script) {
    script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  return new Promise((resolve, reject) => {
    const loaded = () => window.turnstile?.render
      ? resolve(window.turnstile)
      : reject(new Error("Turnstile unavailable"));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile unavailable")), { once: true });
  });
}

export default function TurnstileWidget({ onToken, onUnavailable, resetSignal = 0 }) {
  const siteKey = (process.env.REACT_APP_TURNSTILE_SITE_KEY || "").trim();
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacks = useRef({ onToken, onUnavailable });
  callbacks.current = { onToken, onUnavailable };

  useEffect(() => {
    if (!siteKey) return undefined;
    let active = true;
    let api = null;

    loadTurnstile().then((loadedApi) => {
      if (!active || !containerRef.current) return;
      api = loadedApi;
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        appearance: "interaction-only",
        callback: (token) => {
          callbacks.current.onUnavailable?.("");
          callbacks.current.onToken?.(token);
        },
        "expired-callback": () => {
          callbacks.current.onToken?.("");
          callbacks.current.onUnavailable?.("Verificarea anti-abuz a expirat. Încearcă din nou.");
        },
        "error-callback": () => {
          callbacks.current.onToken?.("");
          callbacks.current.onUnavailable?.("Verificarea anti-abuz nu este disponibilă momentan.");
        },
      });
    }).catch(() => {
      if (active) callbacks.current.onUnavailable?.(
        "Verificarea anti-abuz nu este disponibilă momentan.",
      );
    });

    return () => {
      active = false;
      if (api?.remove && widgetIdRef.current !== null) {
        api.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (siteKey && window.turnstile?.reset && widgetIdRef.current !== null) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal, siteKey]);

  if (!siteKey) return null;

  return (
    <div
      id="quote-turnstile"
      className="nr-contact-turnstile"
      role="group"
      aria-label="Verificare anti-abuz"
      aria-describedby="quote-turnstile-error"
      tabIndex="-1"
    >
      <div ref={containerRef} />
    </div>
  );
}
