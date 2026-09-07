import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  COOKIE_CONSENT_UPDATED_EVENT,
  readCookieConsent,
} from "./CookieConsent";


const SCRIPT_ID = "fireartro-ga4-script";
const CANONICAL_HOSTNAME = "fireart.ro";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

function analyticsAllowedByConsent() {
  const value = readCookieConsent();
  if (!value?.analytics) return false;
  if (!value.expiresAt) return true;
  return new Date(value.expiresAt).getTime() > Date.now();
}

function ensureGtag(measurementId) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
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
  const configured = MEASUREMENT_ID_PATTERN.test(measurementId);
  const isProduction = production ?? window.location.hostname === CANONICAL_HOSTNAME;
  const eligible = configured && isProduction && location.pathname !== "/admin";
  const [allowed, setAllowed] = useState(() => eligible && analyticsAllowedByConsent());
  const initialized = useRef(false);
  const lastPagePath = useRef("");
  const pagePath = useMemo(() => location.pathname || "/", [location.pathname]);

  useEffect(() => {
    const onConsent = (event) => {
      const nextAllowed = eligible && event.detail?.analytics === true;
      window[`ga-disable-${measurementId}`] = !nextAllowed;
      if (!nextAllowed && initialized.current && window.gtag) {
        window.gtag("consent", "update", consentState(false));
      }
      setAllowed(nextAllowed);
      if (!nextAllowed) lastPagePath.current = "";
    };
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
  }, [eligible, measurementId]);

  useEffect(() => {
    if (!eligible || !allowed) {
      if (configured) window[`ga-disable-${measurementId}`] = true;
      return;
    }

    window[`ga-disable-${measurementId}`] = false;
    ensureGtag(measurementId);
    if (!initialized.current) {
      window.gtag("consent", "default", consentState(true));
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      initialized.current = true;
    } else {
      window.gtag("consent", "update", consentState(true));
    }
  }, [allowed, configured, eligible, measurementId]);

  useEffect(() => () => {
    window[`ga-disable-${measurementId}`] = true;
  }, [measurementId]);

  useEffect(() => {
    if (!eligible || !allowed || !initialized.current || lastPagePath.current === pagePath) return;
    lastPagePath.current = pagePath;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title,
    });
  }, [allowed, eligible, pagePath]);

  return null;
}
