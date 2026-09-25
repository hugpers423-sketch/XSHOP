// src/animations/waapi.js — Helpers de Web Animations API | Cero deps, 60fps
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animate(el, keyframes, options = {}) {
  if (prefersReduced()) { el.style.cssText += ';transition:none!important;animation:none!important'; return Promise.resolve(); }
  const anim = el.animate(keyframes, { duration: 200, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'both', ...options });
  return anim.finished;
}

export const ripple = (el, event) => {
  if (prefersReduced()) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = (event?.clientX || rect.left + rect.width/2) - rect.left - size/2;
  const y = (event?.clientY || rect.top + rect.height/2) - rect.top - size/2;
  const rippleEl = document.createElement('span');
  rippleEl.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:currentColor;opacity:0.3;border-radius:50%;transform:scale(0);pointer-events:none;`;
  const computed = getComputedStyle(el);
  if (computed.position === 'static') el.style.position = 'relative';
  el.appendChild(rippleEl);
  rippleEl.animate([{ transform: 'scale(0)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 0 }],
    { duration: 400, easing: 'cubic-bezier(0.4,0,0.2,1)' }).finished.then(() => rippleEl.remove()).catch(() => rippleEl.remove());
};

export const press = (el, isPressed) => {
  if (prefersReduced()) return;
  animate(el, { transform: isPressed ? 'scale(0.96)' : 'scale(1)' }, { duration: isPressed ? 100 : 150 });
};

export const slideIn = (el, direction = 'up', delay = 0) => {
  if (prefersReduced()) return Promise.resolve();
  const translates = { up: 'translateY(20px)', down: 'translateY(-20px)', left: 'translateX(20px)', right: 'translateX(-20px)' };
  return animate(el, [
    { opacity: 0, transform: translates[direction] },
    { opacity: 1, transform: 'translate(0)' }
  ], { duration: 400, delay, easing: 'cubic-bezier(0.4,0,0.2,1)' });
};

export const fadeIn = (el, delay = 0) => animate(el, { opacity: [0, 1] }, { duration: 300, delay });
export const fadeOut = (el) => animate(el, { opacity: [1, 0] }, { duration: 200 });
export const scaleIn = (el, delay = 0) => animate(el, [
  { opacity: 0, transform: 'scale(0.95)' },
  { opacity: 1, transform: 'scale(1)' }
], { duration: 300, delay, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });

export const shimmer = (el) => {
  if (prefersReduced()) return;
  const pseudo = el.animate([
    { transform: 'translateX(-100%)' },
    { transform: 'translateX(100%)' }
  ], { duration: 1500, iterations: Infinity, easing: 'linear' });
  return () => pseudo.cancel();
};

export const counter = (el, from, to, duration = 1000, formatter = n => n.toLocaleString()) => {
  if (prefersReduced()) { el.textContent = formatter(to); return Promise.resolve(); }
  const start = performance.now();
  return new Promise(resolve => {
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatter(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
};

export const stagger = (elements, fn, baseDelay = 50) => {
  return Promise.all([...elements].map((el, i) => fn(el, i * baseDelay)));
};

export const morph = (el, fromRect, toRect) => {
  if (prefersReduced()) return Promise.resolve();
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  const sx = fromRect.width / toRect.width;
  const sy = fromRect.height / toRect.height;
  return animate(el, [
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    { transform: 'translate(0, 0) scale(1, 1)' }
  ], { duration: 300, easing: 'cubic-bezier(0.4,0,0.2,1)' });
};

// Animaciones por scroll (fallback CSS nativo)
export function setupScrollAnimations() {
  if (!('animate' in document.documentElement) || prefersReduced()) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '50px', threshold: 0.1 });
  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
}