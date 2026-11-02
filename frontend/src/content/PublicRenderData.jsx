import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PublicRenderDataContext = createContext(null);
export const PublicRenderDataProvider = PublicRenderDataContext.Provider;
export const usePublicRenderData = () => useContext(PublicRenderDataContext);

export function InitialPublicRenderDataProvider({value, children}) {
  const {pathname} = useLocation();
  const [initialRouteActive, setInitialRouteActive] = useState(true);
  useEffect(() => {
    if (value?.pathname && pathname !== value.pathname) setInitialRouteActive(false);
  }, [pathname, value?.pathname]);
  const current = useMemo(() => initialRouteActive && pathname === value?.pathname ? value
    : value ? {publication:value.publication} : null, [initialRouteActive, pathname, value]);
  return <PublicRenderDataProvider value={current}>{children}</PublicRenderDataProvider>;
}

// Inert JSON only: the strict production CSP never executes a bootstrap string.
export function readPublicRenderData() {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById('fireart-public-page-data');
  if (!node) return null;
  try {
    const data = JSON.parse(node.textContent);
    return data && typeof data === 'object' ? data : null;
  } catch { return null; }
  finally { node.remove(); }
}
