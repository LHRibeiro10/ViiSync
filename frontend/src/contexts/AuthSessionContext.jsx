import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AUTH_SESSION_STORAGE_KEY,
  clearSessionToken,
  getCurrentUser,
  logoutUser,
  setSessionToken,
} from "../services/api";
import { AuthSessionContext } from "./AuthSessionContext.shared";

function hasStoredToken() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY));
}

const SESSION_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 20;

export function AuthSessionProvider({ children }) {
  const inactivityTimeoutRef = useRef(null);
  const [state, setState] = useState({
    loading: hasStoredToken(),
    user: null,
    authenticated: false,
    sessionNotice: null,
  });

  const refreshSession = useCallback(async () => {
    if (!hasStoredToken()) {
      setState({
        loading: false,
        user: null,
        authenticated: false,
        sessionNotice: null,
      });
      return null;
    }

    try {
      const payload = await getCurrentUser();
      const user = payload?.user || null;

      setState({
        loading: false,
        user,
        authenticated: Boolean(user),
        sessionNotice: null,
      });

      return user;
    } catch (error) {
      const shouldShowReplacementNotice = error?.code === "SESSION_REPLACED";

      if (error?.status === 401 || error?.status === 403) {
        clearSessionToken();
      }

      setState({
        loading: false,
        user: null,
        authenticated: false,
        sessionNotice: shouldShowReplacementNotice
          ? error?.message || "Voce iniciou sessao em outro navegador."
          : null,
      });

      return null;
    }
  }, []);

  const applySessionToken = useCallback(
    async (token) => {
      setSessionToken(token);
      return refreshSession();
    },
    [refreshSession]
  );

  const clearSession = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // No-op: o token local ainda sera removido.
    }

    clearSessionToken();
    setState({
      loading: false,
      user: null,
      authenticated: false,
      sessionNotice: null,
    });
  }, []);

  const clearSessionNotice = useCallback(() => {
    setState((currentValue) => ({
      ...currentValue,
      sessionNotice: null,
    }));
  }, []);

  const clearInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      window.clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }, []);

  const resetInactivityTimeout = useCallback(() => {
    clearInactivityTimeout();

    inactivityTimeoutRef.current = window.setTimeout(() => {
      clearSession();
    }, SESSION_INACTIVITY_TIMEOUT_MS);
  }, [clearInactivityTimeout, clearSession]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refreshSession();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshSession]);

  useEffect(() => {
    function handleAuthFailure(event) {
      const detail = event?.detail || {};
      const isAuthFailure =
        Number(detail.status) === 401 || Number(detail.status) === 403;

      if (!isAuthFailure) {
        return;
      }

      clearSessionToken();
      clearInactivityTimeout();

      setState((currentValue) => ({
        ...currentValue,
        loading: false,
        user: null,
        authenticated: false,
        sessionNotice:
          detail.code === "SESSION_REPLACED"
            ? detail.message || "Voce iniciou sessao em outro navegador."
            : null,
      }));
    }

    window.addEventListener("viisync:auth-failure", handleAuthFailure);

    return () => {
      window.removeEventListener("viisync:auth-failure", handleAuthFailure);
    };
  }, [clearInactivityTimeout]);

  useEffect(() => {
    if (!state.authenticated) {
      clearInactivityTimeout();
      return undefined;
    }

    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    function handleActivity() {
      resetInactivityTimeout();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetInactivityTimeout();
      }
    }

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetInactivityTimeout();

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInactivityTimeout();
    };
  }, [clearInactivityTimeout, resetInactivityTimeout, state.authenticated]);

  const contextValue = useMemo(
    () => ({
      loading: state.loading,
      user: state.user,
      authenticated: state.authenticated,
      refreshSession,
      applySessionToken,
      clearSession,
      sessionNotice: state.sessionNotice,
      clearSessionNotice,
    }),
    [applySessionToken, clearSession, clearSessionNotice, refreshSession, state]
  );

  return (
    <AuthSessionContext.Provider value={contextValue}>
      {children}
    </AuthSessionContext.Provider>
  );
}
