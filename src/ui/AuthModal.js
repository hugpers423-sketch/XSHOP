// src/ui/AuthModal.js — Modal de login/registro con pestañas
import './Button.js'; // Garantiza customElements.define('x-button') antes de crear templates
import { createModal } from './Modal.js';
import { hslTextColor } from './Avatar.js';
import { api } from '../core/api.js';
import { store } from '../core/state.js';
import { events, AppEvents } from '../core/events.js';
import { toast } from './Toast.js';

export function openAuthModal(mode = 'login') {
  const modal = createModal({ title: '', size: 'md' });

  modal.innerHTML = `
    <style>
      .auth-tabs { display: flex; border-bottom: 1px solid var(--color-border); margin-bottom: var(--spacing-lg); }
      .auth-tab { flex: 1; padding: var(--spacing-md); background: none; border: none; color: var(--color-text-muted); font-weight: var(--font-semibold); cursor: pointer; position: relative; }
      .auth-tab.active { color: var(--color-primary); }
      .auth-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--color-primary); }
      .auth-form { display: none; }
      .auth-form.active { display: block; animation: fadeIn 0.2s ease; }
      .form-row { display: grid; gap: var(--spacing-md); }
      @media (min-width: 480px) { .form-row { grid-template-columns: 1fr 1fr; } }
      .auth-footer { text-align: center; margin-top: var(--spacing-lg); color: var(--color-text-muted); font-size: var(--text-sm); }
      .auth-footer a { color: var(--color-primary); font-weight: var(--font-medium); }
      .divider { display: flex; align-items: center; gap: var(--spacing-md); margin: var(--spacing-lg) 0; color: var(--color-text-subtle); font-size: var(--text-sm); }
      .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
      .social-buttons { display: flex; gap: var(--spacing-sm); }
      .social-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); cursor: pointer; transition: all var(--transition-fast); }
      .social-btn:hover { background: var(--color-surface-elevated); border-color: var(--color-border-light); }
    </style>

    <div class="auth-tabs">
      <button class="auth-tab ${mode === 'login' ? 'active' : ''}" data-tab="login">Ingresar</button>
      <button class="auth-tab ${mode === 'register' ? 'active' : ''}" data-tab="register">Registrarse</button>
    </div>

    <!-- LOGIN FORM -->
    <form class="auth-form ${mode === 'login' ? 'active' : ''}" id="login-form" novalidate>
      <div class="form-group">
        <label class="label">Email</label>
        <input type="email" name="email" class="input" placeholder="tu@email.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label class="label">Contraseña</label>
        <input type="password" name="password" class="input" placeholder="••••••••" required autocomplete="current-password" minlength="8">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
        <label style="display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--text-sm); cursor: pointer;">
          <input type="checkbox" name="remember" style="width: 16px; height: 16px; accent-color: var(--color-primary);"> Recordarme
        </label>
        <a href="#" class="auth-link" data-action="forgot" style="font-size: var(--text-sm);">¿Olvidaste?</a>
      </div>
      <x-button type="submit" variant="primary" style="width: 100%;" class="login-submit">Ingresar</x-button>
    </form>

    <!-- REGISTER FORM -->
    <form class="auth-form ${mode === 'register' ? 'active' : ''}" id="register-form" novalidate>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Nombre</label>
          <input type="text" name="name" class="input" placeholder="Juan Pérez" required autocomplete="name" minlength="2" maxlength="100">
        </div>
        <div class="form-group">
          <label class="label">Teléfono (opcional)</label>
          <input type="tel" name="phone" class="input" placeholder="+51 999 888 777" autocomplete="tel">
        </div>
      </div>
      <div class="form-group">
        <label class="label">Email</label>
        <input type="email" name="email" class="input" placeholder="tu@email.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label class="label">Contraseña</label>
        <input type="password" name="password" class="input" placeholder="••••••••" required autocomplete="new-password" minlength="8">
        <span class="password-hint" style="font-size: var(--text-xs); color: var(--color-text-subtle);">Mínimo 8 caracteres</span>
      </div>
      <div class="form-group">
        <label class="label">Confirmar contraseña</label>
        <input type="password" name="confirmPassword" class="input" placeholder="••••••••" required autocomplete="new-password">
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--text-sm); font-weight: normal; cursor: pointer;">
          <input type="checkbox" name="terms" required style="width: 16px; height: 16px; accent-color: var(--color-primary);"> Acepto <a href="#" class="auth-link">Términos</a> y <a href="#" class="auth-link">Privacidad</a>
        </label>
      </div>
      <x-button type="submit" variant="primary" style="width: 100%;" class="register-submit">Crear cuenta</x-button>
    </form>

    <div class="divider">o continúa con</div>
    <div class="social-buttons">
      <button type="button" class="social-btn" data-provider="google">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google
      </button>
      <button type="button" class="social-btn" data-provider="apple">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.65.81-1.63 1.25-2.78 1.25-2.58 0-4.55-2.09-4.55-4.67 0-2.55 2.02-4.7 4.65-4.7 1.08 0 2.05.4 2.8 1.02l-1.35 1.36c-.7-.45-1.6-.74-2.55-.74-2.15 0-3.85 1.77-3.85 3.95 0 2.19 1.72 4 3.9 4 .99 0 1.88-.3 2.6-.84l1.42 1.38c-.94.72-2.17 1.14-3.58 1.14-3.85 0-7-3.23-7-7.21 0-4 3.15-7.21 7-7.21 3.85 0 7 3.23 7 7.21 0 2.14-.87 3.95-2.12 5.23l1.45-1.43z"/></svg>
        Apple
      </button>
    </div>

    <div class="auth-footer">
      <span id="auth-switch-text">${mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
      <a href="#" id="auth-switch-link" data-action="switch">${mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</a>
    </div>
  `;

  document.body.appendChild(modal);
  modal.openModal();

  // Cambio de pestañas
  modal.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(modal, tab.dataset.tab));
  });

  // Enlace de alternancia
  modal.querySelector('#auth-switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    const newMode = mode === 'login' ? 'register' : 'login';
    modal.closeModal();
    setTimeout(() => openAuthModal(newMode), 150);
  });

  // Envío de formularios
  modal.querySelector('#login-form').addEventListener('submit', (e) => handleLogin(e, modal));
  modal.querySelector('#register-form').addEventListener('submit', (e) => handleRegister(e, modal));

  // Botones sociales (placeholder OAuth: feedback claro hasta conectar el proveedor)
  const nombresProveedores = { google: 'Google', apple: 'Apple' };
  modal.querySelectorAll('.social-btn').forEach(btn => {
    const nombre = nombresProveedores[btn.dataset.provider] || btn.dataset.provider;
    btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', () => toast.info(`Iniciar sesión con ${nombre} — próximamente disponible`));
  });

  return modal;
}

function switchTab(modal, tab) {
  modal.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  modal.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${tab}-form`));
  modal.querySelector('#auth-switch-text').textContent = tab === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
  modal.querySelector('#auth-switch-link').textContent = tab === 'login' ? 'Regístrate' : 'Inicia sesión';
}

async function handleLogin(e, modal) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.login-submit');

  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const remember = form.remember.checked;

  if (!email || !password) { toast.danger('Completa todos los campos'); return; }

  submitBtn.loading = true;

  try {
    const res = await api.post('/api/users/login', { email, password });
    if (res.token) {
      localStorage.setItem('xshop_token', res.token);
      if (remember) localStorage.setItem('xshop_remember', 'true');
      store.set('user', res.user);
      store.set('session', { token: res.token });
      events.emit(AppEvents.USER_LOGIN, res.user);
      modal.closeModal();
      toast.success(`Bienvenido, ${res.user.name}`);
      window.location.hash = '#app';
    } else {
      toast.danger(res.error || 'Credenciales inválidas');
    }
  } catch (err) {
    toast.danger(err.message || 'Error de conexión');
  } finally {
    submitBtn.loading = false;
  }
}

async function handleRegister(e, modal) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.register-submit');

  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (!name || !email || !password) { toast.danger('Completa campos obligatorios'); return; }
  if (password !== confirmPassword) { toast.danger('Las contraseñas no coinciden'); return; }
  if (password.length < 8) { toast.danger('Mínimo 8 caracteres'); return; }
  if (!form.terms.checked) { toast.danger('Acepta términos y privacidad'); return; }

  submitBtn.loading = true;

  try {
    const res = await api.post('/api/users/register', { name, phone: phone || undefined, email, password, role: 'BUYER' });
    if (res.token) {
      localStorage.setItem('xshop_token', res.token);
      store.set('user', res.user);
      store.set('session', { token: res.token });
      events.emit(AppEvents.USER_LOGIN, res.user);
      modal.closeModal();
      toast.success(`¡Cuenta creada! Bienvenido, ${res.user.name}`);
      window.location.hash = '#app';
    } else {
      toast.danger(res.error || 'Error al registrar');
    }
  } catch (err) {
    toast.danger(err.message || 'Error de conexión');
  } finally {
    submitBtn.loading = false;
  }
}

export function initAuthUI() {
  // Botones de login/registro en el landing
  document.querySelectorAll('[data-action="login"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });
  });
  document.querySelectorAll('[data-action="register"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('register'); });
  });

  // Menú desplegable de usuario
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', () => {
      const open = userDropdown.hidden;
      userDropdown.hidden = !open;
      userMenuBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
      if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.hidden = true;
        userMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
    userDropdown.querySelector('[data-action="logout"]').addEventListener('click', logout);
    userDropdown.querySelector('[data-action="profile"]').addEventListener('click', () => { userDropdown.hidden = true; window.location.hash = '#app?module=profile'; });
    userDropdown.querySelector('[data-action="settings"]').addEventListener('click', () => { userDropdown.hidden = true; window.location.hash = '#app?module=settings'; });
  }

  // Actualizar datos del usuario en el header
  updateUserHeader();

  // Escuchar cambios de autenticación
  events.on(AppEvents.USER_LOGIN, updateUserHeader);
  events.on(AppEvents.USER_LOGOUT, updateUserHeader);
}

function updateUserHeader() {
  const token = localStorage.getItem('xshop_token');
  const avatar = document.getElementById('header-avatar');
  const userName = document.getElementById('header-user-name');
  const userMenuBtn = document.getElementById('user-menu-btn');

  if (token && avatar) {
    import('../core/state.js').then(({ store }) => {
      const user = store.get('user');
      if (user) {
        avatar.textContent = user.name?.charAt(0).toUpperCase() || 'U';
        avatar.style.background = `hsl(${hashColor(user.name || 'User')}, 65%, 45%)`;
        // Texto con mejor contraste WCAG sobre el tono generado (blanco/negro)
        avatar.style.color = hslTextColor(hashColor(user.name || 'User'));
        if (userName) userName.textContent = user.name;
        if (userMenuBtn) userMenuBtn.style.display = 'flex';
      }
    });
  } else if (avatar) {
    avatar.textContent = 'U';
    avatar.style.background = 'var(--color-primary)';
    avatar.style.color = '#111111';
    if (userName) userName.textContent = 'Usuario';
    if (userMenuBtn) userMenuBtn.style.display = 'none';
  }
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function logout() {
  // Revocar la sesión en el servidor ANTES de borrar el token local
  // (api.request lo lee de localStorage al montar los headers)
  if (localStorage.getItem('xshop_token')) {
    api.post('/api/users/logout', {}).catch(() => {});
  }
  localStorage.removeItem('xshop_token');
  localStorage.removeItem('xshop_remember');
  store.set('user', null);
  store.set('session', null);
  events.emit(AppEvents.USER_LOGOUT);
  import('../core/router.js').then(({ router }) => router.navigate('#landing'));
  toast.info('Sesión cerrada');
}
