import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const serverQuery = () => false;

// The initial hydration must use the same query result as the server. React
// then applies the actual viewport without discarding the server-rendered page.
export function useMediaQuery(query) {
  const get = useCallback(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false, [query]);
  const subscribe = useCallback(onChange => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, get, serverQuery);
}

// True on phones / small viewports — used to lighten animations & layout.
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

export const useIsTablet = () => useMediaQuery("(min-width: 768px) and (max-width: 1023px)");

// iPads and touch-first laptops need the lighter motion path even at desktop widths.
export const useIsTouchDevice = () => useMediaQuery("(hover: none), (pointer: coarse)");

export const useIsAppleWebKit = () => {
  const get = () =>
    typeof document !== "undefined" &&
    (document.documentElement.dataset.appleWebkit === "true" ||
      document.documentElement.dataset.applePlatform === "true");
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    setMatches(get());
  }, []);

  return matches;
};

/* ----------------------------------------------------------------------
   Global scroll-direction tracker (for direction-aware exit animations).
   Module-level singleton listener — cheap, shared across all reveals.
---------------------------------------------------------------------- */
let _scrollDir = "down";
let _lastY = typeof window !== "undefined" ? window.scrollY : 0;
if (typeof window !== "undefined") {
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (Math.abs(y - _lastY) > 2) {
        _scrollDir = y > _lastY ? "down" : "up";
        _lastY = y;
      }
    },
    { passive: true }
  );
}
export const getScrollDir = () => _scrollDir;

export default useMediaQuery;
