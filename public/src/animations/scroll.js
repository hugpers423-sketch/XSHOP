// src/animations/scroll.js — Animaciones por scroll (CSS + fallback JS)
export function initScrollAnimations() {
  // Animaciones de scroll nativas en CSS (Chrome 115+, Safari 17+)
  if (CSS.supports('animation-timeline: scroll()')) {
    document.documentElement.style.setProperty('--scroll-supported', '1');
    return;
  }

  // Fallback JS: IntersectionObserver
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const animType = el.dataset.animate || 'slide-up';
        const delay = parseFloat(el.dataset.delay || '0') * 1000;
        setTimeout(() => el.classList.add('in-view'), delay);
        observer.unobserve(el);
      }
    });
  }, { rootMargin: '100px 0px', threshold: 0.1 });

  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
}

export function initParallax() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  let ticking = false;
  const parallaxElements = document.querySelectorAll('[data-parallax]');

  function update() {
    const scrollY = window.scrollY;
    parallaxElements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      const offset = scrollY * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
    ticking = false;
  }

  function onScroll() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }

  if (parallaxElements.length) window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

export function initRevealOnScroll(selector = '.scroll-reveal', options = {}) {
  const { rootMargin = '50px', threshold = 0.1, once = true } = options;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        if (once) observer.unobserve(entry.target);
      } else if (!once) {
        entry.target.classList.remove('revealed');
      }
    });
  }, { rootMargin, threshold });
  document.querySelectorAll(selector).forEach(el => observer.observe(el));
  return () => observer.disconnect();
}