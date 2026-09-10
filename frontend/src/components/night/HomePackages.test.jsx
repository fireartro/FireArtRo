import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import HomePackages from "./HomePackages";
import useManagedContent from "@/hooks/useManagedContent";

jest.mock("@/hooks/useManagedContent");
jest.mock("@/hooks/useNearViewport", () => () => false);
jest.mock("framer-motion", () => ({ useReducedMotion: () => true }));
jest.mock("gsap", () => ({
  gsap: {
    registerPlugin: jest.fn(),
    context: jest.fn(() => ({ revert: jest.fn() })),
    killTweensOf: jest.fn(),
    set: jest.fn(),
  },
}));
jest.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

test("renders ordered photo category cards with CMS media associations and deep links", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const packages = [
    { id: "effects", category: "Efecte speciale", title: "Mix" },
    { id: "day", category: "Artificii de zi", title: "Zi" },
    { id: "night", category: "Artificii de noapte", title: "Noapte", imageMediaId: "night-photo" },
  ];
  const mediaItems = [{ id: "night-photo", src: "/owned/night.webp" }];
  useManagedContent.mockImplementation((key, fallback) => {
    if (key === "packages") return packages;
    if (key === "mediaItems") return mediaItems;
    return fallback;
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><HomePackages /></MemoryRouter>));
    const cards = [...container.querySelectorAll(".fa-category-card")];
    expect(cards.map((card) => card.dataset.packageCategory)).toEqual([
      "Artificii de noapte",
      "Artificii de zi",
      "Show drone",
      "Efecte speciale",
    ]);
    expect(cards[0].getAttribute("href")).toBe("/pachete?categorie=Artificii%20de%20noapte");
    expect(cards[0].querySelector("img").getAttribute("src")).toBe("/owned/night.webp");
    expect(cards[2].textContent).toContain("Spectacole de drone");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
