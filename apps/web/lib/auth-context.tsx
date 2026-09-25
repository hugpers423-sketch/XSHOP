'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  requireAuth: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUser(initialUser);
    setLoading(!initialUser);
  }, [initialUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setUser(null);
    router.refresh();
  }, [router]);

  const requireAuth = useCallback(() => {
    if (user) return true;
    const next = encodeURIComponent(pathname || '/');
    router.push(`/login?next=${next}`);
    return false;
  }, [pathname, router, user]);

  const value = useMemo(
    () => ({ user, loading, refresh, logout, requireAuth }),
    [user, loading, refresh, logout, requireAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
