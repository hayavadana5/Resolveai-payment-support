import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const data = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
        tokenStore.set(data.token);
        setUser(data.user);
      },
      signOut: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
