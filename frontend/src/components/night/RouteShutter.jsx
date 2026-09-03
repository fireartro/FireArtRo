import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";

const RouteShutterContext = createContext({ navigateWithShutter: null });
const ROUTE_BANDS = 10;

export const useRouteShutter = () => useContext(RouteShutterContext);

export default function RouteShutter({ children }) {
  const overlayRef = useRef(null);
  const bandRefs = useRef([]);
  const timelineRef = useRef(null);
  const navigationFallbackRef = useRef(null);
  const navigationIssuedRef = useRef(false);
  const runningRef = useRef(false);
  const [active, setActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const finishTransition = useCallback(() => {
    // The timeout can finish navigation while WebKit has suspended GSAP.
    // Dispose the old timeline before it gets another frame and reopens the bands.
    const timeline = timelineRef.current;
    timelineRef.current = null;
    if (timeline) {
      timeline.eventCallback("onComplete", null);
      timeline.eventCallback("onInterrupt", null);
      timeline.kill();
    }
    if (navigationFallbackRef.current) {
      window.clearTimeout(navigationFallbackRef.current);
      navigationFallbackRef.current = null;
    }
    runningRef.current = false;
    if (overlayRef.current) {
      gsap.set(overlayRef.current, { visibility: "hidden", pointerEvents: "none" });
    }
    const bands = bandRefs.current.filter(Boolean);
    if (bands.length) gsap.set(bands, { scaleY: 0 });
    setActive(false);
    document.documentElement.style.removeProperty("overflow");
  }, []);

  const resetTransition = useCallback(() => {
    navigationIssuedRef.current = true;
    finishTransition();
  }, [finishTransition]);

  const navigateWithShutter = useCallback((target) => {
    if (!target || runningRef.current) return;

    if (reduceMotion) {
      navigate(target);
      return;
    }

    const overlay = overlayRef.current;
    const bands = bandRefs.current.filter(Boolean);
    if (!overlay || bands.length !== ROUTE_BANDS) {
      navigate(target);
      return;
    }

    runningRef.current = true;
    navigationIssuedRef.current = false;
    setActive(true);
    document.documentElement.style.overflow = "hidden";
    timelineRef.current?.kill();

    const timeline = gsap.timeline({ onComplete: finishTransition, onInterrupt: finishTransition });
    timelineRef.current = timeline;
    timeline
      .set(overlay, { visibility: "visible", pointerEvents: "auto" })
      .set(bands, { scaleY: 0.008, transformOrigin: "center center", force3D: true });

    bands.forEach((band, index) => {
      timeline.to(
        band,
        { scaleY: 1.1, duration: 0.34, ease: "power3.out" },
        index * 0.025,
      );
    });

    timeline.call(() => {
      if (navigationIssuedRef.current) return;
      navigationIssuedRef.current = true;
      navigate(target);
    }, [], 0.57);

    [...bands].reverse().forEach((band, index) => {
      timeline.to(
        band,
        { scaleY: 0, duration: 0.3, ease: "power3.in", transformOrigin: "center center" },
        0.64 + index * 0.025,
      );
    });

    timeline.set(overlay, { visibility: "hidden", pointerEvents: "none" });

    // WebKit can suspend a GSAP ticker while a route transition is covering the page.
    // Navigation must never remain trapped behind a half-open shutter in that case.
    navigationFallbackRef.current = window.setTimeout(() => {
      if (!runningRef.current) return;
      if (!navigationIssuedRef.current) {
        navigationIssuedRef.current = true;
        navigate(target);
      }
      finishTransition();
    }, 1_600);
  }, [finishTransition, navigate, reduceMotion]);

  useEffect(() => {
    const interceptInternalLinks = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const current = `${location.pathname}${location.search}${location.hash}`;
      const target = `${url.pathname}${url.search}${url.hash}`;
      if (target === current) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

      event.preventDefault();
      event.stopPropagation();
      navigateWithShutter(target);
    };

    document.addEventListener("click", interceptInternalLinks, true);
    return () => document.removeEventListener("click", interceptInternalLinks, true);
  }, [location.hash, location.pathname, location.search, navigateWithShutter]);

  useEffect(() => {
    // Back/forward cache can restore the page while the shutter is still open.
    // Always reset its visual state before the restored page becomes interactive.
    window.addEventListener("pagehide", resetTransition);
    window.addEventListener("pageshow", resetTransition);
    return () => {
      window.removeEventListener("pagehide", resetTransition);
      window.removeEventListener("pageshow", resetTransition);
    };
  }, [resetTransition]);

  useEffect(() => () => {
    timelineRef.current?.kill();
    if (navigationFallbackRef.current) window.clearTimeout(navigationFallbackRef.current);
    document.documentElement.style.removeProperty("overflow");
  }, []);

  return (
    <RouteShutterContext.Provider value={{ navigateWithShutter }}>
      {children}
      <div
        ref={overlayRef}
        className="fa-route-shutter"
        data-testid="route-shutter"
        data-active={active ? "true" : "false"}
        aria-hidden="true"
      >
        <div className="fa-route-shutter__bands">
          {Array.from({ length: ROUTE_BANDS }, (_, index) => (
            <span
              key={index}
              ref={(node) => {
                bandRefs.current[index] = node;
              }}
              data-route-band
            />
          ))}
        </div>
      </div>
    </RouteShutterContext.Provider>
  );
}
