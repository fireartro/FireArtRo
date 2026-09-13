import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import HomeRunway from "./HomeRunway";

jest.mock("@/hooks/useNearViewport", () => () => false);
jest.mock("framer-motion", () => ({ useReducedMotion: () => true }));
jest.mock("gsap", () => ({ gsap: { registerPlugin: jest.fn() } }));
jest.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

test("shows the actual packages section before the gallery and keeps the other homepage sections", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><HomeRunway /></MemoryRouter>));
    const packages = container.querySelector('[data-testid="home-packages"]');
    const gallery = container.querySelector('[data-testid="home-gallery"]');
    expect(packages).not.toBeNull();
    expect(gallery).not.toBeNull();
    expect(packages.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[data-testid="home-about"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="home-partners"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="home-brief"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
