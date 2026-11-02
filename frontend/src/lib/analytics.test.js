import {
  ANALYTICS_EVENT,
  contactChannel,
  pagePathForAnalytics,
  referrerForAnalytics,
  trackQuoteAccepted,
} from "./analytics";

test("contact links yield only a fixed channel and reject lookalike WhatsApp domains", () => {
  expect(contactChannel("tel:+40787602144")).toBe("phone");
  expect(contactChannel("mailto:contact@example.com?subject=Private")).toBe("email");
  expect(contactChannel("https://wa.me/40787602144?text=Private")).toBe("whatsapp");
  expect(contactChannel("https://api.whatsapp.com/send?phone=40787602144&text=Private")).toBe("whatsapp");
  for (const href of ["https://wa.me.evil.test/40787602144", "https://evil.test/?next=https://wa.me/1", "javascript:alert(1)", "/contact", "https://facebook.com/FireArtRo", "https://wa.me@evil.test/", "https://api.whatsapp.com/business/"]) {
    expect(contactChannel(href)).toBeNull();
  }
});

test("analytics page context strips queries and accepts only public routes", () => {
  expect(pagePathForAnalytics("/pachete?email=private@example.com#details")).toBe("/pachete");
  expect(pagePathForAnalytics("/servicii/artificii-nunta")).toBe("/servicii/artificii-nunta");
  expect(pagePathForAnalytics("/blog/eveniment-public")).toBe("/blog/eveniment-public");
  for (const pathname of ["/admin", "/admin/inbox", "/private@example.com", "//evil.test/path", "/blog/%2fsecret", "https://evil.test/", "/servicii/unknown"]) {
    expect(pagePathForAnalytics(pathname)).toBeNull();
  }
  expect(referrerForAnalytics("https://chatgpt.com/c/private?email=private@example.com#private")).toBe("https://chatgpt.com/");
  expect(referrerForAnalytics("javascript:alert(1)")).toBe("");
  expect(referrerForAnalytics("https://user:secret@evil.test/path")).toBe("");
});

test("a confirmed quote emits a fixed local signal without the form or response fields", () => {
  const listener = jest.fn();
  window.addEventListener(ANALYTICS_EVENT, listener);
  try {
    expect(trackQuoteAccepted({ email: "private@example.com", submission_id: "private-id" })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ name: "generate_lead" });
  } finally {
    window.removeEventListener(ANALYTICS_EVENT, listener);
  }
});
