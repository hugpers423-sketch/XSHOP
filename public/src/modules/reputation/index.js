// src/modules/reputation/index.js — Insignia de nivel, métricas, historial
import { store } from '../../core/state.js';
import { api } from '../../core/api.js';
import { events, AppEvents } from '../../core/events.js';
import { createAvatar } from '../../ui/Avatar.js';
import { createBadge } from '../../ui/Badge.js';
import { createSkeleton, SkeletonLayouts } from '../../ui/Skeleton.js';
import { toast } from '../../ui/Toast.js';
import { animate, slideIn, counter, scaleIn, stagger } from '../../animations/waapi.js';

const LEVELS = [
  { key: 'NEW', name: 'Nuevo', min: 0, color: 'linear-gradient(135deg, #6c757d, #495057)', text: '#fff' },
  { key: 'BRONZE', name: 'Bronce', min: 250, color: 'linear-gradient(135deg, #cd7f32, #b87333)', text: '#fff' },
  { key: 'SILVER', name: 'Plata', min: 500, color: 'linear-gradient(135deg, #c0c0c0, #808080)', text: '#000' },
  { key: 'GOLD', name: 'Oro', min: 750, color: 'linear-gradient(135deg, #ffdf00, #ffb300)', text: '#000' },
  { key: 'MERCADO_LIDER', name: 'MercadoLíder', min: 900, color: 'linear-gradient(135deg, #ffd700, #ff8c00)', text: '#000' }
];

const HISTORY_TYPES = {
  sale: { icon: '💰', label: 'Venta', color: 'var(--color-primary)' },
  review: { icon: '⭐', label: 'Reseña', color: 'var(--color-warning)' },
  dispute: { icon: '⚠️', label: 'Disputa', color: 'var(--color-danger)' },
  return: { icon: '↩️', label: 'Devolución', color: 'var(--color-info)' }
};

export class ReputationModule {
  constructor(container) {
    this.container = container;
    this.data = { score: 0, level: 'NEW', metrics: {}, history: [] };
    this.render();
    this.loadData();
  }

  async loadData() {
    this.showSkeletons();
    try {
      const res = await api.get('/api/reputation').catch(() => null);
      if (res?.score !== undefined) {
        // La API devuelve el objeto de reputación directo: { score, level, totalSales, ... }
        this.data = {
          ...this.data,
          score: res.score,
          level: res.level,
          metrics: {
            totalSales: res.totalSales || 0,
            rating: res.rating || 0,
            responseTime: res.responseTimeSec ? `${Math.round(res.responseTimeSec / 60)} min` : '12 min',
            completionRate: res.completionRate || 100,
            disputes: res.disputesCount || 0,
            returns: res.returnsCount || 0
          },
          history: (res.history || []).map(h => ({
            type: h.type,
            amount: h.amount,
            rating: h.rating,
            buyer: h.buyerName,
            date: new Date(h.createdAt).toLocaleDateString('es-PE'),
            status: h.status
          }))
        };
      } else {
        this.loadLocal();
      }
    } catch {
      this.loadLocal();
    }
    this.calculateLevel();
    this.renderAll();
  }

  loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem('xshop_reputation') || '{}');
      this.data = { ...this.data, ...saved };
    } catch {}
  }

  saveLocal() {
    localStorage.setItem('xshop_reputation', JSON.stringify(this.data));
  }

  calculateLevel() {
    const { totalSales = 0, rating = 0, completionRate = 100 } = this.data.metrics;
    const score = Math.min(1000, Math.round(totalSales * 2 + rating * 100 + completionRate));
    this.data.score = score;

    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (score >= LEVELS[i].min) { this.data.level = LEVELS[i].key; break; }
    }
  }

  showSkeletons() {
    this.container.innerHTML = `
      <div class="reputation-header card card--elevated" style="text-align:center;padding:var(--spacing-lg);margin-bottom:var(--spacing-md);">${SkeletonLayouts.metric().outerHTML}</div>
      <div class="metrics-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--spacing-sm);margin-bottom:var(--spacing-md);">
        ${SkeletonLayouts.metric().outerHTML.repeat(4)}
      </div>
      <div class="card">${SkeletonLayouts.card().outerHTML}</div>
      <div class="card" style="margin-top:var(--spacing-md);">${SkeletonLayouts.metric().outerHTML}</div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="reputation-header card card--elevated" id="reputation-header" style="text-align:center;padding:var(--spacing-lg);margin-bottom:var(--spacing-md);"></div>
      <div class="metrics-grid" id="metrics-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--spacing-sm);margin-bottom:var(--spacing-md);"></div>
      <div class="card">
        <h3 class="label" style="font-size:1rem;margin-bottom:var(--spacing-md);">Historial Reciente</h3>
        <div class="history-list" id="history-list"></div>
      </div>
      <div class="card" id="alerts-card" style="margin-top:var(--spacing-md);">
        <h3 class="label" style="font-size:1rem;margin-bottom:var(--spacing-md);">Alertas</h3>
        <div class="alerts-container" id="alerts-container" style="display:flex;flex-wrap:wrap;gap:var(--spacing-sm);"></div>
      </div>
    `;
  }

  renderAll() {
    // showSkeletons() reemplazó el innerHTML y eliminó los id: restaurar
    // la estructura canónica antes de pintar (evita querySelector → null)
    this.render();
    this.renderHeader();
    this.renderMetrics();
    this.renderHistory();
    this.renderAlerts();
  }

  renderHeader() {
    const header = this.container.querySelector('#reputation-header');
    if (!header) return;
    const levelData = LEVELS.find(l => l.key === this.data.level) || LEVELS[0];
    header.style.background = levelData.color;
    header.style.color = levelData.text;
    header.innerHTML = `
      <div style="font-size:0.875rem;opacity:0.9;text-transform:uppercase;letter-spacing:1px;">Nivel de Vendedor</div>
      <div class="level-name" style="font-size:2rem;font-weight:800;margin:var(--spacing-xs) 0;">${levelData.name}</div>
      <div class="reputation-score" style="font-size:3rem;font-weight:800;font-family:var(--font-mono);">${this.data.score.toLocaleString()}</div>
      <div style="margin-top:var(--spacing-sm);opacity:0.8;">Puntos de reputación</div>
    `;
    // Animar contador
    const scoreEl = header.querySelector('.reputation-score');
    if (scoreEl) counter(scoreEl, 0, this.data.score, 1000);
  }

  renderMetrics() {
    const grid = this.container.querySelector('#metrics-grid');
    if (!grid) return;
    const m = this.data.metrics;
    const metrics = [
      { label: 'Ventas Totales', value: (m.totalSales || 0).toLocaleString(), icon: '📦' },
      { label: 'Calificación', value: (m.rating || 0).toFixed(1) + ' ⭐', icon: '⭐' },
      { label: 'Tiempo Respuesta', value: m.responseTime || '12 min', icon: '⚡' },
      { label: 'Tasa Completación', value: (m.completionRate || 100) + '%', icon: '✅' }
    ];
    grid.innerHTML = metrics.map((metric, i) => `
      <div class="card metric-card" style="text-align:center;padding:var(--spacing-md);opacity:0;transform:translateY(20px);">
        <div style="font-size:1.5rem;margin-bottom:4px;">${metric.icon}</div>
        <div class="metric-value" style="font-weight:700;font-size:1.125rem;font-family:var(--font-mono);color:var(--color-primary);">${metric.value}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${metric.label}</div>
      </div>
    `).join('');
    // Animación escalonada
    setTimeout(() => {
      [...grid.children].forEach((el, i) => slideIn(el, 'up', i * 80));
    }, 50);
  }

  renderHistory() {
    const list = this.container.querySelector('#history-list');
    if (!list) return;
    const history = this.data.history || [];
    if (history.length === 0) {
      list.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--spacing-lg);">Sin historial</p>';
      return;
    }
    list.innerHTML = history.map((h, i) => {
      const type = HISTORY_TYPES[h.type] || { icon: '📋', label: 'Evento', color: 'var(--color-text)' };
      return `
        <div class="history-item card-interactive" style="display:flex;align-items:center;gap:var(--spacing-sm);padding:var(--spacing-sm);opacity:0;transform:translateX(-20px);">
          <span style="font-size:1.25rem;">${type.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-weight:500;">${type.label}</span>
              <span style="color:${type.color};font-weight:600;font-family:var(--font-mono);">
                ${h.amount ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(h.amount / 100) : h.rating ? h.rating + ' ⭐' : h.status}
              </span>
            </div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${h.buyer || 'Cliente'} • ${h.date}</div>
          </div>
        </div>
      `;
    }).join('');
    // Animación escalonada
    setTimeout(() => {
      stagger([...list.children], (el, delay) => slideIn(el, 'right', delay));
    }, 100);
  }

  renderAlerts() {
    const container = this.container.querySelector('#alerts-container');
    if (!container) return;
    const m = this.data.metrics;
    const alerts = [];
    if ((m.disputes || 0) > 0) alerts.push({ type: 'warning', msg: `${m.disputes} disputa(s) activa(s)` });
    if ((m.returns || 0) > 5) alerts.push({ type: 'warning', msg: 'Tasa de devoluciones alta' });
    if (m.responseTime && m.responseTime.includes('h')) alerts.push({ type: 'danger', msg: 'Tiempo de respuesta > 1 hora' });
    if (alerts.length === 0) alerts.push({ type: 'success', msg: 'Sin alertas. Tu reputación está saludable ✓' });

    container.innerHTML = alerts.map(a => `
      <x-badge variant="${a.type}" size="sm">${a.msg}</x-badge>
    `).join('');
  }

  destroy() {}
}