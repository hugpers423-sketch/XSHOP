# 🛍️ X-SHOP — Super-plataforma de Social Commerce

**E-commerce + feed vertical tipo TikTok + live shopping + marketplace local + reputación**, en una sola aplicación.

> Fusión concepto: *TikTok (Reels-Commerce) + Mercado Libre (transacciones) + Facebook Marketplace (hiper-local)*.

## ⚡ Stack

| Capa | Tecnología |
|---|---|
| Frontend principal | **Next.js 15 + React 19 + TypeScript** en `apps/web` |
| Frontend histórico | Vanilla JS (ESM) + Web Components, conservado en la raíz |
| Estilos | Tailwind/CSS modular + componentes originales X-STORE |
| Routing | App Router (`apps/web/app`) + navegación pública invitado |
| Estado | Zustand para carrito + contexto Auth + fallback local realtime |
| Backend | **Express 4 + Socket.IO 4** (Node ≥ 20) — corre con `node --watch` |
| ORM / BD | **Prisma + PostgreSQL** para producción; backend local conserva SQLite |
| Auth | Sesiones opacas token (HMAC-SHA256) con expiración deslizante y rotación |
| PWA | **Instalable**: manifest `standalone` + iconos PNG + SW **solo en https** (en dev se desregistra) |
| Seguridad | CSP por **hash SHA-256** en `serve.mjs` + helmet en el backend |

## 📁 Estructura

```
X SHOP/
├── index.html                # SPA: landing + app, meta/OG/PWA completos
├── manifest.json             # PWA manifest (standalone, shortcuts, screenshots)
├── og-image.png              # Imagen social 1200×630 (Open Graph)
├── icons/                    # Iconos instalables PNG (180/192/512, generados)
├── sw.js                     # Service Worker (solo producción https)
├── serve.mjs                 # Servidor estático (:3000) CON cabeceras de seguridad
├── package.json              # Scripts: frontend / backend / db:seed
├── tools/
│   ├── generate-icons.js     # Regenera los PNG de iconos (zlib nativo, sin deps)
│   ├── verify-assets.js      # Verifica manifest/iconos/metas (exit code para CI)
│   └── api-e2e.js            # Suite E2E: API + cabeceras (40 checks, exit code)
├── styles/
│   ├── critical.css          # CSS crítico inline-blocking (LCP)
│   ├── components.css        # Componentes, bottom-nav (barra 64px)
│   └── layout.css            # Layout, feed reels, responsive
├── src/
│   ├── app.js                # Bootstrap: módulos, header, window.XShop (debug)
│   ├── core/
│   │   ├── api.js            # Fetch con auth, caché GET, reintentos
│   │   ├── router.js         # Hash router + View Transitions (carrilera anti-bloqueo)
│   │   ├── state.js          # Store reactivo (Proxy)
│   │   └── events.js         # Bus de eventos de la app
│   ├── ui/                   # Web Components: Button, Modal, Toast, Input,
│   │                         # AuthModal, Avatar, Badge, Skeleton
│   ├── modules/
│   │   ├── feed/             # Feed vertical Reels-Commerce (pool absoluto,
│   │   │                     #   scroll-snap, compra rápida, comentarios)
│   │   ├── payments/         # Tarjetas + transacciones + checkout modal
│   │   └── reputation/       # Nivel, métricas e historial
│   └── animations/           # waapi.js, scroll.js, transitions.js
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # User, Session, Card, Transaction, Post, Reputation…
│   │   └── seed.js           # Seed idempotente (usuarios demo + datos)
│   └── src/
│       ├── index.js          # Express (:3001): helmet, CORS, rate limits, sweeps
│       ├── routes/           # users, cards, transactions, posts, reputation, health
│       ├── middleware/       # auth (sesiones), validate (zod), errorHandler
│       └── utils/schemas.js  # Schemas zod de entrada
└── apps/web/                 # Aplicación Next.js integrada (frontend principal)
    ├── app/                  # Home, Reels, Live, carrito, compra y APIs
    ├── components/           # UI original, player, chat y tarjetas
    └── lib/                  # Auth, carrito, tiempo real y recomendaciones
```

## 🚀 Puesta en marcha

```bash
# 1) Dependencias del workspace
pnpm install

# 2) Backend Express + Socket.IO (:3001)
pnpm run backend

# 3) Frontend Next.js integrado (:3200)
pnpm run frontend

# 4) Verificaciones
pnpm run web:typecheck
pnpm run web:build
```

Abrir **http://localhost:3200**. El servidor vanilla histórico queda disponible con
`pnpm run frontend:legacy` (:3000) y no se mezcla con la app integrada.

Para desarrollo local, `apps/web/.env.local` apunta la API y el canal Socket.IO a
`127.0.0.1:3001`. No se debe generar APK hasta aprobar el flujo web.

Abrir **http://127.0.0.1:3000**

### 👤 Credenciales demo

| Rol | Email | Password |
|---|---|---|
| Comprador | `demo@xshop.pe` | `Demo1234!` |
| Vendedor | `vendedor@xshop.pe` | `Demo1234!` |
| Vendedor moda | `moda@xshop.pe` | `Demo1234!` |

## 🔌 API principal (`http://127.0.0.1:3001`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Salud + BD |
| Socket.IO | `/socket.io` | Presencia, chat, likes y estado de Live |
| POST | `/api/users/register` | Registro (role BUYER/SELLER) |
| POST | `/api/users/login` | Login → `{user, token, expiresAt}` |
| POST | `/api/users/logout` | Revoca la sesión actual |
| POST | `/api/users/logout-all` | Revoca **todas** las sesiones del usuario |
| POST | `/api/users/refresh` | **Rotación**: token nuevo, anterior invalidado |
| GET/PATCH | `/api/users/me` | Perfil (renueva expiración deslizante) |
| GET/POST | `/api/cards` | Tarjetas (Luhn + expiración; solo `last4` en claro) |
| GET/POST | `/api/transactions` | Pagos con **idempotencia** (`Idempotency-Key`) |
| GET | `/api/posts` | Feed (cursor) |
| POST | `/api/posts/:id/like\|comment\|share` | Interacciones |
| GET | `/api/reputation` | Reputación + `/leaderboard` |

## 👀 Modo invitado, cuenta y Live

- `/`, `/reels`, `/live`, `/catalogo` y `/cerca` son públicos: se puede ver el video y el live sin iniciar sesión.
- Los likes, comentarios, purchases, productos fijados y WhatsApp de compra piden autenticación cuando el usuario es invitado.
- El login por correo delega en el backend existente. El botón **Continuar con Google** usa OAuth 2.0 y queda listo al configurar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `apps/web/.env.local`.
- Socket.IO distribuye presencia, comentarios, reacciones y chat entre pestañas/navegadores. Sin `NEXT_PUBLIC_SOCKET_URL` la app conserva un fallback local de demostración.
- `LivePlayer` acepta una URL HLS (`.m3u8`, con HLS.js) o MP4 publicada por el vendedor. El video real requiere un proveedor RTMP/HLS/WebRTC (Mux, LiveKit o CDN); el MP4 visible en la demo es solo fallback.
- El seller puede preparar una transmisión en `/seller/live/new` con título, productos fijados y URL HLS/MP4. `apps/web/app/api/lives/route.ts` persiste el metadata, room, heartbeat y estado en PostgreSQL; si el proceso muere, el live se cierra por `LIVE_STALE_AFTER_MS`.
- El feed registra visualizaciones, tiempo visto, likes, completados y shares en `localStorage` para ordenar el siguiente “Para ti”. En producción se deben enviar eventos a un servicio de recomendación.

### Configurar Google OAuth

1. Crear un cliente OAuth Web en Google Cloud.
2. Autorizar redirect URI `http://localhost:3200/api/auth/google/callback` para desarrollo.
3. Añadir `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` a `apps/web/.env.local`.
4. Reiniciar `pnpm run frontend` y probar **Continuar con Google**. La callback valida `state`, no persiste el access token y sincroniza `googleSub`, correo y rol en PostgreSQL.

### Configurar LiveKit

LiveKit es el proveedor principal para la publicación pública:

1. Crear un proyecto en LiveKit Cloud o self-hosted.
2. Copiar `API Key`, `API Secret` y la URL WebSocket (`wss://...`).
3. Añadir en `apps/web/.env.local`:

```env
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
```

Con estas variables, el estudio se conecta a una sala LiveKit, publica cámara/micrófono y los
compradores reciben la pista multimedia. Sin ellas, la app conserva el fallback WebRTC local para
poder desarrollar sin credenciales.

## 🏗️ Production: PostgreSQL, Redis, HTTPS y Yape/WhatsApp

- `apps/web/app/api/lives/route.ts` usa Prisma/PostgreSQL, heartbeat y cierre de lives huérfanos.
- `apps/web/app/api/orders/route.ts` calcula el total en servidor, crea `Order` + `Transaction`, aplica `Idempotency-Key` y genera el enlace `wa.me` para Yape/Plin/transferencia.
- `backend/src/index.js` activa el adaptador oficial Socket.IO → Redis cuando `REDIS_URL` está disponible; `REDIS_REQUIRED=true` hace fallar el arranque si Redis no responde.
- `infra/Caddyfile` termina TLS automáticamente con Caddy cuando `XSHOP_DOMAIN` apunta al servidor.
- `docs/production-deployment.md` contiene la secuencia de despliegue, OAuth, DNS, migraciones y checklist.

Yape no se trata como un cobro de tarjeta dentro del navegador: el pedido queda persistido y el
pago se valida por WhatsApp con una cuenta de soporte autorizada. Nunca se almacenan PAN, CVC ni
claves de Yape.

## 📱 Móvil — app nativa (M1–M5 + acabado)

- **Bottom-nav patrón app**: barra fija `--mnav-h: 64px` (53 + 6 + 4 + 1 exacto), paneles con `100dvh`, safe-areas `env()` en todos los consumidores → **0 px de solape** con feed/pagos/comentarios/toasts
- `.app-header` sin `backdrop-filter` en ≤640px (evita que el `fixed` se ancle al header)
- **Anti auto-zoom iOS**: `input/textarea/select` a 16px · `overscroll-behavior-y: contain` (sin pull-to-refresh fantasma dentro del app)
- **Instalable**: iconos PNG reales (Chrome **rechaza** los `data:` URI de manifest e iOS ignora SVG) · `apple-touch-icon` 180 · metas `apple-mobile-web-app-capable/-title/status-bar-style` · `theme-color` unificado `#0a0a0a` (manifest == meta == fondo) · `screenshots` poblado con la og-image
- Iconos **reproducibles sin dependencias** (`tools/generate-icons.js`, zlib nativo) y **auditables** (`tools/verify-assets.js`)

## 🔐 Seguridad (Fase 2 + D — suite automatizada 40/40)

- **Rate limits**: global 300/15min · **login 10/min** (anti fuerza bruta) · registro 15/15min · **pagos 30/15min por usuario**
- **Sesiones avanzadas**: token opaco guardado como **HMAC-SHA256** · expiración deslizante 30d con `lastUsedAt` · **rotación** (`/refresh`) · revocación total (`/logout`, `/logout-all`) · tope de 10 sesiones concurrentes · barrido de caducadas cada 6h
- **Pagos**: **idempotencia** con clave única por pedido (body o header `Idempotency-Key`) · el total se recalcula desde PostgreSQL · Yape/Plin/transferencia se coordinan por WhatsApp y el estado solo lo valida soporte/admin · no se guardan PAN/CVC. La ruta legacy de tarjetas queda aislada para migración.
- **Login timing-safe**: hash ficticio cuando el email no existe (sin enumeración de usuarios)
- Validación **zod** en todas las rutas · `helmet` + CORS de orígenes · `X-Powered-By` deshabilitado · sin PAN ni CVC en claro (solo `last4` + marca)
- **Cabeceras frontend (:3000)** — `serve.mjs`: **CSP con `script-src` por hash SHA-256** del script de arranque (sin `unsafe-inline`) + `frame-ancestors`/`X-Frame-Options` anti-clickjacking + `Referrer-Policy` + `Permissions-Policy` + COOP/CORP/nosniff · hashes recalculados al arrancar desde `index.html` · la suite exige coherencia hash↔HTML servido
- **Cabeceras backend (:3001)**: helmet + `Permissions-Policy` + **`Cache-Control: no-store`** (los proxies no memorizan tokens/PII)

## ⚙️ Rendimiento y accesibilidad

- Objetivos: **LCP < 2.5 s · INP < 200 ms · CLS < 0.1** (CSS crítico inline, CSS secundario con `media="print"` swap)
- Animaciones WAAPI con **carrileras de seguridad**: ninguna transición de estado depende de que la animación complete (pestaña oculta ⇒ la timeline pausa; modales/sheets/toasts se cierran igual)
- Sin cross-document View Transitions (`@view-transition navigation` eliminado: su rechazo es incontenible desde el JS de la página ⇒ AbortError silencioso)
- A11y: skip-link, `aria-live` en toasts, `focus-visible`, `prefers-reduced-motion`, contraste oscuro WCAG

## ✅ Estado de pruebas

- **API E2E automatizada** (`node tools/api-e2e.js`): **40/40** — sesión completa (login → rotación → revocación → logout con cero residuos), validaciones zod, posts con cascade `ON DELETE`, Luhn/expiración, **idempotencia real** (misma key ⇒ mismo id ignorando el monto nuevo), reputación, cabeceras de ambos servidores y CORS
- **Assets PWA** (`node tools/verify-assets.js`): verde — JSON válido, firma PNG real, IHDR == declarado, metas 4/4
- **Browser E2E**: login por clic real (`<x-button>`), compra rápida end-to-end (tx→S/4.899), comentarios + cierre con ESC, revocación de sesión al hacer logout, 0 errores de consola
- **Lighthouse (#landing)**: accesibilidad **1** · mejores prácticas **1** · SEO **1** (`failures: []`)

- **Next.js integrado**: `pnpm run web:typecheck` y `pnpm run web:build` completan correctamente; Reels y Live reproducen sin `MEDIA_ELEMENT_ERROR`.
- **Realtime local**: dos clientes Socket.IO reciben presencia, likes y comentarios del mismo `streamId`; el remitente no duplica su propio comentario.
- **APK**: deliberadamente pendiente hasta que la web integrada sea aprobada por el usuario.

---
*Comentarios de código en español · el backend es intercambiable a PostgreSQL cambiando el `datasource` de Prisma.*
