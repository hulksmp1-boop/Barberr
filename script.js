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

  const inertTargets = () => Array.from(document.querySelectorAll('main, footer, .skip'));
  function setMenu(open, returnFocus) {
    if (menu.classList.contains('is-open') === open && !menu.hidden === open) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    inertTargets().forEach((el) => { el.inert = open; });      // keeps keyboard focus inside the header and menu
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => { menu.classList.add('is-open'); const first = menu.querySelector('a'); if (first) first.focus({ preventScroll: true }); });
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 600);
      if (returnFocus) menuBtn.focus();
    }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false, true); });
  window.matchMedia('(min-width: 821px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Navigation: mark the section in view ---------- */
  const spyLinks = Array.from(document.querySelectorAll('.nav__links a[href^="#"]'));
  if (spyLinks.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      spyLinks.forEach((a) => { a.getAttribute('href') === '#' + en.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
    }), { rootMargin: '-45% 0px -50% 0px' });
    spyLinks.forEach((a) => { const t = document.querySelector(a.getAttribute('href')); if (t) spy.observe(t); });
    new IntersectionObserver(([en]) => { if (en.isIntersecting) spyLinks.forEach((a) => a.removeAttribute('aria-current')); }, { rootMargin: '-45% 0px -50% 0px' })
      .observe(document.querySelector('.hero'));
  }

  /* ---------- Scroll reveals ----------
     Any .reveal element fades up once when it enters the viewport. */
  const reveals = document.querySelectorAll('.reveal, .img-reveal');
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('is-visible'));
    } else {
      // Clipped image wrappers (.img-reveal) are observed through their parent,
      // because a fully clipped element can report no intersection. A Map lets one
      // watched element reveal several targets (e.g. a card and its image).
      const groups = new Map();
      reveals.forEach((el) => {
        const watch = el.classList.contains('img-reveal') ? el.parentElement : el;
        if (!groups.has(watch)) groups.set(watch, []);
        groups.get(watch).push(el);
      });
      const ro = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { groups.get(en.target).forEach((t) => t.classList.add('is-visible')); ro.unobserve(en.target); }
      }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      groups.forEach((_, watch) => ro.observe(watch));
    }
  }

  /* ---------- Service selection ----------
     One service can be selected at a time. The choice is kept in localStorage
     ("hardpart.service") so the booking phase can read it, and a
     "hardpart:service" event is dispatched for other scripts. Demo data only. */
  const svcList = document.getElementById('svcList');
  if (svcList) {
    const KEY = 'hardpart.service';
    const rows = Array.from(svcList.querySelectorAll('.svc'));
    const summary = document.getElementById('svcSummaryText');
    const cont = document.getElementById('svcContinue');
    const depSvc = document.getElementById('depSvc');
    const depDue = document.getElementById('depDue');
    const DEPOSIT = 10; // illustrative
    const money = (n) => '$' + n;

    const read = (row) => ({ id: row.dataset.id, name: row.dataset.name, duration: +row.dataset.duration, price: +row.dataset.price });
    const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* storage blocked: selection still works in memory */ } };
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };

    function render(sel) {
      rows.forEach((row) => {
        const on = !!sel && row.dataset.id === sel.id;
        row.classList.toggle('is-selected', on);
        const btn = row.querySelector('.svc__book');
        btn.setAttribute('aria-pressed', String(on));
        btn.firstChild.textContent = on ? 'Selected' : 'Book';
      });
      if (sel) {
        summary.innerHTML = sel.name + ' <small>' + sel.duration + ' min, ' + money(sel.price) + ' demo price</small>';
        cont.hidden = false;
        depSvc.textContent = sel.name + ', ' + money(sel.price);
        depDue.textContent = money(Math.max(sel.price - DEPOSIT, 0));
      } else {
        summary.textContent = 'Choose a service to begin.';
        cont.hidden = true;
        depSvc.textContent = 'Choose a service above';
        depDue.textContent = '—';
      }
    }

    function select(row) {
      const same = row.classList.contains('is-selected');   // clicking again clears the choice
      const sel = same ? null : read(row);
      save(sel);
      render(sel);
      window.dispatchEvent(new CustomEvent('hardpart:service', { detail: sel }));
    }

    rows.forEach((row) => row.querySelector('.svc__book').addEventListener('click', () => select(row)));
    window.addEventListener('hardpart:service-sync', (e) => render(e.detail));   // booking.js changed the choice
    const saved = load();
    render(saved && rows.some((r) => r.dataset.id === saved.id) ? saved : null);
  }

  /* ---------- Barber selection ----------
     Saved to localStorage ("hardpart.barber") for the booking phase; "No preference" is id "any". */
  const barberCards = Array.from(document.querySelectorAll('.barber'));
  if (barberCards.length) {
    const BKEY = 'hardpart.barber';
    const anyBtn = document.getElementById('barberAny');
    const bText = document.getElementById('barberSummaryText');
    const bCont = document.getElementById('barberContinue');
    const bSave = (v) => { try { v ? localStorage.setItem(BKEY, JSON.stringify(v)) : localStorage.removeItem(BKEY); } catch (e) { /* storage blocked */ } };
    const bLoad = () => { try { return JSON.parse(localStorage.getItem(BKEY)); } catch (e) { return null; } };

    function renderBarber(sel) {
      barberCards.forEach((card) => {
        const on = !!sel && card.dataset.id === sel.id;
        card.classList.toggle('is-selected', on);
        const btn = card.querySelector('.barber__pick');
        btn.setAttribute('aria-pressed', String(on));
        btn.firstElementChild.textContent = on ? 'Chosen' : 'Choose ' + card.dataset.name.split(' ')[0];
      });
      anyBtn.setAttribute('aria-pressed', String(!!sel && sel.id === 'any'));
      bText.innerHTML = sel
        ? (sel.id === 'any' ? 'No preference. We will assign a barber.' : sel.name + ' <small>' + sel.specialty + '</small>')
        : 'No barber chosen yet.';
      bCont.hidden = !sel;
    }
    function chooseBarber(sel, current) {
      const next = current && sel && current.id === sel.id ? null : sel; // same choice again clears it
      bSave(next); renderBarber(next);
      window.dispatchEvent(new CustomEvent('hardpart:barber', { detail: next }));
    }
    let currentBarber = bLoad();
    const valid = (v) => v && (v.id === 'any' || barberCards.some((c) => c.dataset.id === v.id));
    if (!valid(currentBarber)) currentBarber = null;
    renderBarber(currentBarber);

    barberCards.forEach((card) => card.querySelector('.barber__pick').addEventListener('click', () => {
      chooseBarber({ id: card.dataset.id, name: card.dataset.name, specialty: card.dataset.specialty }, currentBarber);
      currentBarber = bLoad();
    }));
    window.addEventListener('hardpart:barber-sync', (e) => { currentBarber = e.detail; renderBarber(e.detail); });   // booking.js changed the choice
    anyBtn.addEventListener('click', () => { chooseBarber({ id: 'any', name: 'No preference', specialty: '' }, currentBarber); currentBarber = bLoad(); });
  }

  /* ---------- Gallery filter ---------- */
  const gGrid = document.getElementById('galleryGrid');
  if (gGrid) {
    const items = Array.from(gGrid.children);
    const fChips = Array.from(document.querySelectorAll('[data-filter]'));
    const gStatus = document.getElementById('galleryStatus');
    fChips.forEach((chip) => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      fChips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      let shown = 0;
      items.forEach((it) => {
        const match = f === 'all' || it.dataset.cat === f;
        clearTimeout(it._t);
        if (match) {
          shown++;
          it.hidden = false;
          requestAnimationFrame(() => requestAnimationFrame(() => it.classList.remove('is-out')));
        } else {
          it.classList.add('is-out');
          it._t = setTimeout(() => { it.hidden = true; }, reduceMotion ? 0 : 350);
        }
      });
      gStatus.textContent = 'Showing ' + shown + (shown === 1 ? ' cut' : ' cuts');
    }));
  }

  /* ---------- Demo rating (calculated from the demo testimonials on the page) ---------- */
  const quotes = Array.from(document.querySelectorAll('.quote[data-rating]'));
  const ratingNum = document.getElementById('ratingNum');
  if (quotes.length && ratingNum) {
    const vals = quotes.map((q) => +q.dataset.rating);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    ratingNum.textContent = avg.toFixed(1);
    const rs = document.getElementById('ratingStars');
    rs.style.setProperty('--r', avg.toFixed(2));
    rs.setAttribute('aria-label', 'Average rating ' + avg.toFixed(1) + ' out of 5 stars');
    document.getElementById('ratingText').textContent = 'Demo rating from ' + vals.length + ' fictional reviews';
    const bars = document.getElementById('ratingBars');
    for (let s = 5; s >= 1; s--) {
      const n = vals.filter((v) => v === s).length;
      const li = document.createElement('li');
      li.innerHTML = '<span>' + s + '★</span><span class="bar" style="--w:' + (n / vals.length).toFixed(2) + '"></span><span>' + n + '</span>';
      bars.appendChild(li);
    }
  }

  /* ---------- FAQ accordion ----------
     Buttons toggle aria-expanded; the panel animates via CSS. Arrow keys, Home and End move between questions. */
  const faqBtns = Array.from(document.querySelectorAll('.faq__btn'));
  faqBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.closest('.faq__item').classList.toggle('is-open', open);
    });
    btn.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: faqBtns.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      faqBtns[(keys[e.key] + faqBtns.length) % faqBtns.length].focus();
    });
  });

  /* ---------- Highlight today's opening hours (visitor's local day) ---------- */
  const todayRow = document.querySelector('#hours li[data-day="' + new Date().getDay() + '"]');
  if (todayRow) todayRow.classList.add('is-today');

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
