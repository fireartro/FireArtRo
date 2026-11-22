import { useEffect, useState } from "react";

export const COOKIE_CONSENT_STORAGE_KEY = "fireartro-cookie-consent-v1";
export const COOKIE_CONSENT_VERSION = 2;
export const OPEN_COOKIE_SETTINGS_EVENT = "fireartro-open-cookie-settings";
export const COOKIE_CONSENT_UPDATED_EVENT = "fireartro-cookie-consent-updated";
export const NECESSARY_ONLY = Object.freeze({ necessary: true, analytics: false, marketing: false });

const DAY = 86_400_000;
const MAX_DAYS = 730;
let temporaryRefusal = null;

export function consentRetentionDays(days) {
  return Number.isInteger(days) && days >= 1 && days <= MAX_DAYS ? days : 180;
}

function validateChoice(choice) {
  if (choice?.version !== COOKIE_CONSENT_VERSION || choice.necessary !== true
      || typeof choice.analytics !== "boolean" || typeof choice.marketing !== "boolean"
      || typeof choice.savedAt !== "string" || typeof choice.expiresAt !== "string") return null;
  const saved = Date.parse(choice.savedAt);
  const expires = Date.parse(choice.expiresAt);
  const now = Date.now();
  return saved <= now && expires > now && expires - saved <= MAX_DAYS * DAY ? choice : null;
}

export function readCookieConsent() {
  if (typeof window === "undefined") return null;
  if (temporaryRefusal) return validateChoice(temporaryRefusal);
  try {
    return validateChoice(JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)));
  } catch {
    return null;
  }
}

export function saveCookieConsent(choice, days) {
  const now = Date.now();
  const stored = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: choice.analytics === true,
    marketing: choice.marketing === true,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + consentRetentionDays(days) * DAY).toISOString(),
  };
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
    temporaryRefusal = null;
  } catch {
    // Keep the current page usable, with optional integrations off. An old
    // persisted grant must not be used after this visit's refusal.
    temporaryRefusal = { ...stored, ...NECESSARY_ONLY };
    try { window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY); } catch { /* Storage is unavailable. */ }
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_UPDATED_EVENT));
  return !temporaryRefusal;
}

export function subscribeCookieConsent(onChange) {
  let timer;
  const sync = () => {
    window.clearTimeout(timer);
    const choice = readCookieConsent();
    if (choice) timer = window.setTimeout(sync, Math.min(Date.parse(choice.expiresAt) - Date.now() + 1, DAY));
    onChange(choice);
  };
  const onStorage = (event) => {
    if (event.key === COOKIE_CONSENT_STORAGE_KEY || event.key === null) sync();
  };
  const events = [COOKIE_CONSENT_UPDATED_EVENT, "focus", "pageshow"];
  events.forEach(event => window.addEventListener(event, sync));
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("storage", onStorage);
  sync();
  return () => {
    window.clearTimeout(timer);
    events.forEach(event => window.removeEventListener(event, sync));
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCookieConsent() {
  const [choice, setChoice] = useState(null);
  useEffect(() => subscribeCookieConsent(next => {
    setChoice(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }), []);
  return choice;
}
