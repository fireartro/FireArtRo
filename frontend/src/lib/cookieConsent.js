import { useEffect, useState } from "react";

export const COOKIE_CONSENT_STORAGE_KEY = "fireartro-cookie-consent-v1";
export const COOKIE_CONSENT_VERSION = 4;
export const OPEN_COOKIE_SETTINGS_EVENT = "fireartro-open-cookie-settings";
export const COOKIE_CONSENT_UPDATED_EVENT = "fireartro-cookie-consent-updated";
export const NECESSARY_ONLY = Object.freeze({ necessary: true, analytics: false, marketing: false });

const DAY = 86_400_000;
const MAX_DAYS = 730;
const WITHDRAWAL_PREFIX = "fireartro-consent-withdrawal:";
const WITHDRAWN_PREFIX = "fireartro-consent-withdrawn:";
const WITHDRAWAL_WINDOW = 30 * DAY;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pendingWithdrawals = new Map();
const withdrawalsInFlight = new Map();
let temporaryRefusal = null;
const validId = value => typeof value === "string" && UUID_V4.test(value);

function withdrawnLocally(id) {
  if (pendingWithdrawals.has(id)) return true;
  try { return Number(window.localStorage.getItem(WITHDRAWN_PREFIX + id)) > Date.now(); }
  catch { return true; }
}

export function consentRetentionDays(days) {
  return Number.isInteger(days) && days >= 1 && days <= MAX_DAYS ? days : 180;
}

function validateChoice(choice) {
  if (choice?.necessary !== true
      || typeof choice.analytics !== "boolean" || typeof choice.marketing !== "boolean"
      || typeof choice.savedAt !== "string" || typeof choice.expiresAt !== "string") return null;
  const optional = choice.analytics || choice.marketing;
  const validPriorChoice = (choice.version === 2 && !optional) || (choice.version === 3 && !choice.marketing);
  if (choice.version !== COOKIE_CONSENT_VERSION && !validPriorChoice) return null;
  if (optional && (!validId(choice.receiptId) || !validId(choice.withdrawKey) || withdrawnLocally(choice.receiptId))) return null;
  const saved = Date.parse(choice.savedAt);
  const expires = Date.parse(choice.expiresAt);
  const now = Date.now();
  const clockSkew = optional ? 5 * 60_000 : 0;
  return saved <= now + clockSkew && expires > now && expires > saved && expires - saved <= MAX_DAYS * DAY ? choice : null;
}

function readStoredChoice() {
  if (temporaryRefusal) return temporaryRefusal;
  try {
    return JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function readCookieConsent() {
  if (typeof window === "undefined") return null;
  return validateChoice(readStoredChoice());
}

function saveLocally(stored, refusal) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
    temporaryRefusal = null;
  } catch {
    temporaryRefusal = refusal;
    try { window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY); } catch { /* Storage is unavailable. */ }
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_UPDATED_EVENT));
  return !temporaryRefusal;
}

async function postConsent(path, body, keepalive = false) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(path, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      keepalive,
      body: JSON.stringify(body),
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function queueWithdrawal(id, withdrawKey) {
  if (!validId(id) || !validId(withdrawKey) || pendingWithdrawals.has(id)) return;
  const queued = { withdrawKey, queuedAt: Date.now() };
  pendingWithdrawals.set(id, queued);
  try {
    // Keep this marker after the server acknowledges withdrawal. A delayed
    // grant response in a different tab cannot revive a locally ended receipt.
    window.localStorage.setItem(WITHDRAWN_PREFIX + id, String(queued.queuedAt + WITHDRAWAL_WINDOW));
    window.localStorage.setItem(WITHDRAWAL_PREFIX + id, JSON.stringify(queued));
  }
  catch { /* Retry in this tab if the browser does not allow persistent storage. */ }
}

function forgetWithdrawal(id) {
  pendingWithdrawals.delete(id);
  try { window.localStorage.removeItem(WITHDRAWAL_PREFIX + id); }
  catch { /* The API can safely handle a duplicated withdrawal. */ }
}

export async function retryConsentWithdrawals() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(WITHDRAWN_PREFIX) && !(Number(window.localStorage.getItem(key)) > Date.now())) {
        window.localStorage.removeItem(key);
      }
      if (!key.startsWith(WITHDRAWAL_PREFIX)) continue;
      const id = key.slice(WITHDRAWAL_PREFIX.length);
      if (!validId(id)) continue;
      try {
        const queued = JSON.parse(window.localStorage.getItem(key));
        if (queued) pendingWithdrawals.set(id, queued);
      } catch { forgetWithdrawal(id); }
    }
  } catch { /* In-memory retries are still available. */ }

  await Promise.all([...pendingWithdrawals].map(([id, { queuedAt, withdrawKey }]) => {
    if (withdrawalsInFlight.has(id)) return withdrawalsInFlight.get(id);
    if (!validId(withdrawKey) || !Number.isFinite(queuedAt) || queuedAt < Date.now() - WITHDRAWAL_WINDOW) {
      forgetWithdrawal(id);
      return undefined;
    }
    const request = postConsent("/api/consent/withdraw", { id, withdrawKey }, true)
      .then(response => { if (response.status === 204 || response.status === 409) forgetWithdrawal(id); })
      .catch(() => { /* Retry on reconnect or another visit. */ })
      .finally(() => withdrawalsInFlight.delete(id));
    withdrawalsInFlight.set(id, request);
    return request;
  }));
}

export function watchConsentWithdrawals() {
  const events = ["online", "pageshow"];
  events.forEach(event => window.addEventListener(event, retryConsentWithdrawals));
  const timer = window.setInterval(retryConsentWithdrawals, 30_000);
  void retryConsentWithdrawals();
  return () => {
    events.forEach(event => window.removeEventListener(event, retryConsentWithdrawals));
    window.clearInterval(timer);
  };
}

function newReceiptId() {
  if (window.crypto.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function saveCookieConsent(choice, days, { contentRevision = null, method = "preferences" } = {}) {
  const analytics = choice.analytics === true;
  const marketing = choice.marketing === true;
  const retentionDays = consentRetentionDays(days);
  const now = Date.now();
  const prior = readStoredChoice();
  const current = validateChoice(prior);
  if (current?.receiptId && current.analytics === analytics && current.marketing === marketing
      && current.contentRevision === contentRevision) return true;

  const refusal = {
    version: COOKIE_CONSENT_VERSION,
    ...NECESSARY_ONLY,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + retentionDays * DAY).toISOString(),
  };
  queueWithdrawal(prior?.receiptId || prior?.pendingId, prior?.withdrawKey);
  if (!analytics && !marketing) {
    const saved = saveLocally(refusal, refusal);
    void retryConsentWithdrawals();
    return saved;
  }

  let id;
  let withdrawKey;
  let attempted = false;
  try {
    id = newReceiptId();
    withdrawKey = newReceiptId();
    const payload = { id, withdrawKey, version: COOKIE_CONSENT_VERSION, analytics, marketing, retentionDays, contentRevision, method };
    if (!saveLocally({ ...refusal, pendingId: id, withdrawKey }, refusal)) return false;
    if (pendingWithdrawals.size) void retryConsentWithdrawals();
    attempted = true;
    const response = await postConsent("/api/consent", payload);
    if (!response.ok) return false;
    const receipt = await response.json();
    const next = {
      receiptId: receipt.id, withdrawKey, version: receipt.version, necessary: true,
      analytics: receipt.analytics, marketing: receipt.marketing,
      contentRevision: receipt.contentRevision, savedAt: receipt.savedAt, expiresAt: receipt.expiresAt,
    };
    if (receipt.id !== id || receipt.version !== COOKIE_CONSENT_VERSION
        || receipt.analytics !== analytics || receipt.marketing !== marketing
        || receipt.method !== method || receipt.contentRevision !== contentRevision
        || !validateChoice(next) || readStoredChoice()?.pendingId !== id) return false;
    return saveLocally(next, refusal) && readCookieConsent()?.receiptId === id;
  } catch {
    if (!attempted && readCookieConsent()?.receiptId) saveLocally(refusal, refusal);
    return false;
  } finally {
    if (attempted && readCookieConsent()?.receiptId !== id) {
      queueWithdrawal(id, withdrawKey);
      if (readStoredChoice()?.pendingId === id) saveLocally(refusal, refusal);
    }
    if (pendingWithdrawals.size) void retryConsentWithdrawals();
  }
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
    if (event.key === COOKIE_CONSENT_STORAGE_KEY || event.key === null || event.key?.startsWith(WITHDRAWN_PREFIX)) sync();
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
