/* ==========================================================
   HARD PART — script.js
   Phase 1: mobile menu + the hero "part" line.
   ========================================================== */
(function () {
  'use strict';

  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open')); // lets the clip-path transition run
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 600);
    }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 821px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- 3D chair (lazy) ----------
     chair.js + Three.js are only fetched when the section nears the viewport.
     Small, low-memory or data-saver devices get the static preview plus a
     "Load 3D view" button instead. Any failure keeps the static preview. */
  const stage = document.getElementById('chairStage');
  if (stage) {
    const canvas = stage.querySelector('.chair__canvas');
    const badge = document.getElementById('chairBadge');
    const loadBtn = document.getElementById('chairLoad');
    const caption = document.getElementById('chairCaption');
    const chips = Array.from(document.querySelectorAll('[data-view]'));
    const lowPower = window.matchMedia('(max-width: 820px)').matches ||
      (navigator.connection && navigator.connection.saveData) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 2);
    let controller = null, state = 'idle'; // idle | loading | ready

    const setChips = (on) => chips.forEach((c) => { c.disabled = !on; });
    const fallback = (label) => {
      state = 'idle';
      stage.classList.remove('is-3d', 'is-loading');
      badge.textContent = label || 'Static preview';
      setChips(false);
      loadBtn.textContent = 'Try 3D view';
      loadBtn.hidden = false;
    };
    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

    async function startChair() {
      if (state !== 'idle') return;
      state = 'loading';
      loadBtn.hidden = true;
      stage.classList.add('is-loading');
      try {
        if (!window.HardPartChair) await loadScript('chair.js');
        controller = await window.HardPartChair.create(stage, canvas, { onLost: () => fallback('Static preview') });
        state = 'ready';
        stage.classList.remove('is-loading');
        stage.classList.add('is-3d');
        badge.textContent = 'Live 3D';
        setChips(true);
      } catch (err) {
        console.warn('3D chair unavailable; showing the static preview.', err);
        fallback('Static preview (3D unavailable)');
      }
    }

    chips.forEach((chip) => chip.addEventListener('click', () => {
      if (!controller) return;
      controller.setView(chip.dataset.view);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      caption.textContent = chip.dataset.caption;
    }));
    loadBtn.addEventListener('click', startChair);

    if (lowPower) {
      loadBtn.textContent = 'Load 3D view';
      loadBtn.hidden = false;
    } else {
      const io = new IntersectionObserver(([en]) => {
        if (en.isIntersecting) { io.disconnect(); startChair(); }
      }, { rootMargin: '400px' });
      io.observe(stage);
    }
  }

  /* ---------- Hero parallax ----------
     Writes two CSS variables on the hero (read by style.css):
       --sy  scroll distance in px     --mx  pointer position, -1…1 (eased)
     Skipped entirely when the visitor prefers reduced motion. */
  const hero = document.querySelector('.hero');
  if (!hero || reduceMotion) return;

  let sy = 0, mx = 0, targetMx = 0, ticking = false, visible = true;

  function render() {
    mx += (targetMx - mx) * 0.08;
    hero.style.setProperty('--sy', sy.toFixed(1));
    hero.style.setProperty('--mx', mx.toFixed(3));
    ticking = Math.abs(targetMx - mx) > 0.002 && visible;
    if (ticking) requestAnimationFrame(render);
  }
  function queue() { if (!ticking && visible) { ticking = true; requestAnimationFrame(render); } }

  window.addEventListener('scroll', () => { sy = Math.min(window.scrollY, window.innerHeight * 1.2); queue(); }, { passive: true });
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    targetMx = (e.clientX / window.innerWidth) * 2 - 1;
    queue();
  });
  hero.addEventListener('pointerleave', () => { targetMx = 0; queue(); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);
})();
