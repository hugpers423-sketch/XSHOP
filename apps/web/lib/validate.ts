// apps/web/lib/validate.ts
// Validación de entrada tipo-Zod minimal (sin dependencias extra)

type Rule<T> = {
  validate: (v: unknown) => v is T;
  message: string;
};

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

export function isStrongPassword(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length >= 8 &&
    /[A-Z]/.test(v) &&
    /[a-z]/.test(v) &&
    /\d/.test(v) &&
    /[^A-Za-z0-9]/.test(v)
  );
}

// Alias semántico para rutas API/páginas
export const isValidEmail = isEmail;

// Evaluación de fuerza de contraseña (0–4) con etiqueta y color para UI
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Muy débil' | 'Débil' | 'Aceptable' | 'Fuerte' | 'Excelente';
  color: string; // clase Tailwind para la barra de progreso
}

export function passwordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) score++;

  const labels: PasswordStrength['label'][] = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-[#00E7A5]', 'bg-emerald-400'];
  return {
    score: score as PasswordStrength['score'],
    label: labels[score],
    color: colors[score],
  };
}

export function isPhonePE(v: unknown): v is string {
  return typeof v === 'string' && /^(\+51|51)?9\d{8}$/.test(v.replace(/\s/g, ''));
}

export function isNonEmptyString(max = 500) {
  return (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

// Sanitización anti-XSS
export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Prevenir inyección de SQL (parámetros — no concatenar queries)
export function escapeSQLString(input: string): string {
  return input.replace(/'/g, "''");
}

// Validador de objeto genérico
export function validate<T extends Record<string, unknown>>(
  data: unknown,
  schema: { [K in keyof T]: Rule<T[K]> }
): { valid: true; data: T } | { valid: false; errors: Record<string, string> } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: { _: 'Payload inválido' } };
  }

  const errors: Record<string, string> = {};
  const result = {} as T;

  for (const [key, rule] of Object.entries(schema)) {
    const value = (data as Record<string, unknown>)[key];
    if (rule.validate(value)) {
      (result as Record<string, unknown>)[key] = value;
    } else {
      errors[key] = rule.message;
    }
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true, data: result };
}
