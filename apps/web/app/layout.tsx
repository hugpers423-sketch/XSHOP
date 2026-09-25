// apps/web/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './recovered.css';
import { Providers } from '@/app/providers';
import { getSessionUserSafe } from '@/lib/session-safe';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Toaster } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'X-STORE — Compra en vivo, Reels y ofertas cerca de ti',
  description:
    'Social Commerce inmersivo: Reels de productos, Live Shopping, Marketplace geolocalizado y pagos Yape/Plin coordinados por WhatsApp en Perú.',
  keywords: ['ecommerce', 'peru', 'reels', 'live shopping', 'marketplace', 'yape', 'plin'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'X-STORE',
  },
  openGraph: {
    title: 'X-STORE',
    description: 'El TikTok del comercio en Perú 🇵🇪',
    type: 'website',
    locale: 'es_PE',
  },
};

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesión resuelta en el servidor: define qué se muestra ANTES del login
  // (invitado) y DESPUÉS (perfil, X-Coins, pedidos) en header y bottom nav.
  const user = await getSessionUserSafe();

  return (
    <html lang="es" className="dark">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-black"
        >
          Saltar al contenido principal
        </a>

        <Providers initialUser={user}>
          <Header user={user} />

          <main id="main">{children}</main>

          <BottomNav user={user} />

          {/* Notificaciones toast (añadir al carrito, errores, etc.) */}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
