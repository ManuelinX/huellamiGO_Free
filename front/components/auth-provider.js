"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentAuthUser } from "@/lib/auth";
import { clearStoredAuthSession, getStoredAuthSession, setStoredAuthSession } from "@/lib/auth-session";

const AuthContext = createContext({
  user: null,
  session: null,
  isAuthLoading: true,
  setAuthSession: () => {},
  clearAuthSession: () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const refreshSession = async () => {
      const storedSession = getStoredAuthSession();

      if (!storedSession?.token) {
        if (mounted) {
          setSession(null);
          setIsAuthLoading(false);
        }
        return;
      }

      if (mounted) {
        setSession(storedSession);
        setIsAuthLoading(false);
      }

      try {
        const user = await getCurrentAuthUser();

        if (!mounted) {
          return;
        }

        const nextSession = {
          token: storedSession.token,
          user,
        };
        setSession(nextSession);
      } catch (error) {
        clearStoredAuthSession();
        if (mounted) {
          setSession(null);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    refreshSession();

    window.addEventListener("pageshow", refreshSession);
    window.addEventListener("huellamigo:auth-session-change", refreshSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("pageshow", refreshSession);
      window.removeEventListener("huellamigo:auth-session-change", refreshSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    isAuthLoading,
    setAuthSession: (nextSession) => {
      setStoredAuthSession(nextSession);
      setSession(nextSession);
      setIsAuthLoading(false);
    },
    clearAuthSession: () => {
      clearStoredAuthSession();
      setSession(null);
      setIsAuthLoading(false);
    },
  }), [isAuthLoading, session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
