#!/usr/bin/env node
// tools/api-e2e.js — Suite automatizada E2E: API del backend (:3001) +
// cabeceras de seguridad de ambos servidores. Sin dependencias (fetch nativo).
// Uso: node tools/api-e2e.js   → exit 0 solo si TODOS los checks pasan.
//
// Diseño de sesión (reglas duras):
//  · Máximo 2 POST /login por ejecución (rate limit 10/min/IP).
//  · Las sesiones que abre las cierra (refresh → logout) para NO acumular
//    sesiones del vendedor: el backend toma 10 por usuario y el podador
//    descartaría las más viejas —incluida la sesión viva del navegador.
//  · Registro duplicado/inválido no crea sesiones (fallan antes).
//  · Limpieza de la tarjeta de prueba antes del logout final.

const WEB = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:3001';
const CREDS = { email: 'vendedor@xshop.pe', password: 'Demo1234!' };
const ts = Date.now();

let pasados = 0;
const fallos = [];
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function check(nombre, cond, extra = '') {
  if (cond) {
    pasados++;
    console.log('✔', nombre);
  } else {
    fallos.push(nombre + (extra ? ` — ${extra}` : ''));
    console.error('✖', nombre, extra || '');
  }
}

// Cliente mínimo: devuelve { status, cuerpo, headers } (cuerpo null si no es JSON)
async function llamar(metodo, ruta, opts = {}) {
  const url = ruta.startsWith('http') ? ruta : API + ruta;
  const h = { ...(opts.headers || {}) };
  if (opts.token) h['Authorization'] = `Bearer ${opts.token}`;
  if (opts.json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(url, {
    method: metodo,
    headers: h,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined
  });
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch { /* respuesta sin JSON */ }
  return { status: r.status, cuerpo, headers: r.headers };
}

async function main() {
  // ── 1. Salud del sistema ──────────────────────────────────────────
  const s1 = await llamar('GET', '/api/health');
  check('S01 salud: 200 + BD healthy',
    s1.status === 200 && s1.cuerpo?.status === 'ok' && s1.cuerpo?.database === 'healthy',
    `status=${s1.status} db=${s1.cuerpo?.database}`);

  // ── 2. Autenticación y ciclo de vida de sesión ────────────────────
  const login = await llamar('POST', '/api/users/login', { json: CREDS });
  const T1 = login.cuerpo?.token;
  check('S02 login: 200 + token firme + sin passwordHash + expiresAt futuro',
    login.status === 200 && typeof T1 === 'string' && T1.length >= 32 &&
    login.cuerpo?.user?.email === CREDS.email &&
    !('passwordHash' in (login.cuerpo?.user || {})) &&
    new Date(login.cuerpo?.expiresAt) > new Date(),
    `status=${login.status} tokenLen=${T1?.length}`);

  if (!T2Valido(T1)) {
    // Sin token no hay bloque autenticado: abortar con diagnóstico claro
    fallos.push('ABORTADO: login/refresh sin token (¿rate limit 10/min?)');
    return;
  }

  const me1 = await llamar('GET', '/api/users/me', { token: T1 });
  check('S03 /me con token: 200 + usuario + rol',
    me1.status === 200 && me1.cuerpo?.user?.email === CREDS.email && typeof me1.cuerpo?.user?.role === 'string');

  const meSin = await llamar('GET', '/api/users/me');
  check('S04 /me sin token: 401 UNAUTHORIZED',
    meSin.status === 401 && meSin.cuerpo?.code === 'UNAUTHORIZED');

  const meMalo = await llamar('GET', '/api/users/me', { token: 'token-basura-e2e-0123456789' });
  check('S05 /me token inválido (HMAC no coincide): 401', meMalo.status === 401);

  const loginMalo = await llamar('POST', '/api/users/login',
    { json: { email: CREDS.email, password: 'PasswordMalo1!' } });
  check('S06 login contraseña incorrecta: 401 INVALID_CREDENTIALS',
    loginMalo.status === 401 && loginMalo.cuerpo?.code === 'INVALID_CREDENTIALS');

  // Rotación: canjea T1 por T2 y revoca T1 (ventana de uso de token robado)
  const rot = await llamar('POST', '/api/users/refresh', { token: T1 });
  const T2 = rot.cuerpo?.token;
  check('S07 refresh rota el token (T2 ≠ T1)',
    rot.status === 200 && typeof T2 === 'string' && T2 !== T1);

  const meViejo = await llamar('GET', '/api/users/me', { token: T1 });
  check('S08 token antiguo revocado tras refresh: 401', meViejo.status === 401);

  const meNuevo = await llamar('GET', '/api/users/me', { token: T2 });
  check('S09 token nuevo válido: 200',
    meNuevo.status === 200 && meNuevo.cuerpo?.user?.email === CREDS.email);

  if (!T2) {
    fallos.push('ABORTADO: refresh no devolvió token');
    return;
  }

  // ── 3. Validaciones de entrada (Zod) ──────────────────────────────
  const dup = await llamar('POST', '/api/users/register',
    { json: { email: CREDS.email, name: 'QA Duplicado', password: 'Demo1234!' } });
  check('S10 registro email duplicado: 409 DUPLICATE_USER',
    dup.status === 409 && dup.cuerpo?.code === 'DUPLICATE_USER');

  const inv = await llamar('POST', '/api/users/register',
    { json: { email: 'no-es-email', name: 'QA', password: 'Demo1234!' } });
  check('S11 registro email inválido: 400 + detalle de campo',
    inv.status === 400 && inv.cuerpo?.code === 'VALIDATION_ERROR' && !!inv.cuerpo?.details?.email);

  // ── 4. Posts: feed, interacción y cascade ─────────────────────────
  const lista = await llamar('GET', '/api/posts?limit=5', { token: T2 });
  check('S12 listado posts: 200 + contadores + nextCursor',
    lista.status === 200 && Array.isArray(lista.cuerpo?.data) &&
    (lista.cuerpo.data.length === 0 ||
      ('likesCount' in lista.cuerpo.data[0] && 'commentsCount' in lista.cuerpo.data[0])) &&
    'nextCursor' in (lista.cuerpo || {}),
    `status=${lista.status} n=${lista.cuerpo?.data?.length}`);

  const creado = await llamar('POST', '/api/posts',
    { token: T2, json: { type: 'IMAGE', content: `QA e2e ${ts}` } });
  const pid = creado.cuerpo?.id;
  check('S13 crear post: 201 + contadores en cero',
    creado.status === 201 && typeof pid === 'string' && creado.cuerpo?.likesCount === 0,
    `status=${creado.status}`);

  if (pid) {
    const like1 = await llamar('POST', `/api/posts/${pid}/like`, { token: T2 });
    const like2 = await llamar('POST', `/api/posts/${pid}/like`, { token: T2 });
    check('S14 like alterna true/false',
      like1.status === 200 && like1.cuerpo?.liked === true && like2.cuerpo?.liked === false);

    const coment = await llamar('POST', `/api/posts/${pid}/comment`,
      { token: T2, json: { postId: pid, content: 'Comentario de la suite e2e' } });
    check('S15 comentar: 201 + autor', coment.status === 201 && !!coment.cuerpo?.user?.name);

    const comps = await llamar('GET', `/api/posts/${pid}/comments`, { token: T2 });
    check('S16 listar comentarios: 200 + total ≥1 + contenido',
      comps.status === 200 && (comps.cuerpo?.pagination?.total ?? 0) >= 1 &&
      String(comps.cuerpo?.data?.[0]?.content || '').includes('suite e2e'));

    const sh1 = await llamar('POST', `/api/posts/${pid}/share`, { token: T2 });
    const sh2 = await llamar('POST', `/api/posts/${pid}/share`, { token: T2 });
    check('S17 compartir + repetir: {shared:true} y 409 ALREADY_SHARED',
      sh1.cuerpo?.shared === true && sh2.status === 409 && sh2.cuerpo?.code === 'ALREADY_SHARED');

    // Borra el post CON sus comentarios/likes → valida ON DELETE CASCADE
    const bor = await llamar('DELETE', `/api/posts/${pid}`, { token: T2 });
    check('S18 borrar post con comentarios: 200 (cascade OK)',
      bor.status === 200 && bor.cuerpo?.success === true, `status=${bor.status}`);
  } else {
    check('S14-S18 bloque de interacción (omitido por S13)', false);
  }

  const postMalo = await llamar('POST', '/api/posts',
    { token: T2, json: { type: 'NOPE', content: 'x' } });
  check('S19 post con type inválido: 400 VALIDATION_ERROR',
    postMalo.status === 400 && postMalo.cuerpo?.code === 'VALIDATION_ERROR');

  const qMala = await llamar('GET', '/api/posts?limit=999', { token: T2 });
  check('S20 query limit fuera de rango (max 50): 400',
    qMala.status === 400 && qMala.cuerpo?.code === 'VALIDATION_ERROR');

  const noExiste = await llamar('GET', '/api/ruta-que-no-existe');
  check('S21 ruta API inexistente: 404 con JSON de error',
    noExiste.status === 404 && typeof noExiste.cuerpo?.error === 'string');

  // ── 5. Tarjetas: Luhn, enmascarado, sin datos sensibles ───────────
  const tarjeta = await llamar('POST', '/api/cards',
    { token: T2, json: { number: '4111111111111111', expiry: '12/30', cvc: '123', holderName: 'QA E2E' } });
  const cid = tarjeta.cuerpo?.id;
  check('S22 crear tarjeta Visa (Luhn OK): 201 enmascarada + brand',
    tarjeta.status === 201 && tarjeta.cuerpo?.brand === 'visa' &&
    tarjeta.cuerpo?.last4 === '1111' && String(tarjeta.cuerpo?.number || '').startsWith('****'),
    `status=${tarjeta.status}`);

  const listaT = await llamar('GET', '/api/cards', { token: T2 });
  const bruto = JSON.stringify(listaT.cuerpo || null);
  check('S23 listado tarjetas SIN sensibles (ni cvc ni PAN completo)',
    listaT.status === 200 && !bruto.includes('"cvc"') && !/\b\d{13,19}\b/.test(bruto),
    bruto.includes('"cvc"') ? 'filtra cvc' : 'aparece un PAN de 13-19 dígitos');

  const luhnMalo = await llamar('POST', '/api/cards',
    { token: T2, json: { number: '4111111111111112', expiry: '12/30', cvc: '123', holderName: 'QA' } });
  check('S24 número Luhn inválido: 400 INVALID_CARD',
    luhnMalo.status === 400 && luhnMalo.cuerpo?.code === 'INVALID_CARD');

  const exp = await llamar('POST', '/api/cards',
    { token: T2, json: { number: '4111111111111111', expiry: '01/20', cvc: '123', holderName: 'QA' } });
  check('S25 tarjeta expirada al crearla: 400 CARD_EXPIRED',
    exp.status === 400 && exp.cuerpo?.code === 'CARD_EXPIRED');

  // ── 6. Transacciones: monto PEN + idempotencia real ───────────────
  const keyIdem = `e2e-${ts}-0001`;
  const tx1 = await llamar('POST', '/api/transactions',
    { token: T2, json: { amount: 50.5, description: 'Cobro suite e2e', cardId: cid, provider: 'manual', idempotencyKey: keyIdem } });
  check('S26 crear transacción: 201 PROCESSING + amount en PEN (50.5)',
    tx1.status === 201 && tx1.cuerpo?.status === 'PROCESSING' && tx1.cuerpo?.amount === 50.5,
    `status=${tx1.status} amount=${tx1.cuerpo?.amount}`);

  // Reintento con la MISMA key pero monto distinto: debe devolver la original
  const tx2 = await llamar('POST', '/api/transactions',
    { token: T2, json: { amount: 999.99, description: 'Reintento suite e2e', cardId: cid, idempotencyKey: keyIdem } });
  check('S27 idempotencia: misma key ⇒ misma transacción (ignora monto nuevo)',
    tx2.status === 200 && typeof tx1.cuerpo?.id === 'string' &&
    tx2.cuerpo?.id === tx1.cuerpo?.id && tx2.cuerpo?.idempotent === true &&
    tx2.cuerpo?.amount === 50.5,
    `status=${tx2.status} igualId=${tx2.cuerpo?.id === tx1.cuerpo?.id}`);

  const txs = await llamar('GET', '/api/transactions', { token: T2 });
  check('S28 historial transacciones: 200 + paginación',
    txs.status === 200 && Array.isArray(txs.cuerpo?.data) && 'pagination' in (txs.cuerpo || {}));

  // El mock del proveedor resuelve a 1.5s (APPROVED/DECLINED con 5% rechazo)
  await dormir(1800);
  const txFin = await llamar('GET', `/api/transactions/${tx1.cuerpo?.id}`, { token: T2 });
  check('S29 transacción resuelta fuera de PROCESSING',
    txFin.status === 200 && ['APPROVED', 'DECLINED'].includes(txFin.cuerpo?.status),
    `status=${txFin.cuerpo?.status}`);

  // ── 7. Reputación ─────────────────────────────────────────────────
  const rep = await llamar('GET', '/api/reputation', { token: T2 });
  check('S30 reputación propia: 200 + nivel + color de nivel',
    rep.status === 200 && typeof rep.cuerpo?.level === 'string' && !!rep.cuerpo?.levelColor?.bg);

  const lb = await llamar('GET', '/api/reputation/leaderboard?limit=5', { token: T2 });
  check('S31 leaderboard: 200 + paginación',
    lb.status === 200 && Array.isArray(lb.cuerpo?.data) && 'pagination' in (lb.cuerpo || {}));

  // ── 8. Limpieza de la tarjeta (antes del logout) ──────────────────
  if (cid) {
    const del = await llamar('DELETE', `/api/cards/${cid}`, { token: T2 });
    // Si fuera la única, el backend exige conservarla (MIN_CARDS): se tolera
    check('S32 limpieza: tarjeta de prueba borrada (o MIN_CARDS)',
      del.status === 200 || del.cuerpo?.code === 'MIN_CARDS',
      `status=${del.status}`);
  }

  // ── 9. Logout revoca la sesión ────────────────────────────────────
  const out = await llamar('POST', '/api/users/logout', { token: T2 });
  const meOut = await llamar('GET', '/api/users/me', { token: T2 });
  check('S33 logout: 200 y /me posterior → 401 (sesión cerrada, cero residuos)',
    out.status === 200 && meOut.status === 401);

  // ── 10. Cabeceras de seguridad — frontend (:3000) ─────────────────
  const wf = await fetch(WEB + '/');
  const html = await wf.text();
  const csp = wf.headers.get('content-security-policy') || '';
  check('S34 frontend: CSP con frame-ancestors + script-src con hash',
    csp.includes("frame-ancestors 'self'") && /script-src 'self' 'sha256-/.test(csp),
    csp ? 'CSP presente pero incompleta' : 'sin cabecera CSP');

  check('S35 frontend: anti-clickjacking + hardening completo',
    wf.headers.get('x-content-type-options') === 'nosniff' &&
    (wf.headers.get('x-frame-options') || '') === 'SAMEORIGIN' &&
    !!wf.headers.get('referrer-policy') &&
    (wf.headers.get('permissions-policy') || '').includes('camera=()') &&
    (wf.headers.get('cross-origin-opener-policy') || '') === 'same-origin');

  // Coherencia: recalcular los hashes desde el HTML SERVIDO y exigir que
  // todos aparezcan en la CSP (tras editar el inline sin reiniciar, truena)
  const { createHash } = require('node:crypto');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const hs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    hs.push(createHash('sha256').update(m[1], 'utf8').digest('base64'));
  }
  check('S36 frontend: hashes CSP coherentes con index.html servido',
    hs.length >= 1 && hs.every(h => csp.includes(`'sha256-${h}'`)),
    `inline=${hs.length} presenteEnCsp=${hs.filter(h => csp.includes(h)).length}`);

  const mf = await fetch(WEB + '/manifest.json');
  check('S37 manifest servido con MIME application/manifest+json',
    mf.status === 200 && (mf.headers.get('content-type') || '').includes('manifest+json'));

  const ico = await fetch(WEB + '/icons/icon-192.png');
  check('S38 icono PNG servido: 200 image/png',
    ico.status === 200 && (ico.headers.get('content-type') || '').includes('image/png'));

  // ── 11. Cabeceras de seguridad — backend (:3001) ──────────────────
  const hb = await fetch(API + '/api/health');
  check('S39 backend: helmet + Permissions-Policy + no-store + sin x-powered-by',
    hb.headers.get('x-content-type-options') === 'nosniff' &&
    (hb.headers.get('x-frame-options') || '') === 'SAMEORIGIN' &&
    !!hb.headers.get('referrer-policy') &&
    (hb.headers.get('permissions-policy') || '').includes('camera=()') &&
    (hb.headers.get('cache-control') || '').includes('no-store') &&
    !hb.headers.get('x-powered-by'),
    `pp=${hb.headers.get('permissions-policy') ? 'ok' : 'ausente'} cc=${hb.headers.get('cache-control')}`);

  const pre = await fetch(API + '/api/health', {
    method: 'OPTIONS',
    headers: { Origin: WEB, 'Access-Control-Request-Method': 'GET' }
  });
  check('S40 CORS preflight acepta el origen del frontend',
    (pre.status === 204 || pre.status === 200) &&
    (pre.headers.get('access-control-allow-origin') || '').includes('127.0.0.1:3000'),
    `status=${pre.status} acao=${pre.headers.get('access-control-allow-origin')}`);
}

// Guard para el flujo inicial fuera de main (evita usar T1 sin validar)
function T2Valido(t) { return typeof t === 'string' && t.length >= 32; }

main()
  .catch(err => {
    fallos.push(`ERROR INESPERADO: ${err.message}`);
    console.error('✖ ERROR INESPERADO:', err);
  })
  .finally(() => {
    const total = pasados + fallos.length;
    console.log(`\n${'─'.repeat(58)}`);
    console.log(`RESULTADO: ${pasados}/${total} checks OK`);
    if (fallos.length) {
      console.log('FALLOS:');
      for (const f of fallos) console.log('  ✖', f);
      process.exitCode = 1;
    } else {
      console.log('✅ SUITE COMPLETA EN VERDE');
    }
  });
