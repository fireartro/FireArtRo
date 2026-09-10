import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Packages } from "./Packages";
import useManagedContent from "@/hooks/useManagedContent";

jest.mock("@/hooks/useManagedContent");
jest.mock("framer-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/components/site/ManagedPageMedia", () => () => null);

const items = [
  {
    id: "night-one",
    title: "Noapte unu",
    category: "Artificii de noapte",
    shortDescription: "Noapte",
    bestFor: "Evenimente",
    duration: "3 minute",
    highlights: [],
    cta: "Cere ofertă",
    videoUrl: "https://youtu.be/night",
    moreVideoUrls: [],
  },
  {
    id: "day-one",
    title: "Zi unu",
    category: "Artificii de zi",
    shortDescription: "Zi",
    bestFor: "Ceremonii",
    duration: "2 minute",
    highlights: [],
    cta: "Cere ofertă",
    videoUrl: "https://youtu.be/day-primary",
    moreVideoUrls: ["https://youtu.be/day-extra", "https://youtu.be/day-primary"],
  },
];

beforeEach(() => {
  useManagedContent.mockImplementation((key, fallback) => fallback);
});

test("opens the category requested by the landing deep link and exposes that package video set once", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={["/pachete?categorie=Artificii%20de%20zi"]}>
        <Packages items={items} />
      </MemoryRouter>,
    ));

    expect(container.querySelector('[aria-selected="true"]')?.textContent).toContain("Artificii de zi");
    expect(container.querySelector('[data-testid="packages-active-title"]')?.textContent).toBe("Zi unu");
    expect(container.querySelector('[data-testid="package-media"] img')?.getAttribute('src')).toBe(
      'https://img.youtube.com/vi/day-primary/hqdefault.jpg',
    );
    expect([...container.querySelectorAll(".nr-package-more-videos a")].map((link) => link.href)).toEqual([
      "https://youtu.be/day-primary",
      "https://youtu.be/day-extra",
    ]);
    expect(container.querySelector('.nr-package-more-videos').open).toBe(true);
    const categoryButtons = [...container.querySelectorAll('.nr-package-categories button')];
    await act(async () => categoryButtons[0].click());
    expect(container.querySelector('[data-testid="packages-active-title"]').textContent).toBe('Noapte unu');
    expect([...container.querySelectorAll('.nr-package-more-videos a')].map(link => link.href)).toEqual(['https://youtu.be/night']);
    await act(async () => categoryButtons[1].click());
    expect(container.querySelector('[data-testid="packages-active-title"]').textContent).toBe('Zi unu');
    await act(async () => categoryButtons[1].dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp', bubbles:true})));
    expect(categoryButtons[0].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="packages-active-title"]').textContent).toBe('Noapte unu');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("shows the public drone label without changing the internal category value", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={["/pachete?categorie=Show%20drone"]}>
        <Packages items={items} />
      </MemoryRouter>,
    ));

    const selected = container.querySelector('.nr-package-categories [aria-selected="true"]');
    expect(selected?.textContent).toBe("Spectacole de drone");
    expect(container.querySelector('[data-testid="drone-show-quote"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
