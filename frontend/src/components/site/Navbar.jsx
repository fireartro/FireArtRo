import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";
import useManagedContent from "@/hooks/useManagedContent";
import { LOGO_SRC_SET, LOGO_URL } from "@/lib/constants";
import { getHeaderOffset, navigateToHref, scrollToHash, syncScrollOffset } from "@/lib/scrollNavigation";
import "@/styles/navigation-prominence.css";

const publicHref = (href) => (href.startsWith("#") ? `/${href}` : href);
const isPlainClick = (event) => !event.defaultPrevented && event.button === 0
  && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

const Logo = ({ onClick }) => {
  const imageRef = useRef(null);
  const [sizes, setSizes] = useState("(max-width: 1023px) 192px, 12vw");
  const measure = useCallback(() => {
    const width = imageRef.current?.getBoundingClientRect().width;
    if (width > 0) setSizes(`${Math.ceil(width)}px`);
  }, []);
  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (imageRef.current) observer?.observe(imageRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);
  return (
  <a
    href="/#acasa"
    onClick={(event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onClick?.();
    }}
    data-testid="nav-logo"
    className="site-navbar-brand"
  >
    <img ref={imageRef} onLoad={measure} src={LOGO_URL} srcSet={LOGO_SRC_SET} sizes={sizes} alt="FireArtRo" width="720" height="311" />
  </a>
);
};

export const Navbar = () => {
  const navigation = useManagedContent("navigation", CMS_DEFAULTS.navigation);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#acasa");
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const programmaticScrollUntil = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const goHome = useCallback((behavior = "smooth") => {
    programmaticScrollUntil.current = Date.now() + 3400;
    setVisible(true);
    setActive("#acasa");
    if (location.pathname === "/") {
      navigateToHref({ href: "#acasa", navigate, pathname: location.pathname, behavior });
      return;
    }
    navigate("/#acasa");
    window.setTimeout(() => scrollToHash("#acasa", "auto"), 120);
  }, [location.pathname, navigate]);

  const goTo = useCallback((href, behavior = "smooth") => {
    programmaticScrollUntil.current = Date.now() + 3400;
    setVisible(true);
    setActive(href);
    navigateToHref({ href, navigate, pathname: location.pathname, behavior });
  }, [location.pathname, navigate]);

  const closeAndGoTo = useCallback((href) => {
    setOpen(false);
    window.setTimeout(() => goTo(href, "auto"), 150);
  }, [goTo]);

  const desktopLinks = navigation.links.filter((link) => link.href !== "#acasa");
  const midpoint = Math.ceil(desktopLinks.length / 2);
  const leftLinks = desktopLinks.slice(0, midpoint);
  const rightLinks = desktopLinks.slice(midpoint);

  useEffect(() => {
    const updateNavigation = () => {
      syncScrollOffset();
      const currentY = Math.max(window.scrollY, 0);
      const delta = currentY - lastScrollY.current;
      const usesFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

      setScrolled(currentY > 28);
      if (!usesFinePointer || Date.now() < programmaticScrollUntil.current) {
        setVisible(true);
      } else if (currentY < 92) {
        setVisible(true);
      } else if (delta > 18) {
        setVisible(false);
      } else if (delta < -10) {
        setVisible(true);
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(updateNavigation);
    };

    const onResize = () => {
      syncScrollOffset();
      onScroll();
    };

    lastScrollY.current = window.scrollY;
    onResize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== "/") {
      setActive(location.pathname);
      return;
    }

    const hashLinks = navigation.links.filter((link) => link.href.startsWith("#"));
    const requestedHash = hashLinks.some((link) => link.href === location.hash)
      ? location.hash
      : "";
    let raf = 0;

    const updateActive = () => {
      if (requestedHash && Date.now() < programmaticScrollUntil.current) {
        setActive(requestedHash);
        raf = 0;
        return;
      }

      const probeY = getHeaderOffset() + window.innerHeight * 0.22;
      let next = "#acasa";

      const sections = hashLinks
        .map((link) => ({
          link,
          section: document.getElementById(link.href.slice(1)),
        }))
        .filter(({ section }) => section)
        .sort((first, second) => first.section.offsetTop - second.section.offsetTop);

      for (const { link, section } of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom > probeY) {
          next = link.href;
          break;
        }
        if (rect.top <= probeY) next = link.href;
      }

      if (window.scrollY < 12) next = "#acasa";
      setActive(next);
      raf = 0;
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updateActive);
    };

    if (requestedHash) {
      programmaticScrollUntil.current = Date.now() + 3400;
      setVisible(true);
      setActive(requestedHash);
      window.requestAnimationFrame(() => scrollToHash(requestedHash, "auto"));
    }
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("hashchange", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [location.hash, location.pathname, navigation.links]);

  const renderDesktopLink = (link) => {
    const isActive = active === link.href;
    return (
      <a
        key={link.id}
        href={publicHref(link.href)}
          onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          goTo(link.href, reduceMotion ? "auto" : "smooth");
        }}
        data-testid={`nav-link-${link.href.replace(/[#/]/g, "") || "home"}`}
        className={isActive ? "is-active" : ""}
        aria-current={isActive ? "page" : undefined}
      >
        {link.label}
        {isActive && (
          <motion.span
            layoutId={reduceMotion ? undefined : "nav-active"}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
            aria-hidden="true"
          />
        )}
      </a>
    );
  };

  return (
    <motion.header
      initial={reduceMotion ? false : { y: "-100%", opacity: 0 }}
      animate={{ y: visible || open || reduceMotion ? 0 : "-100%", opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`site-navbar ${scrolled ? "site-navbar-scrolled" : ""}`}
      data-testid="main-navbar"
    >
      <nav className="site-navbar-layout" aria-label="Navigare principală">
        <div className="site-navbar-links site-navbar-links-left">
          {leftLinks.map(renderDesktopLink)}
        </div>

        <div className="site-navbar-logo">
          <Logo onClick={() => goHome("auto")} />
        </div>

        <div className="site-navbar-links site-navbar-links-right">
          {rightLinks.map(renderDesktopLink)}
        </div>

        <div className="site-navbar-mobile">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" data-testid="mobile-menu-trigger" className="menu-button" aria-label="Deschide meniul">
                <span className="menu-button__lines" aria-hidden="true">
                  <span className="menu-button__line" />
                  <span className="menu-button__line" />
                  <span className="menu-button__line" />
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="mobile-nav-sheet z-[11020] bg-[#06101c]/98 border-white/10 w-[88vw] max-w-[350px] p-0 [&>button]:hidden"
            >
              <div className="mobile-nav-column flex flex-col">
                <SheetTitle className="sr-only">Meniu de navigare</SheetTitle>
                <SheetDescription className="sr-only">
                  Navighează către secțiunile site-ului FireArtRo
                </SheetDescription>
                <div className="mobile-nav-head">
                  <Logo onClick={() => {
                    setOpen(false);
                    window.setTimeout(() => goHome("auto"), 150);
                  }} />
                  <button type="button" onClick={() => setOpen(false)} aria-label="Închide meniul" data-testid="mobile-menu-close">
                    <X />
                  </button>
                </div>

                <div className="mobile-nav-links">
                  {navigation.links.filter((link) => link.href !== "#acasa").map((link, index) => (
                    <motion.a
                      key={link.id}
                      href={publicHref(link.href)}
                      onClick={(event) => {
                        if (!isPlainClick(event)) return;
                        event.preventDefault();
                        closeAndGoTo(link.href);
                      }}
                      data-testid={`mobile-nav-link-${link.href.replace(/[#/]/g, "") || "home"}`}
                      className={active === link.href ? "is-active" : ""}
                      aria-current={active === link.href ? "page" : undefined}
                      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={reduceMotion ? { duration: 0, delay: 0 } : { delay: 0.04 + index * 0.035 }}
                    >
                      {link.label}
                      <ArrowRight />
                    </motion.a>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
};

export default Navbar;
