import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ANALYTICS_EVENT, contactChannel, pagePathForAnalytics, referrerForAnalytics } from "@/lib/analytics";

import {
  COOKIE_CONSENT_UPDATED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  readCookieConsent,
} from "./CookieConsent";


const SCRIPT_ID = "fireartro-ga4-script";
const CANONICAL_HOSTNAME = "fireart.ro";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const TAG_ID_PATTERN = /^(?:G|GT)-[A-Z0-9]+$/;

function analyticsAllowedByConsent(value = readCookieConsent()) {
  if (!value?.analytics) return false;
  if (!value.expiresAt) return true;
  return new Date(value.expiresAt).getTime() > Date.now();
}

function clearAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ['', host, ...(host === 'fireart.ro' || host.endsWith('.fireart.ro') ? ['fireart.ro', '.fireart.ro'] : [])];
  for (const entry of document.cookie.split(';')) {
    const name = entry.trim().split('=')[0];
    if (!/^_ga(?:_[A-Za-z0-9_-]+)?$/.test(name)) continue;
    for (const domain of new Set(domains)) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

function ensureGtag(bootstrapTagId) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(bootstrapTagId)}`;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    document.head.appendChild(script);
  }
}

function consentState(analytics) {
  return {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: analytics ? "granted" : "denied",
  };
}

export default function AnalyticsLoader({ production }) {
  const location = useLocation();
  const measurementId = (process.env.REACT_APP_GA_MEASUREMENT_ID || "").trim();
  const bootstrapTagId = (process.env.REACT_APP_GA_TAG_ID || "").trim() || measurementId;
  const configured = MEASUREMENT_ID_PATTERN.test(measurementId) && TAG_ID_PATTERN.test(bootstrapTagId);
  const isProduction = production ?? (typeof window !== "undefined" && window.location.hostname === CANONICAL_HOSTNAME);
  const pagePath = useMemo(() => pagePathForAnalytics(location.pathname), [location.pathname]);
  const eligible = configured && isProduction && Boolean(pagePath);
  const [allowed, setAllowed] = useState(() => eligible && analyticsAllowedByConsent());
  const currentChoice = useRef(readCookieConsent());
  const allowedNow = useRef(allowed);
  const initialized = useRef(false);
  const lastPagePath = useRef("");

  useEffect(() => {
    let expiryTimer;
    const sync = (choice = readCookieConsent()) => {
      window.clearTimeout(expiryTimer);
      const nextAllowed = eligible && analyticsAllowedByConsent(choice);
      currentChoice.current = choice;
      allowedNow.current = nextAllowed;
      // A routing tag may also identify a different GA stream. Keep that
      // stream disabled before Google loads; consent controls our destination.
      if (TAG_ID_PATTERN.test(bootstrapTagId) && bootstrapTagId !== measurementId) {
        window[`ga-disable-${bootstrapTagId}`] = true;
      }
      window[`ga-disable-${measurementId}`] = !nextAllowed;
      if (!nextAllowed && initialized.current && window.gtag) {
        window.gtag("consent", "update", consentState(false));
      }
      setAllowed(nextAllowed);
      if (!nextAllowed) {
        lastPagePath.current = "";
        clearAnalyticsCookies();
      } else if (choice?.expiresAt) {
        // Cap long waits to avoid the browser's signed 32-bit timer overflow.
        expiryTimer = window.setTimeout(() => sync(choice), Math.min(Date.parse(choice.expiresAt) - Date.now(), 86_400_000));
      }
    };
    const onConsent = (event) => sync(event.detail);
    const onStorage = (event) => {
      if (event.key === COOKIE_CONSENT_STORAGE_KEY || event.key === null) sync();
    };
    const onFocus = () => sync();
    sync();
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(expiryTimer);
      window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [bootstrapTagId, eligible, measurementId]);

  useEffect(() => {
    if (!eligible || !allowed) {
      if (configured) window[`ga-disable-${measurementId}`] = true;
      return;
    }

    window[`ga-disable-${measurementId}`] = false;
    ensureGtag(bootstrapTagId);
    if (!initialized.current) {
      window.gtag("consent", "default", consentState(true));
      window.gtag("js", new Date());
      // Configure the loaded tag. A destination-only ID can otherwise trigger
      // a second, unavailable script; explicit events select the GA4 destination.
      window.gtag("config", bootstrapTagId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: `https://${CANONICAL_HOSTNAME}${pagePath}`,
        page_referrer: referrerForAnalytics(document.referrer),
      });
      initialized.current = true;
    } else {
      window.gtag("consent", "update", consentState(true));
    }
  }, [allowed, bootstrapTagId, configured, eligible, measurementId, pagePath]);

  useEffect(() => () => {
    window[`ga-disable-${measurementId}`] = true;
  }, [measurementId]);

  useEffect(() => {
    if (!eligible || !allowed || !initialized.current || lastPagePath.current === pagePath) return;
    lastPagePath.current = pagePath;
    // Set safe defaults for events generated by the measurement provider.
    // Otherwise gtag can fall back to the full document URL, including query data.
    const pageLocation = `https://${CANONICAL_HOSTNAME}${pagePath}`;
    const pageReferrer = referrerForAnalytics(document.referrer);
    window.gtag("set", "page_location", pageLocation);
    window.gtag("set", "page_referrer", pageReferrer);
    window.gtag("event", "page_view", {
      send_to: measurementId,
      page_path: pagePath,
      page_location: pageLocation,
      page_referrer: pageReferrer,
      page_title: document.title,
    });
  }, [allowed, eligible, measurementId, pagePath]);

  useEffect(() => {
    if (!eligible || !allowed || !initialized.current) return undefined;
    const send = (name, parameters) => {
      if (!allowedNow.current || !analyticsAllowedByConsent(currentChoice.current)
          || window[`ga-disable-${measurementId}`] || typeof window.gtag !== "function") return;
      // Event scope overrides the landing page's config scope after SPA navigation.
      try { window.gtag("event", name, {
        ...parameters,
        send_to: measurementId,
        page_location: `https://${CANONICAL_HOSTNAME}${pagePath}`,
        page_referrer: referrerForAnalytics(document.referrer),
      }); }
      catch { /* A measurement provider must never interrupt a contact action. */ }
    };
    const onClick = event => {
      if (event.button != null && event.button !== 0) return;
      const anchor = event.target?.closest?.("a[href]");
      const channel = anchor ? contactChannel(anchor.getAttribute("href")) : null;
      if (channel) send("contact_click", { channel });
    };
    const onAccepted = event => {
      // Never forward arbitrary fields supplied with a browser event.
      if (event.detail?.name === "generate_lead") send("generate_lead", { method: "quote_form" });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(ANALYTICS_EVENT, onAccepted);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(ANALYTICS_EVENT, onAccepted);
    };
  }, [allowed, eligible, measurementId, pagePath]);

  return null;
}
