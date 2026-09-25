// src/modules/payments/index.js — Tarjetas, checkout, transacciones
import { store } from '../../core/state.js';
import { api } from '../../core/api.js';
import { events, AppEvents } from '../../core/events.js';
import { createButton } from '../../ui/Button.js';
import { createInput } from '../../ui/Input.js';
import { createModal, openModal } from '../../ui/Modal.js';
import { createAvatar } from '../../ui/Avatar.js';
import { createBadge } from '../../ui/Badge.js';
import { createSkeleton, SkeletonLayouts } from '../../ui/Skeleton.js';
import { toast } from '../../ui/Toast.js';
import { animate, slideIn, counter } from '../../animations/waapi.js';

const CARD_BRANDS = {
  visa: /^4/,
  mastercard: /^(5[1-5]|2[2-7])/,
  amex: /^3[47]/,
  discover: /^6(?:011|5)/
};

function detectBrand(number) {
  for (const [brand, regex] of Object.entries(CARD_BRANDS)) {
    if (regex.test(number)) return brand;
  }
  return 'unknown';
}

function luhnCheck(num) {
  const n = num.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(n)) return false;
  let sum = 0, alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(value) {
  const v = value.replace(/\D/g, '');
  return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value) {
  const v = value.replace(/\D/g, '');
  if (v.length >= 2) return v.slice(0,2) + '/' + v.slice(2,4);
  return v;
}

export class PaymentsModule {
  constructor(container) {
    this.container = container;
    this.cards = [];
    this.transactions = [];
    this.checkoutOpen = false;
    this.render();
    this.loadData();
  }

  async loadData() {
    this.showSkeletons();
    try {
      const [cardsRes, txRes] = await Promise.all([
        api.get('/api/cards').catch(() => ({ data: [] })),
        api.get('/api/transactions').catch(() => ({ data: [] }))
      ]);
      this.cards = cardsRes.data || [];
      this.transactions = txRes.data || [];
      this.saveLocal();
      this.renderCards();
      this.renderTransactions();
    } catch (e) {
      this.loadLocal();
      this.renderCards();
      this.renderTransactions();
    }
  }

  loadLocal() {
    try {
      this.cards = JSON.parse(localStorage.getItem('xshop_cards') || '[]');
      this.transactions = JSON.parse(localStorage.getItem('xshop_transactions') || '[]');
    } catch { this.cards = []; this.transactions = []; }
  }

  saveLocal() {
    localStorage.setItem('xshop_cards', JSON.stringify(this.cards));
    localStorage.setItem('xshop_transactions', JSON.stringify(this.transactions));
  }

  showSkeletons() {
    // Rellenar SOLO las secciones de datos: la cabecera la construye render()
    // (con "Pagar ahora" y sus listeners) y reemplazarla aquí la degradaba
    // de forma permanente — loadCards/renderCards nunca reconstruían el header
    const cards = this.container.querySelector('#cards-list');
    const tx = this.container.querySelector('#transactions-list');
    if (cards) cards.innerHTML = SkeletonLayouts.card().outerHTML.repeat(3);
    if (tx) tx.innerHTML = SkeletonLayouts.card().outerHTML.repeat(3);
  }

  render() {
    this.container.innerHTML = `
      <div class="payments-header">
        <h1 class="payments-title">Métodos de Pago</h1>
        <div style="display:flex;gap:var(--spacing-sm);">
          <x-button id="open-checkout-btn" variant="primary" size="sm">Pagar ahora</x-button>
          <x-button id="add-card-btn" variant="ghost" size="sm">+ Agregar</x-button>
        </div>
      </div>
      <div class="cards-grid" id="cards-list"></div>
      <div class="checkout-form" id="checkout-section" hidden></div>
      <div class="card" style="margin-top:var(--spacing-lg);">
        <h2 class="label" style="font-size:1.125rem;margin-bottom:var(--spacing-md);">Historial</h2>
        <div class="transactions-list" id="transactions-list"></div>
      </div>
    `;
    this.bindHeaderEvents();
  }

  bindHeaderEvents() {
    this.container.querySelector('#add-card-btn')?.addEventListener('click', () => this.openAddCardModal());
    this.container.querySelector('#open-checkout-btn')?.addEventListener('click', () => this.openCheckout());
  }

  renderCards() {
    const list = this.container.querySelector('#cards-list');
    if (!list) return;
    if (this.cards.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center;padding:var(--spacing-xl);grid-column:1/-1;">
          <x-avatar name="Tarjeta" size="xl" style="margin:0 auto var(--spacing-md);opacity:0.3;"></x-avatar>
          <h3 style="margin-bottom:var(--spacing-sm);">Sin tarjetas guardadas</h3>
          <p style="color:var(--color-text-muted);margin-bottom:var(--spacing-lg);">Agrega tu primera tarjeta para pagar rápido</p>
          <x-button id="first-card-btn" variant="primary">Agregar tarjeta</x-button>
        </div>
      `;
      list.querySelector('#first-card-btn')?.addEventListener('click', () => this.openAddCardModal());
      return;
    }

    list.innerHTML = this.cards.map(card => this.renderCard(card)).join('');
    list.querySelectorAll('.card-item').forEach(el => {
      const id = el.dataset.id;
      el.querySelector('.card-delete')?.addEventListener('click', (e) => { e.stopPropagation(); this.deleteCard(id); });
      el.querySelector('.card-set-default')?.addEventListener('click', (e) => { e.stopPropagation(); this.setDefault(id); });
    });
    this.renderCheckoutCardSelect();
  }

  renderCard(card) {
    const brandIcon = this.getBrandIcon(card.brand);
    const isDefault = card.isDefault;
    return `
      <div class="card-item card-interactive" data-id="${card.id}" style="flex-direction:column;align-items:stretch;gap:var(--spacing-sm);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:var(--spacing-sm);">
            <span class="card-brand" style="background:${this.getBrandColor(card.brand)};color:#fff;">${card.brand.toUpperCase()}</span>
            <span class="card-number" style="font-family:var(--font-mono);letter-spacing:0.5px;">•••• ${card.last4}</span>
          </div>
          <div style="display:flex;gap:var(--spacing-xs);">
            ${!isDefault ? `<button class="btn btn-ghost btn-icon card-set-default" aria-label="Establecer como principal" title="Principal"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>` : `<x-badge variant="success" size="xs">Principal</x-badge>`}
            <button class="btn btn-ghost btn-icon card-delete" aria-label="Eliminar tarjeta"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
        <div class="card-meta" style="display:flex;justify-content:space-between;color:var(--color-text-subtle);font-size:var(--text-xs);">
          <span>${card.holderName || 'Usuario'}</span>
          <span>${card.expiry}</span>
        </div>
      </div>
    `;
  }

  getBrandColor(brand) {
    const colors = { visa: '#1A1F71', mastercard: '#EB001B', amex: '#006FCF', discover: '#FF6000', unknown: '#666' };
    return colors[brand] || colors.unknown;
  }

  getBrandIcon(brand) {
    const icons = {
      visa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.25 3.75H2.75A1.5 1.5 0 001.25 5.25v13.5A1.5 1.5 0 002.75 20.25h18.5a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021.25 3.75zM11.89 15.65c0 .71-.35 1.14-.87 1.14-.43 0-.74-.3-.87-.79 0-.52.38-.87.87-.87.4 0 .77.26.87.73 0 .43-.4.93-.87.93zm0-4.15c-.52 0-.87-.3-.87-.8 0-.53.35-.8.87-.8.4 0 .77.27.87.73 0 .47-.4.87-.87.87zm6.16 0h-1.74v5.81c0 .71-.35 1.14-.87 1.14-.52 0-.87-.43-.87-1.14V7.36h-1.77V5.86h5.26c.65 0 1.05.38 1.05.97 0 .47-.27.8-.68.93v.04c.5.17.74.5.74.94 0 .6-.43.97-1.15.97z"/></svg>',
      mastercard: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.59 11.67c0 1.83-1.31 3.31-2.93 3.31-1.62 0-2.93-1.48-2.93-3.31 0-1.83 1.31-3.31 2.93-3.31 1.62 0 2.93 1.48 2.93 3.31zm6.72 0c0 1.83-1.31 3.31-2.93 3.31-1.62 0-2.93-1.48-2.93-3.31 0-1.83 1.31-3.31 2.93-3.31 1.62 0 2.93 1.48 2.93 3.31z"/></svg>',
      amex: '<svg viewBox="0 0 24 24" fill="currentColor"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="10" font-weight="bold">AMEX</text></svg>',
      unknown: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>'
    };
    return icons[brand] || icons.unknown;
  }

  renderCheckoutCardSelect() {
    const select = this.container.querySelector('#checkout-card');
    if (!select) return;
    select.innerHTML = this.cards.map(c => `<option value="${c.id}" ${c.isDefault ? 'selected' : ''}>${c.brand.toUpperCase()} •••• ${c.last4}</option>`).join('');
  }

  openAddCardModal() {
    const modal = createModal({ title: 'Agregar Tarjeta', size: 'md' });
    modal.innerHTML = `
      <form id="add-card-form" class="modal-form">
        <div class="form-group">
          <label class="label">Número de tarjeta</label>
          <div class="input-with-icon">
            <input type="text" id="card-number" class="input" placeholder="4242 4242 4242 4242" maxlength="19" required autocomplete="cc-number">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M2 14h20"/></svg>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Expira</label>
            <input type="text" id="card-expiry" class="input" placeholder="MM/AA" maxlength="5" required autocomplete="cc-exp">
          </div>
          <div class="form-group">
            <label class="label">CVC</label>
            <input type="text" id="card-cvc" class="input" placeholder="123" maxlength="4" required autocomplete="cc-csc">
          </div>
        </div>
        <div class="form-group">
          <label class="label">Nombre en tarjeta</label>
          <input type="text" id="card-name" class="input" placeholder="JUAN PEREZ" maxlength="50" required autocomplete="cc-name">
        </div>
        <div class="modal-footer">
          <x-button type="button" variant="ghost" class="modal-cancel">Cancelar</x-button>
          <x-button type="submit" variant="primary">Guardar tarjeta</x-button>
        </div>
      </form>
    `;

    const form = modal.querySelector('#add-card-form');
    const numberInput = form.querySelector('#card-number');
    const expiryInput = form.querySelector('#card-expiry');
    // Cerrar modal (reemplaza al viejo @click de Alpine que no hacía nada)
    form.querySelector('.modal-cancel')?.addEventListener('click', () => modal.closeModal());

    numberInput.addEventListener('input', (e) => { e.target.value = formatCardNumber(e.target.value); });
    expiryInput.addEventListener('input', (e) => { e.target.value = formatExpiry(e.target.value); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const number = numberInput.value.replace(/\s/g, '');
      const expiry = expiryInput.value;
      const cvc = form.querySelector('#card-cvc').value;
      const name = form.querySelector('#card-name').value.toUpperCase();

      if (!luhnCheck(number)) { toast.danger('Número de tarjeta inválido'); return; }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) { toast.danger('Expiración inválida (MM/AA)'); return; }
      if (!/^\d{3,4}$/.test(cvc)) { toast.danger('CVC inválido'); return; }

      const [mm, yy] = expiry.split('/');
      const expDate = new Date(2000 + parseInt(yy), parseInt(mm) - 1);
      if (expDate < new Date()) { toast.danger('Tarjeta expirada'); return; }

      const brand = detectBrand(number);
      const newCard = {
        id: crypto.randomUUID?.() || `card_${Date.now()}`,
        brand,
        last4: number.slice(-4),
        expiry,
        holderName: name,
        isDefault: this.cards.length === 0
      };

      try {
        // Enviar datos completos de la tarjeta al backend para validación
        const res = await api.post('/api/cards', { number, expiry, cvc, holderName: name });
        // El backend devuelve el objeto tarjeta directo (sin envolver en data)
        this.cards.unshift(res.last4 ? res : newCard);
      } catch {
        // Backend no disponible: guardar localmente
        this.cards.unshift(newCard);
      }
      this.saveLocal();
      this.renderCards();
      modal.closeModal();
      toast.success('Tarjeta agregada');
    });

    document.body.appendChild(modal);
    modal.openModal();
  }

  async setDefault(id) {
    try {
      await api.patch(`/api/cards/${id}/default`, {});
    } catch {}
    this.cards.forEach(c => c.isDefault = c.id === id);
    this.saveLocal();
    this.renderCards();
    toast.success('Tarjeta principal actualizada');
  }

  async deleteCard(id) {
    if (this.cards.length <= 1) { toast.warning('Debe mantener al menos una tarjeta'); return; }
    const card = this.cards.find(c => c.id === id);
    if (!card) return;

    try {
      await api.del(`/api/cards/${id}`);
    } catch {}
    this.cards = this.cards.filter(c => c.id !== id);
    if (card.isDefault && this.cards.length) this.cards[0].isDefault = true;
    this.saveLocal();
    this.renderCards();
    toast.success('Tarjeta eliminada');
  }

  openCheckout() {
    this.checkoutOpen = true;
    const section = this.container.querySelector('#checkout-section');
    section.hidden = false;
    section.innerHTML = `
      <h2 class="label" style="font-size:1.125rem;margin-bottom:var(--spacing-md);">Checkout</h2>
      <div class="form-group"><label class="label">Monto (PEN)</label><input type="number" class="input" id="checkout-amount" placeholder="0.00" step="0.01" min="1" required></div>
      <div class="form-group"><label class="label">Descripción</label><input type="text" class="input" id="checkout-desc" placeholder="Pago de servicios" maxlength="100" required></div>
      <div class="form-group"><label class="label">Tarjeta</label><select class="input" id="checkout-card"></select></div>
      <div style="display:flex;gap:var(--spacing-sm);">
        <x-button id="cancel-checkout" variant="ghost" style="flex:1;">Cancelar</x-button>
        <x-button id="process-payment" variant="primary" style="flex:1;" disabled>Procesar Pago</x-button>
      </div>`;
    this.renderCheckoutCardSelect();
    this.bindCheckoutEvents();
    slideIn(section);
  }

  bindCheckoutEvents() {
    const amount = this.container.querySelector('#checkout-amount');
    const desc = this.container.querySelector('#checkout-desc');
    const cardSel = this.container.querySelector('#checkout-card');
    const btn = this.container.querySelector('#process-payment');
    const cancel = this.container.querySelector('#cancel-checkout');

    const validate = () => { btn.disabled = !amount.value || !desc.value || !cardSel.value; };
    amount.addEventListener('input', validate);
    desc.addEventListener('input', validate);
    cardSel.addEventListener('change', validate);

    btn.addEventListener('click', () => this.processPayment());
    // Cierre sin pagar: el checkout no debe ser un callejón sin salida
    cancel?.addEventListener('click', () => {
      this.container.querySelector('#checkout-section').hidden = true;
      this.checkoutOpen = false;
    });
  }

  async processPayment() {
    const amount = parseFloat(this.container.querySelector('#checkout-amount').value);
    const desc = this.container.querySelector('#checkout-desc').value.trim();
    const cardId = this.container.querySelector('#checkout-card').value;
    if (!amount || amount < 1 || !desc || !cardId) return;

    const card = this.cards.find(c => c.id === cardId);
    const btn = this.container.querySelector('#process-payment');
    btn.loading = true;

    const tx = {
      id: crypto.randomUUID?.() || `tx_${Date.now()}`,
      amount: Math.round(amount * 100),
      description: desc,
      cardId,
      status: 'PROCESSING',
      provider: 'manual',
      createdAt: new Date().toISOString()
    };

    this.transactions.unshift(tx);
    this.renderTransactions();
    this.container.querySelector('#checkout-section').hidden = true;
    this.container.querySelector('#checkout-amount').value = '';
    this.container.querySelector('#checkout-desc').value = '';

    try {
      await new Promise(r => setTimeout(r, 1500));
      const approved = Math.random() > 0.05;
      tx.status = approved ? 'APPROVED' : 'DECLINED';
      tx.processedAt = new Date().toISOString();
      this.saveLocal();
      this.renderTransactions();

      if (approved) {
        toast.success(`Pago ${new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)} aprobado`);
        events.emit(AppEvents.PAYMENT_SUCCESS, { amount, card: `${card.brand} ${card.last4}` });
      } else {
        toast.danger('Pago declinado');
        events.emit(AppEvents.PAYMENT_ERROR, { amount, card: `${card.brand} ${card.last4}` });
      }
    } catch {
      tx.status = 'FAILED';
      this.renderTransactions();
      toast.danger('Error procesando pago');
    } finally {
      btn.loading = false;
    }
  }

  renderTransactions() {
    const list = this.container.querySelector('#transactions-list');
    if (!list) return;
    if (this.transactions.length === 0) {
      list.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--spacing-xl);">Sin transacciones</p>';
      return;
    }
    list.innerHTML = this.transactions.map(tx => `
      <div class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-desc">${tx.description}</div>
          <div class="transaction-meta">${tx.cardId ? `Tarjeta • ${new Date(tx.createdAt).toLocaleString('es-PE')}` : new Date(tx.createdAt).toLocaleString('es-PE')}</div>
        </div>
        <div class="transaction-amount">
          <div class="transaction-value">${(tx.amount / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</div>
          <span class="transaction-status ${tx.status.toLowerCase()}">${tx.status}</span>
        </div>
      </div>
    `).join('');
  }

  destroy() {}
}