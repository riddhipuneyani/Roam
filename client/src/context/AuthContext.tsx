import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiRequestError, authApi, setUnauthorizedHandler, type User } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when a signed-in session was rejected by the API (expired/revoked). */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // First 401 from any authenticated endpoint flips auth state immediately —
  // protected pages unmount and redirect instead of re-requesting in a loop.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (current !== null) setSessionExpired(true);
        return null;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: currentUser } = await authApi.me();
      setUser(currentUser);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setUser(null);
        return;
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await authApi.login({ email, password });
    setSessionExpired(false);
    setUser(loggedInUser);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const { user: newUser } = await authApi.signup({ name, email, password });
      setSessionExpired(false);
      setUser(newUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      sessionExpired,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, isLoading, sessionExpired, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
