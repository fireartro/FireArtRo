import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createBrowserRouter, RouterProvider, useBlocker } from "react-router-dom";
import AdminDialog from "./AdminDialog";

const AdminRouteContent = createContext(null);
function RouteContent() { return useContext(AdminRouteContent); }

export default function AdminHistoryRouter({ children }) {
  const [router, setRouter] = useState(null);
  useEffect(() => {
    const instance = createBrowserRouter([{ path: "*", Component: RouteContent }]);
    setRouter(instance);
    return () => instance.dispose();
  }, []);
  return router ? <AdminRouteContent.Provider value={children}>
    <RouterProvider router={router} />
  </AdminRouteContent.Provider> : null;
}

function HistoryGuard({ busy, dirty, onBusy }) {
  const blockHistory = useCallback(({ historyAction, currentLocation, nextLocation }) =>
    historyAction === "POP" && (busy || dirty)
      && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
    [busy, dirty]);
  const blocker = useBlocker(blockHistory);

  useEffect(() => {
    if (blocker.state === "blocked" && busy) {
      onBusy(true);
      blocker.reset();
    }
  }, [blocker, busy, onBusy]);
  const open = blocker.state === "blocked" && !busy;
  return <AdminDialog open={open} onOpenChange={(next) => { if (open && !next) blocker.reset(); }}
    title="Modificări nesalvate" description="Dacă pleci acum, textul nesalvat din această secțiune se pierde.">
    <div className="cms-row-actions">
      <button type="button" className="admin-button is-primary" onClick={() => blocker.reset?.()}>Rămâi în editor</button>
      <button type="button" className="admin-button" onClick={() => blocker.proceed?.()}>Pleacă fără salvare</button>
    </div>
  </AdminDialog>;
}

export function AdminHistoryGuard(props) {
  // The public router and isolated component previews do not load a data router.
  const insideAdminRouter = useContext(AdminRouteContent) !== null;
  return insideAdminRouter ? <HistoryGuard {...props} /> : null;
}
