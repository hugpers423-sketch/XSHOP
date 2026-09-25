// apps/web/lib/validate.test.ts
// Unit tests — validación y sanitización (OWASP)

import { describe, it, expect } from 'vitest';
import {
  isEmail,
  isValidEmail,
  isStrongPassword,
  isPhonePE,
  isPositiveNumber,
  sanitizeHTML,
  escapeSQLString,
  passwordStrength,
  validate,
} from './validate';

describe('isEmail / isValidEmail', () => {
  it('acepta correos válidos', () => {
    expect(isEmail('test@xstore.pe')).toBe(true);
    expect(isEmail('user.name+tag@sub.domain.pe')).toBe(true);
  });

  it('rechaza correos inválidos', () => {
    expect(isEmail('sin-arroba')).toBe(false);
    expect(isEmail('@sin-local.pe')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('')).toBe(false);
    expect(isEmail(123)).toBe(false);
  });

  it('isValidEmail es alias de isEmail', () => {
    expect(isValidEmail('ok@ok.com')).toBe(true);
  });
});

describe('isStrongPassword', () => {
  it('acepta contraseña fuerte', () => {
    expect(isStrongPassword('Cl4ve!Segura')).toBe(true);
  });

  it('rechaza débiles', () => {
    expect(isStrongPassword('corta1!')).toBe(false); // < 8
    expect(isStrongPassword('allminuscules1!')).toBe(false); // sin mayúscula
    expect(isStrongPassword('SinNumeros!')).toBe(false); // sin dígito
    expect(isStrongPassword('SinSimbolo1')).toBe(false); // sin símbolo
  });
});

describe('passwordStrength', () => {
  it('scorea de 0 a 4', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('Abcdefgh1!xyz').score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength('a').score).toBe(0);
  });

  it('devuelve etiqueta en español', () => {
    expect(passwordStrength('Abcdefgh1!xyz').label).toBeTruthy();
  });
});

describe('isPhonePE', () => {
  it('acepta celulares peruanos', () => {
    expect(isPhonePE('987654321')).toBe(true);
    expect(isPhonePE('+51987654321')).toBe(true);
    expect(isPhonePE('51987654321')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(isPhonePE('12345')).toBe(false);
    expect(isPhonePE('9123456789')).toBe(false); // 9 dígitos + code
    expect(isPhonePE('')).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('valida números positivos finitos', () => {
    expect(isPositiveNumber(10)).toBe(true);
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-5)).toBe(false);
    expect(isPositiveNumber(NaN)).toBe(false);
    expect(isPositiveNumber(Infinity)).toBe(false);
  });
});

describe('sanitizeHTML (anti-XSS)', () => {
  it('escapa tags peligrosos', () => {
    const dirty = '<script>alert("xss")</script>';
    const clean = sanitizeHTML(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('&lt;script&gt;');
  });

  it('escapa comillas y slashes', () => {
    expect(sanitizeHTML(`"'</>`)).toBe('&quot;&#x27;&lt;&#x2F;&gt;');
  });
});

describe('escapeSQLString', () => {
  it('duplica comillas simples', () => {
    expect(escapeSQLString("O'Reilly")).toBe("O''Reilly");
    expect(escapeSQLString('sin comillas')).toBe('sin comillas');
  });
});

describe('validate (schema genérico)', () => {
  const schema = {
    email: { validate: isEmail, message: 'Correo inválido' },
    age: { validate: isPositiveNumber, message: 'Edad inválida' },
  };

  it('acepta payload válido', () => {
    const res = validate({ email: 'a@b.pe', age: 25 }, schema);
    expect(res.valid).toBe(true);
  });

  it('acumula errores por campo', () => {
    const res = validate({ email: 'malo', age: -1 }, schema);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.email).toBe('Correo inválido');
      expect(res.errors.age).toBe('Edad inválida');
    }
  });

  it('rechaza payloads no-objeto', () => {
    expect(validate(null, schema).valid).toBe(false);
    expect(validate('string', schema).valid).toBe(false);
  });
});
