# Despliegue production de X-STORE

Este documento convierte la instalación local en una topología production con HTTPS automático, PostgreSQL, Redis y pagos coordinados por WhatsApp.

## 1. DNS y HTTPS

1. Reserva un dominio, por ejemplo `app.tudominio.pe`.
2. Crea un registro `A`/`AAAA` apuntando al servidor.
3. Define `XSHOP_DOMAIN=app.tudominio.pe` y `XSHOP_EMAIL=ops@tudominio.pe`.
4. Usa `infra/Caddyfile` como proxy inverso. Caddy obtiene y renueva el certificado TLS automáticamente.
5. No sirvas el frontend por HTTP fuera de localhost.

Variables HTTPS recomendadas:

```env
NODE_ENV=production
XSHOP_DOMAIN=app.tudominio.pe
XSHOP_EMAIL=ops@tudominio.pe
BACKEND_UPSTREAM=backend:3001
WEB_UPSTREAM=web:3200
```

## 2. Variables obligatorias

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://:...
SESSION_SECRET=<64+ caracteres aleatorios>
AUTH_API_URL=https://api.tudominio.pe
NEXT_PUBLIC_APP_URL=https://app.tudominio.pe
NEXT_PUBLIC_SOCKET_URL=https://api.tudominio.pe
WHATSAPP_SUPPORT_PHONE=519...
NEXT_PUBLIC_WHATSAPP_SUPPORT_PHONE=519...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://app.tudominio.pe/api/auth/google/callback
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://...
NEXT_PUBLIC_LIVEKIT_URL=wss://...
```

Los secretos se configuran en el gestor de secretos del proveedor de despliegue. No se suben al repositorio ni se exponen con variables `NEXT_PUBLIC_*`.

## 3. Base de datos y migraciones

En el servidor:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed:production  # solo catálogo/demo; no ejecutar en una base productive real
```

Para una base creada previamente con `prisma db push`, establezca el baseline una sola vez después de verificar el esquema:

```bash
pnpm exec prisma migrate resolve --applied 20260924210000_baseline
pnpm exec prisma migrate resolve --applied 20260924220000_production_core
```

La migración crea `LiveStream`, identidad Google, `idempotencyKey` de pedidos y sus índices. Los lives tienen heartbeat; una instancia que muere deja de mostrarse después de `LIVE_STALE_AFTER_MS`.

## 4. Redis

Redis es obligatorio para varias instancias. `backend/src/index.js` conecta el adaptador oficial de Socket.IO cuando `REDIS_URL` está definido. En producción se recomienda:

```env
REDIS_REQUIRED=true
```

El endpoint `/api/health` informa `redis: healthy|degraded`. En una sola instancia se puede tolerar `degraded`; en producción con varias réplicas debe ser `healthy`.

## 5. Google OAuth

En Google Cloud Console:

- Tipo de cliente: **Web application**.
- URI de redirección exactamente igual a `GOOGLE_REDIRECT_URI`.
- origins JavaScript: `NEXT_PUBLIC_APP_URL`.
- Correo de soporte: el correo de operations.

La callback valida `state`, llama a token/userinfo y sincroniza el usuario en PostgreSQL. Nunca se almacena el access token de Google.

## 6. Yape/WhatsApp

Yape no se integra como un cargo de tarjeta dentro de la web: el flujo soportado es **pedido persistido → WhatsApp → verificación de soporte → estado pagable**. Esto evita guardar datos sensibles y funciona con Yape/Plin/transferencia mientras no exista un contrato merchant API oficial para la cuenta.

1. El comprador confirma dirección y método.
2. La API calcula el total en PostgreSQL y crea `Order` + `Transaction(PENDING)`.
3. La UI abre un enlace `wa.me` generado por el servidor.
4. Soporte valida el comprobante y actualiza `paymentStatus=COMPLETED` mediante una cuenta autorizada.
5. El vendedor marca `SHIPPED`; el comprador/ soporte marca `DELIVERED`.

No se aceptar PAN, CVC, claves Yape ni capturas como campos de tarjeta. Las pruebas de comprobante deben usar un endpoint administrativo protegido y almacenamiento privado.

## 7. Checklist de salida

- [ ] `pnpm db:deploy` sin errores
- [ ] `pnpm run web:typecheck`
- [ ] `pnpm run web:build`
- [ ] `/api/health` devuelve PostgreSQL y Redis healthy
- [ ] `/api/livekit/token` devuelve 200
- [ ] Login Google completes desde el dominio HTTPS
- [ ] LiveKit publica y reproduce con HTTPS
- [ ] Un buyer anónimo puede ver live, pero no crear/pedir
- [ ] Order sobrevive a reinicios y no duplica con `Idempotency-Key`
- [ ] WhatsApp abre con el número correcto
- [ ] No se generan APK hasta aprobación de la web

## 8. Demo local y APK (túnel Tailscale)

La APK es un contenedor WebView que carga la app real desde la URL pública.
No es una copia autonomous: necesita que el servidor responda.

### Servidor: usar build de producción, nunca `next dev`

Con `next dev` cada ruta se compila en la primera peticion. Medido a traves
del tunel publico: `/reels` tardaba **90 s o mas** y el WebView del telefono
abandonaba la carga, mostrando la pantalla de "Sin conexion" aunque el servidor
estuviera bien. Con el build de produccion la misma ruta responde en **0.13 s**.

```bash
# 1) compilar con las variables publicas ya fijadas
$env:NEXT_PUBLIC_SOCKET_URL='https://crearsoft.taile07cfb.ts.net:8443'
$env:NEXT_PUBLIC_APP_URL='https://crearsoft.taile07cfb.ts.net'
$env:GOOGLE_REDIRECT_URI='https://crearsoft.taile07cfb.ts.net/api/auth/google/callback'
pnpm run build

# 2) servir la build (NO next dev)
pnpm run web:serve
```

No se deben ejecutar `next dev` y `next build` a la vez: comparten la carpeta
`.next` y el dev queda sirviendo bundles viejos.

### Comportamiento sin conexion

`server.errorPath` en `capacitor.config.ts` hace que Capacitor muestre
`mobile/index.html` (pantalla de marca) en vez de la pagina de error de
Chromium. `allowNavigation` evita que esa pantalla abra el navegador del
sistema al reintentar. La pantalla NO reintenta sola en bucle: solo al pulsar
el boton o cuando el dispositivo recupera la red.

### Limitacion conocida

Si la computadora que aloja el servidor esta apagada, la APK muestra "Sin
conexion". Para que la APK funcione sin esta PC hace falta desplegar web +
backend + PostgreSQL + Redis en un hosting siempre activo (ver `render.yaml`).
