const HEADER_SELECTOR = "[data-testid='main-navbar']";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const getHeaderOffset = () => {
  const header = document.querySelector(HEADER_SELECTOR);
  const height = header?.getBoundingClientRect().height || 0;
  return Math.ceil(height + 10);
};

export const syncScrollOffset = () => {
  const offset = getHeaderOffset();
  document.documentElement.style.setProperty("--nav-scroll-offset", `${offset}px`);
  return offset;
};

export const scrollToTop = (behavior = "smooth") => {
  window.scrollTo({ top: 0, behavior });
};

const alignToHash = (hash, behavior = "smooth") => {
  const element = document.querySelector(hash);
  if (!element) return false;

  const offset = syncScrollOffset();
  const rawTop = window.scrollY + element.getBoundingClientRect().top - offset;
  const maxTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
  window.scrollTo({ top: clamp(Math.round(rawTop), 0, maxTop), behavior });
  return true;
};

export const scrollToHash = (hash, behavior = "smooth") => {
  if (!hash || !hash.startsWith("#")) return false;
  if (hash === "#acasa") {
    scrollToTop(behavior);
    window.setTimeout(() => scrollToTop("auto"), 500);
    window.setTimeout(() => scrollToTop("auto"), 1100);
    return true;
  }

  const didScroll = alignToHash(hash, behavior);
  if (!didScroll) return false;

  window.setTimeout(() => alignToHash(hash, "auto"), 420);
  window.setTimeout(() => alignToHash(hash, "auto"), 920);
  window.setTimeout(() => alignToHash(hash, "auto"), 1450);
  window.setTimeout(() => alignToHash(hash, "auto"), 2200);
  return true;
};

export const navigateToHref = ({ href, navigate, pathname, behavior = "smooth" }) => {
  if (!href) return;

  if (href.startsWith("#")) {
    if (pathname === "/" && document.querySelector(href)) {
      scrollToHash(href, behavior);
      window.history.pushState(null, "", href === "#acasa" ? "/" : `/${href}`);
      return;
    }
    navigate(`/${href}`);
    window.setTimeout(() => scrollToHash(href, "auto"), 90);
    return;
  }

  const [path, hash] = href.split("#");
  const normalizedPath = path || "/";
  const normalizedHash = hash ? `#${hash}` : "";

  if (normalizedHash) {
    if (pathname === normalizedPath) {
      scrollToHash(normalizedHash, behavior);
      return;
    }
    navigate(`${normalizedPath}${normalizedHash}`);
    window.setTimeout(() => scrollToHash(normalizedHash, "auto"), 110);
    return;
  }

  if (pathname === href) {
    scrollToTop(behavior);
    return;
  }

  navigate(href);
};
