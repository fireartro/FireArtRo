import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Footer from "./Footer";

let mockShareCapital = "";
jest.mock("@/hooks/useManagedContent", () => ({
  __esModule: true,
  default: (key, fallback) => key === "siteDetails" ? { ...fallback, shareCapital: mockShareCapital } : fallback,
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
