// apps/web/lib/session-safe.ts
import "server-only";
import { getSessionUser, type AuthUser } from "@/lib/auth";

/**
 * getSessionUser a prueba de fallos para el layout raíz:
 * si la base de datos no responde, tratamos al usuario como invitado
 * en lugar de romper el render de todas las páginas (disponibilidad > frescura).
 */
export async function getSessionUserSafe(): Promise<AuthUser | null> {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
}
