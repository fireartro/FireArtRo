import { act } from "react";
import { createRoot } from "react-dom/client";
import SceneBoundary from "./SceneBoundary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("a failed decorative scene keeps the surrounding content available", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  const onUnavailable = jest.fn();
  function FailedScene() { throw new Error("Chunk unavailable"); }
  try {
    await act(async () => root.render(<>
      <h2>Partenerii FireArtRo</h2>
      <SceneBoundary onUnavailable={onUnavailable}><FailedScene /></SceneBoundary>
      <p>Partner name</p>
    </>));
    expect(container.textContent).toBe("Partenerii FireArtRoPartner name");
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    errors.mockRestore();
  }
});
