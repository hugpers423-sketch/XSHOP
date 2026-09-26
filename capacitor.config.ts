import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * App Android de X-STORE.
 *
 * La APK es un contenedor WebView que carga la app real (Next.js) desde la URL
 * pública. Esto evita un export estático —imposible aquí por cookies de sesión,
 * rutas /api/* y streaming de video— y hace que el APK siempre muestre la
 * versión vigente sin tener que recompilar por cada cambio.
 *
 * `webDir` solo contiene la pantalla de arranque sin conexión: si el servidor
 * no responde, el usuario ve un mensaje claro en vez de una pantalla en blanco.
 */
const SERVER_URL = process.env.CAPACITOR_SERVER_URL || 'https://crearsoft.taile07cfb.ts.net';
const SERVER_HOST = new URL(SERVER_URL).host;
const KEYSTORE_PATH = path.resolve(__dirname, 'release-key.keystore');

const config: CapacitorConfig = {
  appId: 'com.xshop.app',
  appName: 'X-STORE',
  webDir: 'mobile',
  server: {
    url: SERVER_URL,
    // Sin esquema http: la app necesita contexto seguro para cámara, micrófono,
    // service worker y cookies de sesión.
    cleartext: false,

    // Si el servidor no responde, Capacitor navega a esta ruta local en vez de
    // mostrar la pantalla de error cruda de Chromium. Es el "index.html" de
    // webDir, que muestra la pantalla de reconexión de X-STORE.
    errorPath: 'index.html',

    // Necesario para que la pantalla de reconexion pueda volver a la app web
    // sin que Capacitor la abra en el navegador del sistema.
    allowNavigation: [SERVER_HOST],
  },
  android: {
    // La firma de release solo se configura si existe el keystore local.
    // Nunca se sube al repositorio (ver .gitignore).
    ...(existsSync(KEYSTORE_PATH)
      ? {
          buildOptions: {
            keystorePath: 'release-key.keystore',
            keystorePassword: process.env.KEYSTORE_PASSWORD || '',
            keyAlias: 'xshop',
            keyPassword: process.env.KEY_PASSWORD || '',
          },
        }
      : {}),
  },
};

export default config;
