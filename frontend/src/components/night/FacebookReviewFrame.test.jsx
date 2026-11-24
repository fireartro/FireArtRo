import { act } from "react";
import { createRoot } from "react-dom/client";
import FacebookReviewFrame from "./FacebookReviewFrame";

test("only the mounted widget can expand the same frame and dismiss its full-page dialog", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<FacebookReviewFrame reviewsHref="https://www.facebook.com/FireArtRo/reviews" />));
    const frame = host.querySelector("iframe");
    const dialog = host.querySelector("dialog");
    const source = frame.contentWindow;
    const origin = new URL(frame.src).origin;
    // jsdom has no native dialog top layer.
    dialog.showModal = jest.fn(() => dialog.setAttribute("open", ""));
    dialog.close = jest.fn(() => dialog.removeAttribute("open"));
    const message = (open, overrides) => new MessageEvent("message", {
      origin, source, data: { type: "fireart:review-dialog", open }, ...overrides,
    });

    window.dispatchEvent(message(true, { source: window }));
    window.dispatchEvent(message(true, { origin: "https://www.facebook.com" }));
    window.dispatchEvent(message(true, { data: { type: "different-event", open: true } }));
    window.dispatchEvent(message("yes"));
    window.dispatchEvent(message(true));
    expect(dialog.showModal).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(message(false, { source: window, data: { type: "fireart:review-ready" } }));
    });
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    await act(async () => {
      window.dispatchEvent(message(false, { data: { type: "fireart:review-ready" } }));
    });
    expect(dialog.getAttribute("aria-hidden")).toBeNull();

    window.dispatchEvent(message(true));
    window.dispatchEvent(message(true));
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(host.querySelector("iframe").contentWindow).toBe(source);
    expect(dialog.getAttribute("role")).toBeNull();
    window.dispatchEvent(message(false));
    expect(dialog.open).toBe(false);
    expect(dialog.getAttribute("role")).toBe("presentation");

    window.dispatchEvent(message(true));
    const post = jest.spyOn(source, "postMessage");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(post).toHaveBeenCalledWith({ type: "fireart:close-review-dialog" }, origin);
    expect(dialog.open).toBe(false);

    const staleMessage = message(true);
    window.dispatchEvent(staleMessage);
    await act(async () => root.render(null));
    expect(dialog.open).toBe(false);
    window.dispatchEvent(staleMessage);
    expect(dialog.showModal).toHaveBeenCalledTimes(3);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("a frame load alone keeps the panel hidden and falls back to the original reviews", async () => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const href = "https://www.facebook.com/FireArtRo/reviews";
  try {
    await act(async () => root.render(<FacebookReviewFrame reviewsHref={href} />));
    const frame = host.querySelector("iframe");
    const post = jest.spyOn(frame.contentWindow, "postMessage");
    await act(async () => frame.dispatchEvent(new Event("load")));
    expect(post).toHaveBeenCalledWith({ type: "fireart:check-review-ready" }, new URL(frame.src).origin);
    expect(host.querySelector("dialog").getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelector("a").href).toBe(href);

    await act(async () => jest.advanceTimersByTime(9000));
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("[role='status']").textContent).toContain("nu sunt disponibile");
    expect(host.querySelector("a").href).toBe(href);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
    jest.useRealTimers();
  }
});
