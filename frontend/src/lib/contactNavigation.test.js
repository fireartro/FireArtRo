import { goToContact } from "./contactNavigation";

test.each(["SecurityError", "QuotaExceededError"])("contact CTA still navigates when session storage throws %s", name => {
  const original = window.location;
  delete window.location;
  window.location = { assign: jest.fn() };
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Unavailable", name); });
  try {
    expect(() => goToContact({ package_id: "mix", package_title: "Mix", services: ["Efecte speciale"] })).not.toThrow();
    expect(window.location.assign).toHaveBeenCalledWith("/contact");
  } finally { storage.mockRestore(); window.location = original; }
});
