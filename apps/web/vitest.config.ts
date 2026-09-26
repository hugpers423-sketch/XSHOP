// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Las pruebas usan los mismos alias que la app (@/lib/... , @/components/...).
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],

    // El default de vitest son 5000 ms por prueba. En esta maquina la
    // recoleccion de modulos puede tardar mas de un minuto cuando hay otros
    // procesos competing (dev server, emulador, tunnel), lo que hacia fallar
    // pruebas que son correctas. Margen holgado: estas pruebas no hacen red.
    testTimeout: 30000,
    hookTimeout: 30000,

    // Salida compacta: menos ruido en consola al correr la suite.
    reporters: 'dot',
  },
});
