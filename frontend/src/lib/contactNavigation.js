const PREFILL_KEY = "fireartro-contact-prefill";

export const goToContact = (selection = {}) => {
  if (typeof window === "undefined") return;
  if (Object.keys(selection).length) {
    try {
      window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(selection));
    } catch {
      // A restricted or full store must not block access to the contact form.
    }
  }
  window.location.assign("/contact");
};

export const readContactPrefill = () => {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PREFILL_KEY) || "{}");
    window.sessionStorage.removeItem(PREFILL_KEY);
    return value;
  } catch {
    return {};
  }
};
