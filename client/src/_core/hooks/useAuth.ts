import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, ApiError } from "@/lib/api";
import type { SessionView } from "@shared/pilot";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/acesso" } =
    options ?? {};
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await api.session());
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError
          : new ApiError("Não foi possível carregar a sessão.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (redirectOnUnauthenticated && !loading && !session)
      setLocation(redirectPath);
  }, [loading, redirectOnUnauthenticated, redirectPath, session, setLocation]);

  return {
    user: session?.account ?? null,
    session,
    loading,
    error,
    isAuthenticated: Boolean(session?.account),
    refresh,
    logout,
  };
}
