// src/modules/feed/index.js — Reels-Commerce: feed vertical inmersivo tipo TikTok
// Snap vertical · pool virtual de 10 nodos · video lazy · quick-buy · rail de likes/comentarios/compartir
import '../../ui/Button.js'; // Garantiza customElements.define('x-button') antes de crear templates
import { api } from '../../core/api.js';
import { events, AppEvents } from '../../core/events.js';
import { createModal } from '../../ui/Modal.js';
import { hslTextColor } from '../../ui/Avatar.js';
import { toast } from '../../ui/Toast.js';
import { animate, slideIn, fadeIn, scaleIn } from '../../animations/waapi.js';

const POOL_SIZE = 10;      // máximo de nodos DOM vivos (virtualización)
const WINDOW_BACK = 3;     // nodos retenidos detrás del actual
const PRELOAD_AHEAD = 1;   // videos con src adjunto por delante
const VIDEO_DETACH = 2;    // distancia a la que se libera el src del video
const LOAD_MORE_AT = 4;    // items restantes que disparan carga
const MAX_ITEMS = 60;      // techo del mock infinito

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const VIDEO_BUCKET = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
const poster = seed => `https://picsum.photos/seed/${seed}/720/1280`;

const MOCK_REELS = [
  {
    author: { name: 'TechReviews PE', handle: '@techreviews_pe', verified: true },
    caption: 'Review completo del iPhone 16 Pro: ¿vale la pena el upgrade? 📱 Cámaras, batería y rendimiento en Perú.',
    audio: 'Sonido original — TechReviews PE',
    media: { type: 'video', url: `${VIDEO_BUCKET}/ForBiggerBlazes.mp4`, poster: poster('xshop-tech1') },
    stats: { likes: 12400, comments: 486, shares: 213 },
    product: { name: 'iPhone 16 Pro 256GB — Titanio Natural', price: 4899, oldPrice: 5399, image: poster('prod-iphone') }
  },
  {
    author: { name: 'Moda Lima', handle: '@moda_lima', verified: true },
    caption: 'Tendencias Otoño 2025: los 5 básicos que no pueden faltar en tu closet 🍂 Link en perfil.',
    audio: 'Trend audio — Moda Lima',
    media: { type: 'image', url: poster('xshop-moda1'), poster: poster('xshop-moda1') },
    stats: { likes: 8321, comments: 302, shares: 145 },
    product: { name: 'Abrigo clásico lana oversize — Beige', price: 189, oldPrice: 249, image: poster('prod-abrigo') }
  },
  {
    author: { name: 'Gamer Zone', handle: '@gamerzone', verified: false },
    caption: 'Gameplay en vivo: boss final sin daño 🎮 Setup completo en el enlace.',
    audio: 'BGM retro — Gamer Zone',
    media: { type: 'video', url: `${VIDEO_BUCKET}/ForBiggerEscapes.mp4`, poster: poster('xshop-gamer1') },
    stats: { likes: 20130, comments: 991, shares: 470 },
    product: { name: 'Mouse gamer RGB 26K DPI — Edición Pro', price: 149, oldPrice: 199, image: poster('prod-mouse') }
  },
  {
    author: { name: 'Cocina Casera', handle: '@cocinacasera', verified: true },
    caption: 'Lomo saltado perfecto en 15 minutos 🥩 truco del wok bien caliente. Receta completa acá.',
    audio: 'Sonido original — Cocina Casera',
    media: { type: 'video', url: `${VIDEO_BUCKET}/ForBiggerFun.mp4`, poster: poster('xshop-cocina1') },
    stats: { likes: 15780, comments: 723, shares: 611 },
    product: { name: 'Wok de acero al carbono 32cm', price: 129, oldPrice: 169, image: poster('prod-wok') }
  },
  {
    author: { name: 'Fit Peru', handle: '@fit_peru', verified: false },
    caption: 'HIIT 20 min sin equipo: quema grasa desde casa 💪 ¿Te anotas al reto de 30 días?',
    audio: 'Workout mix — Fit Peru',
    media: { type: 'image', url: poster('xshop-fit1'), poster: poster('xshop-fit1') },
    stats: { likes: 6410, comments: 188, shares: 92 },
    product: { name: 'Set mancuernas ajustables 20kg', price: 299, oldPrice: 379, image: poster('prod-mancuernas') }
  },
  {
    author: { name: 'Decor Hogar', handle: '@decor_hogar', verified: true },
    caption: 'Transformación de living en 60 segundos ✨ antes/después con presupuesto S/ 500.',
    audio: 'Audio en tendencia — Decor Hogar',
    media: { type: 'video', url: `${VIDEO_BUCKET}/ForBiggerJoyrides.mp4`, poster: poster('xshop-decor1') },
    stats: { likes: 9932, comments: 415, shares: 260 },
    product: { name: 'Lámpara LED minimalista — Latón', price: 89, oldPrice: 119, image: poster('prod-lampara') }
  },
  {
    author: { name: 'Zapatos.pe', handle: '@zapatos_pe', verified: false },
    caption: 'Unboxing de los sneakers más buscados del año 👟 Talla real, envío 24h en Lima.',
    audio: 'Sonido original — Zapatos.pe',
    media: { type: 'video', url: `${VIDEO_BUCKET}/ForBiggerMeltdowns.mp4`, poster: poster('xshop-zapas1') },
    stats: { likes: 11205, comments: 534, shares: 301 },
    product: { name: 'Sneakers urbanos blancos — Cuero', price: 259, oldPrice: 329, image: poster('prod-sneakers') }
  },
  {
    author: { name: 'Belleza Natural', handle: '@belleza_natural', verified: true },
    caption: 'Rutina glow en 3 pasos 🧴 producto vegano y cruelty-free. ¡Nuevo stock!',
    audio: 'Audio en tendencia — Belleza Natural',
    media: { type: 'image', url: poster('xshop-belleza1'), poster: poster('xshop-belleza1') },
    stats: { likes: 7450, comments: 259, shares: 130 },
    product: { name: 'Sérum vitamina C 30ml', price: 79, oldPrice: 99, image: poster('prod-serum') }
  }
];

const MOCK_COMMENTS = [
  { user: 'Lucía M.', text: 'Lo compré y llegó en un día 😍 súper recomendado', ago: '2h' },
  { user: 'Carlos R.', text: '¿Envían a Arequipa?', ago: '4h' },
  { user: 'Veterano77', text: 'El mejor review que he visto hasta ahora', ago: '6h' },
  { user: 'Ana P.', text: 'Me lo quedé, la calidad es real 👌', ago: '9h' },
  { user: 'Diego F.', text: 'Precio justo, sin sorpresas al pagar', ago: '1d' }
];

const ICONS = {
  heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  comment: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  share: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  save: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  volume: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  mute: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" width="74" height="74"><path d="M8 5v14l11-7z"/></svg>',
  cart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
};

const formatCount = n => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const formatPrice = n => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function initials(name = 'X') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const isVideoUrl = u => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || '');

function normalizeApiPost(p) {
  const authorName = p.author?.name || 'Vendedor X-SHOP';
  const media = p.mediaUrl
    ? (isVideoUrl(p.mediaUrl)
      ? { type: 'video', url: p.mediaUrl, poster: poster(`api-${p.id}`) }
      : { type: 'image', url: p.mediaUrl, poster: p.mediaUrl })
    : { type: 'image', url: poster(`api-${p.id}`), poster: poster(`api-${p.id}`) };
  return {
    id: p.id,
    fromApi: true,
    author: {
      name: authorName,
      handle: `@${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20)}`,
      verified: p.author?.role === 'SELLER' || p.author?.isVerified
    },
    caption: p.content || '',
    audio: 'Sonido original — X-SHOP',
    media,
    stats: { likes: p.likesCount ?? 0, comments: p.commentsCount ?? 0, shares: p.sharesCount ?? 0 },
    liked: !!p.liked,
    live: !!p.isLive,
    createdAt: p.createdAt,
    product: null // los posts del API no traen producto; el quick-buy usa el catálogo mock
  };
}

function mockReel(i, idPrefix = 'mock') {
  const base = MOCK_REELS[i % MOCK_REELS.length];
  return {
    ...base,
    id: `${idPrefix}_${i}`,
    fromApi: false,
    liked: false,
    saved: false,
    following: false,
    live: i % 7 === 3,
    stats: { ...base.stats },
    product: base.product ? { ...base.product } : null,
    comments: null
  };
}

export class FeedModule {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.pool = [];
    this.currentIndex = 0;
    this.itemHeight = 0;
    this.muted = true;
    this.loading = false;
    this.hasMore = true;
    this.mockCursor = 0;
    this.apiCursor = null;
    this.ticking = false;
    this.sheet = null;
    this.destroyed = false;

    this.onScroll = this.onScroll.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onVisibility = this.onVisibility.bind(this);

    this.renderShell();
    this.loadFeed().then(() => {
      if (!this.destroyed) {
        this.buildPool();
        this.updateWindow(0, true);
        this.setCurrent(0);
      }
    });

    this.container.classList.add('reels-shell');
  }

  /* ---------------- Shell ---------------- */

  renderShell() {
    this.container.innerHTML = `
      <div class="reels-loading" id="reels-loading" aria-live="polite">
        <div class="reels-loading-spinner"></div>
        <p>Cargando Reels…</p>
      </div>
      <div class="reels" id="reels" tabindex="0" role="feed" aria-label="Feed de Reels comerciales" aria-busy="true">
        <div class="reels-spacer" id="reels-spacer"></div>
      </div>
      <div class="reels-topbar">
        <span class="reels-counter" id="reels-counter">—/—</span>
        <button class="reels-icon-btn" id="reels-mute" aria-label="Activar sonido" title="Sonido">${ICONS.mute}</button>
      </div>
      <div class="reels-hint" id="reels-hint">Desliza ▲</div>
    `;
    this.scroller = this.container.querySelector('#reels');
    this.spacer = this.container.querySelector('#reels-spacer');
    this.loadingEl = this.container.querySelector('#reels-loading');
    this.counterEl = this.container.querySelector('#reels-counter');
    this.muteBtn = this.container.querySelector('#reels-mute');
    this.hintEl = this.container.querySelector('#reels-hint');

    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
    this.scroller.addEventListener('keydown', this.onKeydown);
    this.muteBtn.addEventListener('click', () => this.toggleMute());
    document.addEventListener('visibilitychange', this.onVisibility);

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.scroller);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  handleResize = () => {
    const h = this.scroller.clientHeight;
    if (!h || h === this.itemHeight) return;
    this.itemHeight = h;
    this.spacer.style.height = `${this.items.length * h}px`;
    this.scroller.scrollTop = this.currentIndex * h;
    this.updateWindow(this.currentIndex, true);
  };

  /* ---------------- Data ---------------- */

  async loadFeed() {
    this.loading = true;
    try {
      const res = await api.get('/api/posts?limit=20', { cacheTTL: 15000 }).catch(() => null);
      const posts = Array.isArray(res?.data) ? res.data : [];
      posts.forEach(p => this.items.push(normalizeApiPost(p)));
      this.apiCursor = res?.nextCursor || null;
      if (!this.apiCursor) this.hasMore = false;
    } catch { /* sin backend: seguimos con mock */ }

    // Siempre poblar con catálogo mock para garantizar quick-buy y media rica
    const filler = Math.max(8, Math.min(16, 16 - this.items.length));
    for (let i = 0; i < filler; i++) this.items.push(mockReel(this.mockCursor++));
    this.loading = false;
  }

  async loadMore() {
    if (this.loading || !this.hasMore || this.items.length >= MAX_ITEMS) return;
    this.loading = true;
    try {
      if (this.apiCursor) {
        const res = await api.get(`/api/posts?limit=10&cursor=${encodeURIComponent(this.apiCursor)}`, { cache: false }).catch(() => null);
        const posts = Array.isArray(res?.data) ? res.data : [];
        posts.forEach(p => this.items.push(normalizeApiPost(p)));
        this.apiCursor = res?.nextCursor || null;
        if (!this.apiCursor) this.hasMore = false;
      }
      if (this.items.length < MAX_ITEMS) {
        const add = Math.min(6, MAX_ITEMS - this.items.length);
        for (let i = 0; i < add; i++) this.items.push(mockReel(this.mockCursor++));
      } else {
        this.hasMore = false;
      }
      this.spacer.style.height = `${this.items.length * this.itemHeight}px`;
      this.updateWindow(this.currentIndex);
    } finally {
      this.loading = false;
    }
  }

  /* ---------------- Virtualización (pool de 10 nodos) ---------------- */

  buildPool() {
    this.itemHeight = this.scroller.clientHeight;
    this.spacer.style.height = `${this.items.length * this.itemHeight}px`;
    this.scroller.setAttribute('aria-busy', 'false');
    this.loadingEl.hidden = true;

    this.pool = Array.from({ length: POOL_SIZE }, () => {
      const el = document.createElement('article');
      el.className = 'reels-item';
      el.dataset.index = '-1';
      el.setAttribute('role', 'article');
      this.scroller.appendChild(el);
      return el;
    });
  }

  boundIndex(node) {
    return node.dataset.index !== undefined ? Number(node.dataset.index) : -1;
  }

  updateWindow(idx, force = false) {
    if (!this.pool.length || !this.itemHeight) return;
    const count = this.items.length;
    if (!count) return;

    let start = Math.max(0, idx - WINDOW_BACK);
    start = Math.min(start, Math.max(0, count - POOL_SIZE));
    const end = Math.min(count - 1, start + POOL_SIZE - 1);
    const desired = new Set();
    for (let i = start; i <= end; i++) desired.add(i);

    const free = this.pool.filter(n => !desired.has(this.boundIndex(n)));

    for (let i = start; i <= end; i++) {
      let node = this.pool.find(n => this.boundIndex(n) === i);
      if (!node) {
        node = free.pop();
        if (!node) continue;
        this.bindItem(node, i);
      }
      node.style.display = 'block';
      node.style.transform = `translate3d(0, ${i * this.itemHeight}px, 0)`;
      this.updateMediaState(node, i, idx, force);
    }

    for (const node of this.pool) {
      if (!desired.has(this.boundIndex(node))) this.releaseNode(node);
    }
  }

  releaseNode(node) {
    const video = node.querySelector('video');
    if (video) {
      video.pause();
      if (video.src) { video.removeAttribute('src'); video.load(); }
    }
    node.dataset.index = '-1';
    node.style.display = 'none';
  }

  updateMediaState(node, index, current, force = false) {
    const video = node.querySelector('video');
    if (!video) return;
    const distance = index - current;
    const item = this.items[index];
    if (!item) return;

    if (distance >= -1 && distance <= PRELOAD_AHEAD) {
      if (!video.src && item.media.url) {
        video.src = item.media.url;
        video.muted = this.muted;
        if (distance === 0) video.play().catch(() => {});
      } else if (force && distance === 0 && item.media.type === 'video') {
        video.muted = this.muted;
        video.play().catch(() => {});
      }
    } else if (Math.abs(distance) > VIDEO_DETACH && video.src) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } else if (video.src && distance !== 0) {
      video.pause();
    }
  }

  /* ---------------- Render de item ---------------- */

  bindItem(node, index) {
    const item = this.items[index];
    if (!item) return;
    node.dataset.index = String(index);
    node.innerHTML = this.template(item, index);
    node.setAttribute('aria-label', `Reel ${index + 1}: ${item.caption.slice(0, 80)}`);
    this.wireItem(node, item, index);
  }

  template(item, index) {
    const hue = hashHue(item.author.handle || item.author.name);
    const mediaHtml = item.media.type === 'video'
      ? `<video class="reels-video" playsinline loop muted preload="none" poster="${esc(item.media.poster)}"
             aria-label="${esc(item.caption.slice(0, 60))}"></video>`
      : `<img class="reels-img" src="${esc(item.media.url)}" alt="${esc(item.caption.slice(0, 80))}"
             loading="${index <= 1 ? 'eager' : 'lazy'}" decoding="async">`;

    const productHtml = item.product ? `
      <div class="reels-product">
        <img src="${esc(item.product.image)}" alt="" loading="lazy" decoding="async"
             data-hide-on-error>
        <div class="reels-product-info">
          <div class="reels-product-name">${esc(item.product.name)}</div>
          <div class="reels-product-price">${formatPrice(item.product.price)}
            ${item.product.oldPrice ? `<s>${formatPrice(item.product.oldPrice)}</s>` : ''}
          </div>
        </div>
        <button class="reels-buy" data-act="buy" type="button">${ICONS.cart} Comprar</button>
      </div>` : '';

    return `
      <div class="reels-media" style="background:linear-gradient(160deg, hsl(${hue} 45% 16%), #060606 70%)">
        ${mediaHtml}
      </div>
      <div class="reels-gradient reels-gradient--top"></div>
      <div class="reels-gradient reels-gradient--bottom"></div>
      <button class="reels-tap" type="button" aria-label="Toca para pausar, doble toque para me gusta"></button>
      <div class="reels-play">${ICONS.play}</div>
      ${item.live ? '<span class="reels-live">EN VIVO</span>' : ''}
      <div class="reels-rail">
        <button class="rail-btn rail-like ${item.liked ? 'liked' : ''}" type="button" data-act="like" aria-label="Me gusta" aria-pressed="${!!item.liked}">
          <span class="rail-icon">${ICONS.heart}</span>
          <span class="rail-count" data-count="likes">${formatCount(item.stats.likes)}</span>
        </button>
        <button class="rail-btn" type="button" data-act="comment" aria-label="Comentarios">
          <span class="rail-icon">${ICONS.comment}</span>
          <span class="rail-count" data-count="comments">${formatCount(item.stats.comments)}</span>
        </button>
        <button class="rail-btn" type="button" data-act="share" aria-label="Compartir">
          <span class="rail-icon">${ICONS.share}</span>
          <span class="rail-count" data-count="shares">${formatCount(item.stats.shares)}</span>
        </button>
        <button class="rail-btn ${item.saved ? 'saved' : ''}" type="button" data-act="save" aria-label="Guardar" aria-pressed="${!!item.saved}">
          <span class="rail-icon">${ICONS.save}</span>
          <span class="rail-count">Guardar</span>
        </button>
        <div class="rail-avatar-wrap">
          <span class="rail-avatar" style="background:hsl(${hue} 65% 42%);color:${hslTextColor(hue, 42)}">${esc(initials(item.author.name))}</span>
          <button class="rail-follow ${item.following ? 'following' : ''}" type="button" data-act="follow"
                  aria-label="${item.following ? 'Dejar de seguir' : 'Seguir'} a ${esc(item.author.name)}">${item.following ? '✓' : '+'}</button>
        </div>
      </div>
      <div class="reels-info">
        <div class="reels-author-row">
          <span class="reels-handle">${esc(item.author.handle)}</span>
          ${item.author.verified ? '<span class="reels-verified" title="Verificado">✓</span>' : ''}
          <button class="reels-follow-text ${item.following ? 'following' : ''}" type="button" data-act="follow">
            ${item.following ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>
        <p class="reels-caption" data-act="expand">${esc(item.caption)}</p>
        <div class="reels-audio"><span>♪</span><span>${esc(item.audio)}</span></div>
        ${productHtml}
      </div>
      <div class="reels-progress"><i></i></div>
    `;
  }

  wireItem(node, item, index) {
    const tap = node.querySelector('.reels-tap');
    const video = node.querySelector('video');
    const progress = node.querySelector('.reels-progress i');
    const playIcon = node.querySelector('.reels-play');

    // Doble toque = like · toque simple = play/pause
    let lastTap = 0;
    let tapTimer = null;
    tap.addEventListener('pointerup', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        clearTimeout(tapTimer);
        lastTap = 0;
        this.like(node, item, true);
        this.heartBurst(node, e.clientX, e.clientY);
      } else {
        lastTap = now;
        tapTimer = setTimeout(() => {
          if (lastTap && Date.now() - lastTap >= 290) {
            lastTap = 0;
            if (item.media.type !== 'video') return;
            if (video.paused) { video.play().catch(() => {}); this.flashIcon(playIcon); }
            else video.pause();
          }
        }, 300);
      }
    });

    if (video) {
      video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
      });
      video.addEventListener('error', () => {
        // Fallback: si el video falla, mostramos el poster como imagen
        const media = node.querySelector('.reels-media');
        if (media && item.media.poster) {
          video.remove();
          const img = document.createElement('img');
          img.className = 'reels-img';
          img.src = item.media.poster;
          img.alt = item.caption.slice(0, 80);
          img.loading = 'lazy';
          media.appendChild(img);
        }
      });
    }

    const img = node.querySelector('.reels-img');
    if (img) img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });

    node.querySelectorAll('[data-act]').forEach(el => {
      const act = el.dataset.act;
      if (act === 'expand') {
        el.addEventListener('click', () => el.classList.toggle('expanded'));
        return;
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (act === 'like') this.like(node, item, false);
        else if (act === 'comment') this.openComments(item);
        else if (act === 'share') this.share(item);
        else if (act === 'save') this.save(node, item);
        else if (act === 'follow') this.follow(node, item);
        else if (act === 'buy') this.quickBuy(el, item);
      });
    });
  }

  /* ---------------- Acciones ---------------- */

  like(node, item, forceOn = false) {
    const next = forceOn ? true : !item.liked;
    // Doble toque sobre un like ya dado: no cambia estado; el llamador muestra el corazón en el punto del toque
    if (next === item.liked) return;
    item.liked = next;
    item.stats.likes += next ? 1 : -1;
    const btn = node.querySelector('.rail-like');
    const count = node.querySelector('[data-count="likes"]');
    if (btn) {
      btn.classList.toggle('liked', next);
      btn.setAttribute('aria-pressed', String(next));
    }
    if (count) count.textContent = formatCount(item.stats.likes);

    // Persistir ANTES del estallido: una animación nunca debe poder cortar la escritura del like
    if (item.fromApi) {
      api.post(`/api/posts/${item.id}/like`, { postId: item.id }).catch(() => {});
    }
    // El rail estalla en el centro; el doble-toque coloca su propio corazón (sin duplicar)
    if (next && !forceOn) this.heartBurstCenter(node);
  }

  heartBurst(node, clientX, clientY) {
    const rect = node.getBoundingClientRect();
    const heart = document.createElement('div');
    heart.className = 'reels-heart';
    heart.innerHTML = '<svg width="90" height="90" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    heart.style.left = `${clientX - rect.left}px`;
    heart.style.top = `${clientY - rect.top}px`;
    node.appendChild(heart);
    // animate() devuelve la Promise de finalización (no el Animation). Con la pestaña oculta la
    // timeline queda pausada y .finished nunca resuelve: el temporizador de respaldo garantiza que
    // el nodo no se fuge en ningún estado (remove es idempotente).
    const quitar = () => heart.remove();
    setTimeout(quitar, 1200);
    animate(heart, [
      { transform: 'translate(-50%,-50%) scale(0) rotate(-12deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.25) rotate(6deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%,-160%) scale(1) rotate(-4deg)', opacity: 0 }
    ], { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      .then(quitar).catch(quitar);
  }

  heartBurstCenter(node) {
    const rect = node.getBoundingClientRect();
    this.heartBurst(node, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  flashIcon(el) {
    if (!el) return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  save(node, item) {
    item.saved = !item.saved;
    const btn = node.querySelector('[data-act="save"]');
    btn?.classList.toggle('saved', item.saved);
    btn?.setAttribute('aria-pressed', String(item.saved));
    toast[item.saved ? 'success' : 'info'](item.saved ? 'Guardado en tu lista' : 'Eliminado de guardados');
  }

  follow(node, item) {
    item.following = !item.following;
    node.querySelectorAll('[data-act="follow"]').forEach(btn => {
      const isText = btn.classList.contains('reels-follow-text');
      btn.classList.toggle('following', item.following);
      if (isText) btn.textContent = item.following ? 'Siguiendo' : 'Seguir';
      else btn.textContent = item.following ? '✓' : '+';
      if (!isText) scaleIn(btn).catch(() => {});
    });
    toast[item.following ? 'success' : 'info'](
      item.following ? `Siguiendo a ${item.author.handle}` : `Dejaste de seguir a ${item.author.handle}`
    );
  }

  async share(item) {
    const url = `${location.origin}${location.pathname}#app?module=feed&post=${encodeURIComponent(item.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `X-SHOP — ${item.author.handle}`, text: item.caption, url });
        item.stats.shares += 1;
        return;
      } catch { /* cancelado: intentamos copiar */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      item.stats.shares += 1;
      if (item.fromApi) api.post(`/api/posts/${item.id}/share`, { postId: item.id }).catch(() => {});
      toast.success('Enlace copiado');
    } catch {
      toast.info(url);
    }
    const countEl = document.querySelector(`[data-index="${this.currentIndex}"] [data-count="shares"]`);
    if (countEl) countEl.textContent = formatCount(item.stats.shares);
  }

  /* ---------------- Comentarios (bottom sheet) ---------------- */

  async openComments(item) {
    this.closeSheet();
    const sheet = document.createElement('div');
    sheet.className = 'reels-sheet';
    sheet.innerHTML = `
      <button class="reels-sheet-backdrop" type="button" aria-label="Cerrar comentarios"></button>
      <div class="reels-sheet-panel" role="dialog" aria-modal="true" aria-label="Comentarios">
        <div class="reels-sheet-head">
          <span>Comentarios <em id="sheet-count">${formatCount(item.stats.comments)}</em></span>
          <button class="reels-icon-btn" type="button" id="sheet-close" aria-label="Cerrar">${ICONS.close}</button>
        </div>
        <div class="reels-comments" id="sheet-list">
          <div class="reels-sheet-loading">Cargando comentarios…</div>
        </div>
        <form class="reels-sheet-form" id="sheet-form">
          <input class="input" id="sheet-input" type="text" placeholder="Escribe un comentario…" maxlength="500" aria-label="Escribe un comentario" required>
          <button class="reels-buy" type="submit">Publicar</button>
        </form>
      </div>`;
    this.container.appendChild(sheet);
    this.sheet = sheet;
    this.sheetItem = item;

    const panel = sheet.querySelector('.reels-sheet-panel');
    slideIn(panel, 'up').catch(() => {});
    fadeIn(sheet.querySelector('.reels-sheet-backdrop')).catch(() => {});

    sheet.querySelector('#sheet-close').addEventListener('click', () => this.closeSheet());
    sheet.querySelector('.reels-sheet-backdrop').addEventListener('click', () => this.closeSheet());
    sheet.querySelector('#sheet-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = sheet.querySelector('#sheet-input');
      const text = input.value.trim();
      if (!text) return;
      const user = JSON.parse(localStorage.getItem('xshop_user') || '{"name":"Tú"}');
      this.appendComment({ user: user.name || 'Tú', text, ago: 'ahora' }, true);
      input.value = '';
      item.stats.comments += 1;
      sheet.querySelector('#sheet-count').textContent = formatCount(item.stats.comments);
      const railCount = document.querySelector(`[data-index="${this.currentIndex}"] [data-count="comments"]`);
      if (railCount) railCount.textContent = formatCount(item.stats.comments);
      if (item.fromApi) api.post(`/api/posts/${item.id}/comment`, { postId: item.id, content: text }).catch(() => {});
    });

    this.onSheetKey = (e) => { if (e.key === 'Escape') this.closeSheet(); };
    document.addEventListener('keydown', this.onSheetKey);

    // Cargar comentarios: API primero, mock como fallback
    let comments = [];
    if (item.fromApi) {
      try {
        const res = await api.get(`/api/posts/${item.id}/comments?limit=30`, { cacheTTL: 10000 });
        if (Array.isArray(res?.data)) comments = res.data.map(c => ({
          user: c.user?.name || 'Usuario', text: c.content, ago: this.timeAgo(c.createdAt)
        }));
      } catch { /* fallback mock */ }
    }
    if (!comments.length) comments = this.mockCommentsFor(item);

    const list = sheet.querySelector('#sheet-list');
    if (!list || this.sheet !== sheet) return;
    list.innerHTML = '';
    comments.forEach(c => this.appendComment(c, false, list));
  }

  mockCommentsFor(item) {
    const seed = item.comments || MOCK_COMMENTS;
    return seed.slice(0, item.stats.comments > 0 ? 6 : 3);
  }

  timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  appendComment(c, own = false, listEl = null) {
    const list = listEl || this.sheet?.querySelector('#sheet-list');
    if (!list) return;
    const loading = list.querySelector('.reels-sheet-loading');
    if (loading) loading.remove();
    const el = document.createElement('div');
    el.className = `reel-comment${own ? ' own' : ''}`;
    const hue = hashHue(c.user);
    el.innerHTML = `
      <span class="rail-avatar" style="width:32px;height:32px;font-size:.7rem;background:hsl(${hue} 65% 42%);color:${hslTextColor(hue, 42)}">${esc(initials(c.user))}</span>
      <div class="reel-comment-body">
        <div class="reel-comment-meta">${esc(c.user)} · ${esc(c.ago || 'ahora')}</div>
        <div class="reel-comment-text">${esc(c.text)}</div>
      </div>`;
    list.appendChild(el);
    slideIn(el, 'up').catch(() => {});
    if (!listEl) list.scrollTop = list.scrollHeight;
  }

  closeSheet() {
    if (!this.sheet) return;
    const sheet = this.sheet;
    this.sheet = null;
    document.removeEventListener('keydown', this.onSheetKey);
    const panel = sheet.querySelector('.reels-sheet-panel');
    // Carrilera de seguridad: con la timeline pausada (pestaña oculta) las
    // animaciones no asientan — el sheet debe removerse igualmente
    Promise.race([
      Promise.all([
        animate(panel, { transform: 'translateY(100%)', opacity: 0.6 }, { duration: 200 }).catch(() => {}),
        animate(sheet.querySelector('.reels-sheet-backdrop'), { opacity: 0 }, { duration: 200 }).catch(() => {})
      ]),
      new Promise(resolve => { setTimeout(resolve, 350); })
    ]).finally(() => sheet.remove());
  }

  /* ---------------- Quick-buy (checkout desde el feed) ---------------- */

  async quickBuy(btn, item) {
    if (!item.product) { toast.info('Este contenido no tiene producto asociado'); return; }
    if (btn.disabled) return;
    btn.disabled = true;

    const modal = createModal({ title: 'Compra rápida', size: 'sm' });
    modal.innerHTML = `
      <div class="qb-product">
        <img src="${esc(item.product.image)}" alt="" data-hide-on-error>
        <div>
          <div class="reels-product-name">${esc(item.product.name)}</div>
          <div class="reels-product-price">${formatPrice(item.product.price)}
            ${item.product.oldPrice ? `<s>${formatPrice(item.product.oldPrice)}</s>` : ''}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="label">Tarjeta</label>
        <select class="input" id="qb-card"><option value="">Cargando tarjetas…</option></select>
      </div>
      <div class="qb-total">
        <span>Total</span><strong>${formatPrice(item.product.price)} PEN</strong>
      </div>
      <x-button class="qb-pay" variant="primary" style="width:100%;">Pagar ahora</x-button>
      <p class="qb-note">Pago simulado — en producción se conecta a Stripe / Mercado Pago / Yape / Plin.</p>
    `;
    document.body.appendChild(modal);
    modal.openModal();
    btn.disabled = false;

    const select = modal.querySelector('#qb-card');
    const payBtn = modal.querySelector('.qb-pay');
    let cards = [];
    try {
      const res = await api.get('/api/cards', { cacheTTL: 10000 });
      cards = Array.isArray(res?.data) ? res.data : [];
    } catch { cards = []; }

    if (!cards.length) {
      select.innerHTML = '<option value="">Sin tarjetas registradas</option>';
      payBtn.textContent = 'Agregar tarjeta en Pagos';
      payBtn.addEventListener('click', () => {
        modal.closeModal();
        location.hash = '#app?module=payments';
        toast.info('Agrega una tarjeta para comprar');
      });
      return;
    }

    select.innerHTML = cards.map((c, i) =>
      `<option value="${esc(c.id)}" ${i === 0 ? 'selected' : ''}>${esc(c.brand || 'Tarjeta')} •••• ${esc(c.last4 || '****')}</option>`
    ).join('');

    payBtn.addEventListener('click', async () => {
      const cardId = select.value;
      if (!cardId) { toast.warning('Selecciona una tarjeta'); return; }
      payBtn.loading = true;
      try {
        const res = await api.post('/api/transactions', {
          amount: Math.round(item.product.price),
          description: `Compra: ${item.product.name}`.slice(0, 200),
          cardId,
          provider: 'manual'
        }, { cache: false });
        if (res?.error) throw new Error(res.error);
        modal.closeModal();
        toast.success(`¡Compra realizada! ${formatPrice(item.product.price)}`);
        events.emit(AppEvents.PAYMENT_SUCCESS, { item: item.product, result: res });
      } catch (err) {
        toast.danger(err?.message || 'No se pudo procesar el pago');
      } finally {
        payBtn.loading = false;
      }
    });
  }

  /* ---------------- Navegación / ciclo de vida ---------------- */

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      if (!this.itemHeight) return;
      const idx = Math.min(
        this.items.length - 1,
        Math.max(0, Math.round(this.scroller.scrollTop / this.itemHeight))
      );
      this.updateWindow(idx);
      if (idx !== this.currentIndex) this.setCurrent(idx);
      if (this.items.length - idx <= LOAD_MORE_AT) this.loadMore();
      if (this.hintEl && !this.hintEl.hidden && this.scroller.scrollTop > this.itemHeight / 2) {
        this.hintEl.hidden = true;
      }
    });
  }

  setCurrent(idx) {
    this.currentIndex = idx;
    this.counterEl.textContent = `${idx + 1}/${this.items.length}`;

    // Pausar todo salvo el actual
    this.pool.forEach(node => {
      const v = node.querySelector('video');
      if (!v) return;
      if (this.boundIndex(node) === idx) {
        v.muted = this.muted;
        if (!document.hidden) v.play().catch(() => {});
      } else {
        v.pause();
      }
    });

    // Entrada del overlay
    const node = this.pool.find(n => this.boundIndex(n) === idx);
    if (node) {
      const info = node.querySelector('.reels-info');
      const rail = node.querySelector('.reels-rail');
      if (info) slideIn(info, 'up').catch(() => {});
      if (rail) slideIn(rail, 'up', 80).catch(() => {});
    }

    if (idx >= this.items.length - LOAD_MORE_AT) this.loadMore();
  }

  scrollToIndex(i) {
    const idx = Math.min(this.items.length - 1, Math.max(0, i));
    this.scroller.scrollTo({ top: idx * this.itemHeight, behavior: 'smooth' });
  }

  onKeydown(e) {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
      e.preventDefault();
      this.scrollToIndex(this.currentIndex + 1);
    } else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) {
      e.preventDefault();
      this.scrollToIndex(this.currentIndex - 1);
    } else if (k === 'Home') {
      e.preventDefault();
      this.scrollToIndex(0);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.muteBtn.innerHTML = this.muted ? ICONS.mute : ICONS.volume;
    this.muteBtn.setAttribute('aria-label', this.muted ? 'Activar sonido' : 'Silenciar');
    this.pool.forEach(node => {
      const v = node.querySelector('video');
      if (v) v.muted = this.muted;
    });
    if (!this.muted) {
      const node = this.pool.find(n => this.boundIndex(n) === this.currentIndex);
      node?.querySelector('video')?.play().catch(() => {});
    }
    toast.info(this.muted ? 'Silenciado' : 'Sonido activado');
  }

  onVisibility() {
    const node = this.pool.find(n => this.boundIndex(n) === this.currentIndex);
    const v = node?.querySelector('video');
    if (!v) return;
    if (document.hidden) v.pause();
    else if (!this.scroller.hidden) v.play().catch(() => {});
  }

  refresh() {
    this.closeSheet();
    this.pool.forEach(n => this.releaseNode(n));
    this.items = [];
    this.mockCursor = 0;
    this.apiCursor = null;
    this.hasMore = true;
    this.currentIndex = 0;
    this.scroller.scrollTop = 0;
    this.loadingEl.hidden = false;
    this.loadFeed().then(() => {
      this.buildPool();
      this.updateWindow(0, true);
      this.setCurrent(0);
      toast.success('Feed actualizado');
    });
  }

  destroy() {
    this.destroyed = true;
    this.closeSheet();
    this.scroller?.removeEventListener('scroll', this.onScroll);
    this.scroller?.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('keydown', this.onSheetKey);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.pool.forEach(n => {
      n.querySelector('video')?.pause();
      n.remove();
    });
    this.pool = [];
  }
}
