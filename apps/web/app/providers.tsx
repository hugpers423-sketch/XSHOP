// apps/web/app/providers.tsx
'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/registerSW';
import { AuthProvider } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/api';

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
