import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_UPDATED_EVENT,
  COOKIE_CONSENT_VERSION,
} from "./cookieConsent";

export const TEST_CONSENT_RECEIPT = {
  receiptId: "3e1590d0-fb13-4342-aa0f-d479f8201d40",
  withdrawKey: "2be881ea-c397-4eef-ac83-1ffaa3caf88d",
};

export function seedConsent({ analytics = false, marketing = false } = {}, duration = 86_400_000) {
  const record = {
    version: COOKIE_CONSENT_VERSION, necessary: true, analytics, marketing,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + duration).toISOString(),
    ...(analytics || marketing ? { ...TEST_CONSENT_RECEIPT, contentRevision: null } : {}),
  };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event(COOKIE_CONSENT_UPDATED_EVENT));
  return record;
}
