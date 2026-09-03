import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminApiError, adminRequest } from "../lib/adminApi";

const AdminSessionContext = createContext(null);

const EMPTY_SESSION = {
  status: "checking",
  admin: null,
  csrfToken: "",
  expiresAt: "",
  error: "",
};

function sessionFromPayload(payload) {
  if (
    !payload
    || typeof payload.admin?.username !== "string"
    || !payload.admin.username
    || typeof payload.csrf_token !== "string"
    || !payload.csrf_token
    || typeof payload.expires_at !== "string"
  ) {
    throw new AdminApiError("Răspunsul de administrare nu este valid.");
  }

  return {
    status: "authenticated",
    admin: { username: payload.admin.username },
    csrfToken: payload.csrf_token,
    expiresAt: payload.expires_at,
    error: "",
  };
}

function anonymousSession(error = "") {
  return {
    ...EMPTY_SESSION,
    status: "anonymous",
    error,
  };
}

function unavailableSession(error = "") {
  return {
    ...EMPTY_SESSION,
    status: "unavailable",
    error,
  };
}

export function AdminSessionProvider({ children }) {
  const [session, setSession] = useState(EMPTY_SESSION);
  const sessionRef = useRef(EMPTY_SESSION);
  const operationRef = useRef(0);
  const sessionEpochRef = useRef(0);

  const replaceSession = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const becomeAnonymous = useCallback((error = "") => {
    sessionEpochRef.current += 1;
    replaceSession(anonymousSession(error));
  }, [replaceSession]);

  const refresh = useCallback(async ({ preserveVisibleState = false } = {}) => {
    const operation = ++operationRef.current;
    if (!preserveVisibleState || sessionRef.current.status !== "authenticated") {
      replaceSession({ ...sessionRef.current, status: "checking", error: "" });
    }

    try {
      const payload = await adminRequest("/api/admin/auth/session");
      if (operation !== operationRef.current) return null;
      const nextSession = sessionFromPayload(payload);
      sessionEpochRef.current += 1;
      replaceSession(nextSession);
      return nextSession;
    } catch (error) {
      if (operation !== operationRef.current) return null;
      if (error instanceof AdminApiError && error.status === 401) {
        becomeAnonymous();
        return null;
      }
      replaceSession(unavailableSession(
        error instanceof Error ? error.message : "Administrarea nu este disponibilă momentan.",
      ));
      return null;
    }
  }, [becomeAnonymous, replaceSession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async ({ username, password }) => {
    const operation = ++operationRef.current;
    replaceSession({ ...sessionRef.current, status: "authenticating", error: "" });

    try {
      const payload = await adminRequest("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (operation !== operationRef.current) return null;
      const nextSession = sessionFromPayload(payload);
      sessionEpochRef.current += 1;
      replaceSession(nextSession);
      return nextSession;
    } catch (error) {
      if (operation !== operationRef.current) return null;
      replaceSession(anonymousSession(
        error instanceof AdminApiError && error.status >= 500
          ? "Administrarea nu este disponibilă momentan."
          : "Datele de autentificare nu sunt valide.",
      ));
      throw error;
    }
  }, [replaceSession]);

  const logout = useCallback(async () => {
    const operation = ++operationRef.current;
    const current = sessionRef.current;

    try {
      await adminRequest("/api/admin/auth/logout", {
        method: "POST",
        csrfToken: current.csrfToken,
        body: JSON.stringify({}),
      });
      if (operation === operationRef.current) becomeAnonymous();
    } catch (error) {
      if (operation === operationRef.current && error instanceof AdminApiError && error.status === 401) {
        becomeAnonymous();
      } else if (operation === operationRef.current) {
        // A network failure never pretends the current session was revoked.
        replaceSession({
          ...sessionRef.current,
          error: "Ieșirea din administrare nu a putut fi confirmată. Încearcă din nou.",
        });
      }
      throw error;
    }
  }, [becomeAnonymous, replaceSession]);

  const request = useCallback(async (path, options = {}) => {
    const epoch = sessionEpochRef.current;
    const csrfToken = sessionRef.current.csrfToken;
    try {
      return await adminRequest(path, { ...options, csrfToken });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401 && epoch === sessionEpochRef.current) {
        becomeAnonymous();
      }
      throw error;
    }
  }, [becomeAnonymous]);

  const value = useMemo(() => ({
    ...session,
    login,
    logout,
    refresh,
    request,
  }), [login, logout, refresh, request, session]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession trebuie folosit în AdminSessionProvider.");
  return value;
}
