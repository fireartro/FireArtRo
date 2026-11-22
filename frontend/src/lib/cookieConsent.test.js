import {
  COOKIE_CONSENT_STORAGE_KEY,
  NECESSARY_ONLY,
  readCookieConsent,
  retryConsentWithdrawals,
  saveCookieConsent,
} from "./cookieConsent";

const grant = { ...NECESSARY_ONLY, analytics: true };
const originalFetch = global.fetch;
const originalCrypto = window.crypto;
const accepted = body => ({
  ok: true,
  json: async () => ({
    ...body, savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + body.retentionDays * 86_400_000).toISOString(),
  }),
});
const withdrawn = { ok: true, status: 204 };

beforeEach(() => {
  Object.defineProperty(window, "crypto", { configurable: true, value: require("crypto").webcrypto });
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(async () => {
  global.fetch.mockResolvedValue(withdrawn);
  await retryConsentWithdrawals();
  localStorage.clear();
  global.fetch = originalFetch;
  Object.defineProperty(window, "crypto", { configurable: true, value: originalCrypto });
});

test("no optional access until the server acknowledges the current choice and policy", async () => {
  let confirm;
  global.fetch.mockImplementation((_url, options) => new Promise(resolve => {
    confirm = () => resolve(accepted(JSON.parse(options.body)));
  }));
  const decision = saveCookieConsent(grant, 180, { contentRevision: "cms-test", method: "preferences" });
  expect(readCookieConsent()?.analytics).not.toBe(true);
  expect(global.fetch.mock.calls[0][0]).toBe("/api/consent");
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    analytics: true, marketing: false, version: 3, retentionDays: 180,
    contentRevision: "cms-test", method: "preferences", withdrawKey: expect.any(String),
  });
  confirm();
  expect(await decision).toBe(true);
  expect(readCookieConsent()).toMatchObject({ analytics: true, receiptId: expect.any(String) });
});

test("a rejected or unavailable grant leaves optional processing disabled", async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 503 });
  expect(await saveCookieConsent(grant, 180)).toBe(false);
  expect(readCookieConsent()?.analytics).not.toBe(true);
  expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).analytics).toBe(false);
  global.fetch.mockResolvedValue(withdrawn);
  await retryConsentWithdrawals();
});

test("the first refusal stays local with zero requests", async () => {
  await saveCookieConsent(NECESSARY_ONLY, 180);
  expect(readCookieConsent()).toMatchObject(NECESSARY_ONLY);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("re-saving options against a new published notice issues a fresh receipt", async () => {
  global.fetch.mockImplementation(async (url, options) => url === "/api/consent"
    ? accepted(JSON.parse(options.body)) : withdrawn);
  await saveCookieConsent(grant, 180, { contentRevision: "publication-1" });
  const prior = readCookieConsent().receiptId;
  await saveCookieConsent(grant, 180, { contentRevision: "publication-2" });
  const current = readCookieConsent();
  expect(current.contentRevision).toBe("publication-2");
  expect(current.receiptId).not.toBe(prior);
});

test("withdrawal is immediate, survives an outage, and retries the same reference", async () => {
  global.fetch.mockImplementation(async (url, options) => url === "/api/consent"
    ? accepted(JSON.parse(options.body)) : { ok: false, status: 503 });
  await saveCookieConsent(grant, 180);
  const { receiptId: id, withdrawKey } = readCookieConsent();
  const changed = saveCookieConsent(NECESSARY_ONLY, 180);
  expect(readCookieConsent()).toMatchObject(NECESSARY_ONLY);
  await changed;
  await retryConsentWithdrawals();
  global.fetch.mockResolvedValue(withdrawn);
  await retryConsentWithdrawals();
  expect(global.fetch.mock.calls.at(-1)[0]).toBe("/api/consent/withdraw");
  expect(JSON.parse(global.fetch.mock.calls.at(-1)[1].body)).toEqual({ id, withdrawKey });
  const count = global.fetch.mock.calls.length;
  await retryConsentWithdrawals();
  expect(global.fetch).toHaveBeenCalledTimes(count);
});

test("a refusal wins when the initial grant response is still pending", async () => {
  let confirm;
  global.fetch.mockImplementation((url, options) => url === "/api/consent"
    ? new Promise(resolve => { confirm = () => resolve(accepted(JSON.parse(options.body))); })
    : Promise.resolve(withdrawn));
  const decision = saveCookieConsent(grant, 180);
  await saveCookieConsent(NECESSARY_ONLY, 180);
  confirm();
  expect(await decision).toBe(false);
  expect(readCookieConsent()).toMatchObject(NECESSARY_ONLY);
});

test("an acknowledged withdrawal still blocks a stale cross-tab write", async () => {
  global.fetch.mockImplementation(async (url, options) => url === "/api/consent"
    ? accepted(JSON.parse(options.body)) : withdrawn);
  await saveCookieConsent(grant, 180);
  const active = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  await saveCookieConsent(NECESSARY_ONLY, 180);
  await retryConsentWithdrawals();
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, active);
  expect(readCookieConsent()).toBeNull();
});

test("older unproven grants are rejected but a current refusal is preserved", () => {
  const old = {
    ...grant, version: 2, savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(old));
  expect(readCookieConsent()).toBeNull();
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({ ...old, analytics: false }));
  expect(readCookieConsent()).toMatchObject(NECESSARY_ONLY);
});
