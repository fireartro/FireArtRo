import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { readCookieConsent, retryConsentWithdrawals } from "@/lib/cookieConsent";
import { seedConsent, TEST_CONSENT_RECEIPT } from "@/lib/consentTestFixture";
import Footer from "./Footer";

let mockShareCapital = "";
let mockLegalLinks;
jest.mock("@/hooks/useManagedContent", () => ({
  __esModule: true,
  default: (key, fallback) => {
    if (key === "siteDetails") return { ...fallback, shareCapital: mockShareCapital };
    if (key === "footer" && mockLegalLinks) return { ...fallback, legalLinks: mockLegalLinks };
    return fallback;
  },
}));

test.each([
  ["", false],
  ["   ", false],
  ["1.000 lei", true],
])("footer shows share capital only for a present amount (%p)", async (value, visible) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockShareCapital = value;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Footer />));
    const identity = host.querySelector(".fa-footer__identity");
    expect(identity.textContent.includes("Capital social")).toBe(visible);
    if (visible) expect(identity.textContent).toContain("1.000 lei");
  } finally {
    await act(async () => root.unmount());
    mockShareCapital = "";
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("footer links to ANPC's homepage and identifies the existing complaints link", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockLegalLinks = [{ id: "legal-anpc", label: "ANPC", href: "https://eservicii.anpc.ro/" }];
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Footer />));
    const officialLink = host.querySelector('a[href="https://www.anpc.ro/"]');
    const complaintsLink = host.querySelector('a[href="https://eservicii.anpc.ro/"]');
    expect(officialLink?.textContent).toContain("ANPC");
    expect(complaintsLink?.textContent).toBe("Reclamații ANPC");
  } finally {
    await act(async () => root.unmount());
    mockLegalLinks = undefined;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("footer sizes the official SAL pictogram for its national dispute-resolution link", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Footer />));
    const pictogram = host.querySelector('a[href="https://reclamatiisal.anpc.ro/"] img');
    expect(pictogram?.getAttribute("src")).toBe("/legal/anpc-sal.png");
    expect(pictogram?.getAttribute("width")).toBe("250");
    expect(pictogram?.getAttribute("height")).toBe("50");
  } finally {
    await act(async () => root.unmount());
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test.each(["analytics", "marketing"])("footer lets visitors withdraw %s consent in one action", async (category) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ status: 204 });
  const findWithdrawal = () => Array.from(host.querySelectorAll("button"))
    .find((button) => button.textContent.trim() === "Retrage acordul pentru cookies");

  try {
    await act(async () => root.render(<Footer />));
    expect(findWithdrawal()).toBeUndefined();

    await act(async () => seedConsent({ [category]: true }));
    const withdrawal = findWithdrawal();
    expect(withdrawal).toBeDefined();
    withdrawal.focus();
    await act(async () => withdrawal.click());
    await retryConsentWithdrawals();

    expect(readCookieConsent()).toMatchObject({ necessary: true, analytics: false, marketing: false });
    expect(global.fetch).toHaveBeenCalledWith("/api/consent/withdraw", expect.objectContaining({
      body: JSON.stringify({ id: TEST_CONSENT_RECEIPT.receiptId, withdrawKey: TEST_CONSENT_RECEIPT.withdrawKey }),
    }));
    expect(findWithdrawal()).toBeUndefined();
    expect(document.activeElement.textContent.trim()).toBe("Setări cookies");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    global.fetch = originalFetch;
    localStorage.clear();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
