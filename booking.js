/* ==========================================================
   HARD PART — booking.js
   Frontend-only booking DEMONSTRATION. No backend, no payments,
   and no real appointment is ever created.
   State lives in LocalStorage under "hardpart.booking".
   Steps: 1 Service, 2 Barber, 3 Date, 4 Time, 5 Details, 6 Review, 7 Confirmation.
   ========================================================== */
(function () {
  'use strict';

  const KEY = 'hardpart.booking', SKEY = 'hardpart.service', BKEY = 'hardpart.barber';
  const DEPOSIT = 10;                                   // illustrative only
  const STEPS = ['Service', 'Barber', 'Date', 'Time', 'Details', 'Review'];
  const DONE = 7;
  const WINDOW_DAYS = 60;                               // how far ahead the demo calendar goes

  const panel = document.getElementById('bookPanel');
  if (!panel) return;
  const root = document.getElementById('booking');
  const stepperEl = document.getElementById('stepper');
  const summaryEl = document.getElementById('bookSummary');
  const navEl = document.getElementById('bookNav');
  const backBtn = document.getElementById('bookBack');
  const nextBtn = document.getElementById('bookNext');
  const hintEl = document.getElementById('bookHint');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Data (read from the page so it always matches the Services and Barbers sections) ---------- */
  const SERVICES = Array.from(document.querySelectorAll('.svc')).map((r) => ({
    id: r.dataset.id, name: r.dataset.name, duration: +r.dataset.duration, price: +r.dataset.price
  }));
  const BARBERS = Array.from(document.querySelectorAll('.barber')).map((c) => ({
    id: c.dataset.id, name: c.dataset.name, specialty: c.dataset.specialty, img: c.querySelector('img').getAttribute('src')
  }));
  BARBERS.push({ id: 'any', name: 'No preference', specialty: 'The first free barber', img: null });

  const svcById = (id) => SERVICES.find((s) => s.id === id) || null;
  const barberById = (id) => BARBERS.find((b) => b.id === id) || null;

  /* ---------- Small helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };   // local date, no timezone drift
  const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtLong = (s) => new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parse(s));
  const fmtTime = (m) => ((Math.floor(m / 60) % 12) || 12) + ':' + pad(m % 60) + ' ' + (m < 720 ? 'AM' : 'PM');
  const money = (n) => '$' + n;

  /* Demo opening hours, in minutes from midnight, by weekday (0 = Sunday). Monday is closed. */
  const HOURS = { 0: [600, 960], 1: null, 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [540, 1020] };
  const hoursFor = (s) => HOURS[parse(s).getDay()];

  function dateStatus(s) {                                  // 'ok' | 'past' | 'closed' | 'far'
    const d = parse(s), t = startOfToday();
    if (d < t) return 'past';
    if (d > addDays(t, WINDOW_DAYS)) return 'far';
    return hoursFor(s) ? 'ok' : 'closed';
  }

  /* Pseudo-random but stable "already booked" slots, so the demo feels like a real schedule. */
  function isTaken(date, barberId, t) {
    let h = 2166136261;
    const str = date + '|' + barberId + '|' + t;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100) < 30;
  }

  /* ---------- State ---------- */
  const blank = () => ({ step: 1, service: null, barber: null, date: null, time: null, customer: { name: '', email: '', phone: '' }, consent: false, confirmation: null });
  let S = blank();          // real state is loaded at the bottom, after every helper below is defined
  let cal = { y: 0, m: 0 };
  let errors = {};

  function calFor(dateStr) { const d = dateStr ? parse(dateStr) : startOfToday(); return { y: d.getFullYear(), m: d.getMonth() }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked: demo still works in memory */ } }

  function load() {
    let s = blank();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') s = Object.assign(s, raw);
      s.customer = Object.assign(blank().customer, s.customer || {});
    } catch (e) { s = blank(); }
    try {   // pick up choices made earlier in the Services and Barbers sections
      if (!s.service) { const x = JSON.parse(localStorage.getItem(SKEY)); if (x && x.id) s.service = x.id; }
      if (!s.barber) { const x = JSON.parse(localStorage.getItem(BKEY)); if (x && x.id) s.barber = x.id; }
    } catch (e) { /* ignore */ }
    return sanitize(s);
  }

  /* Drop anything stale or tampered with, then clamp the step to what is actually complete. */
  function sanitize(s) {
    if (!svcById(s.service)) s.service = null;
    if (!barberById(s.barber)) s.barber = null;
    if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || dateStatus(s.date) !== 'ok') s.date = null;
    const prev = S; S = s;                                  // timeValid() reads the current state
    if (s.time !== null && !timeValid()) s.time = null;
    S = prev;
    s.consent = false;
    if (s.confirmation && typeof s.confirmation.ref === 'string' && s.service && s.barber && s.date && s.time !== null) { s.step = DONE; return s; }
    s.confirmation = null;
    const prevS = S; S = s;
    s.step = Math.min(Math.max(1, parseInt(s.step, 10) || 1), maxStep());
    S = prevS;
    return s;
  }

  /* ---------- Validation ---------- */
  const NAME_OK = (v) => v.trim().length >= 2 && /\p{L}/u.test(v);
  const EMAIL_OK = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const PHONE_OK = (v) => /^[+()\-.\s\d]+$/.test(v.trim()) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15;
  function fieldErrors() {
    const c = S.customer, e = {};
    if (!NAME_OK(c.name)) e.name = 'Enter your full name (at least 2 characters).';
    if (!EMAIL_OK(c.email)) e.email = 'Enter a valid email address, like name@example.com.';
    if (!PHONE_OK(c.phone)) e.phone = 'Enter a phone number with 7 to 15 digits.';
    return e;
  }

  function slotList() {
    const sv = svcById(S.service);
    if (!sv || !S.date) return [];
    const h = hoursFor(S.date);
    if (!h) return [];
    const out = [];
    for (let t = h[0]; t + sv.duration <= h[1]; t += 30) out.push(t);
    return out;
  }
  function slotState(t) {                                   // 'ok' | 'past' | 'taken'
    if (S.date === ymd(new Date())) {
      const n = new Date();
      if (t <= n.getHours() * 60 + n.getMinutes() + 30) return 'past';
    }
    const ids = S.barber === 'any' ? BARBERS.filter((b) => b.id !== 'any').map((b) => b.id) : [S.barber];
    return ids.some((id) => !isTaken(S.date, id, t)) ? 'ok' : 'taken';
  }
  function timeValid() { return S.time !== null && slotList().includes(S.time) && slotState(S.time) === 'ok'; }

  function valid(step) {
    switch (step) {
      case 1: return !!svcById(S.service);
      case 2: return !!barberById(S.barber);
      case 3: return !!S.date && dateStatus(S.date) === 'ok';
      case 4: return timeValid();
      case 5: return Object.keys(fieldErrors()).length === 0;
      case 6: return S.consent === true;
      default: return false;
    }
  }
  function maxStep() { for (let i = 1; i <= 5; i++) if (!valid(i)) return i; return 6; }

  /* Keep the later choices consistent when an earlier one changes. */
  function reconcile() { if (S.time !== null && !timeValid()) S.time = null; }

  /* Share the choice with the Services and Barbers sections (script.js listens for these events). */
  function pushSelections() {
    const sv = svcById(S.service), b = barberById(S.barber);
    try {
      sv ? localStorage.setItem(SKEY, JSON.stringify(sv)) : localStorage.removeItem(SKEY);
      b ? localStorage.setItem(BKEY, JSON.stringify({ id: b.id, name: b.name, specialty: b.id === 'any' ? '' : b.specialty })) : localStorage.removeItem(BKEY);
    } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('hardpart:service-sync', { detail: sv }));
    window.dispatchEvent(new CustomEvent('hardpart:barber-sync', { detail: b ? { id: b.id, name: b.name, specialty: b.id === 'any' ? '' : b.specialty } : null }));
  }

  /* ---------- Rendering ---------- */
  function renderStepper() {
    const reach = maxStep();
    stepperEl.innerHTML = STEPS.map((label, i) => {
      const n = i + 1, done = S.step === DONE || n < S.step, cur = S.step === n;
      const enabled = S.step !== DONE && n <= reach && !cur;
      return '<li class="stepper__item' + (cur ? ' is-current' : '') + (done ? ' is-done' : '') + '">' +
        '<button type="button" data-goto="' + n + '"' + (enabled ? '' : ' disabled') + (cur ? ' aria-current="step"' : '') + '>' +
        '<span class="stepper__n num">' + (done ? '✓' : n) + '</span><span class="stepper__l">' + label + '</span></button></li>';
    }).join('');
  }

  function renderSummary() {
    const sv = svcById(S.service), b = barberById(S.barber);
    const none = '<span class="muted">Not chosen yet</span>';
    const time = S.time !== null && sv ? fmtTime(S.time) + ' to ' + fmtTime(S.time + sv.duration) : none;
    summaryEl.innerHTML =
      '<h3 class="summary__title">Your booking <span class="services__tag">Demo</span></h3>' +
      '<dl class="summary__list">' +
      '<div><dt>Service</dt><dd>' + (sv ? esc(sv.name) + ' <span class="muted">' + sv.duration + ' min</span>' : none) + '</dd></div>' +
      '<div><dt>Barber</dt><dd>' + (b ? esc(b.name) : none) + '</dd></div>' +
      '<div><dt>Date</dt><dd>' + (S.date ? esc(fmtLong(S.date)) : none) + '</dd></div>' +
      '<div><dt>Time</dt><dd>' + time + '</dd></div></dl>' +
      '<dl class="summary__money">' +
      '<div><dt>Service price <span class="muted">(demo)</span></dt><dd class="num">' + (sv ? money(sv.price) : '—') + '</dd></div>' +
      '<div><dt>Illustrative deposit</dt><dd class="num">' + money(DEPOSIT) + '</dd></div>' +
      '<div class="is-total"><dt>Left at the chair</dt><dd class="num">' + (sv ? money(Math.max(sv.price - DEPOSIT, 0)) : '—') + '</dd></div></dl>' +
      '<p class="caption">Demonstration only. No payment is taken and no appointment is booked.</p>';
  }

  function renderNav() {
    const step = S.step;
    navEl.hidden = step === DONE;
    summaryEl.classList.toggle('is-done', step === DONE);
    if (step === DONE) return;
    backBtn.hidden = step === 1;
    nextBtn.textContent = step === 5 ? 'Review booking' : step === 6 ? 'Confirm demo booking' : 'Continue';
    nextBtn.disabled = step === 5 ? false : !valid(step);
    const hints = { 1: 'Choose a service to continue.', 2: 'Choose a barber, or leave it to us.', 3: 'Pick an open day. Mondays are closed.', 4: 'Pick a time to continue.', 5: '', 6: 'Tick the box to confirm the demo booking.' };
    hintEl.textContent = nextBtn.disabled ? hints[step] : '';
  }

  const title = (t, sub) => '<h3 class="panel__title" id="panelTitle" tabindex="-1">' + t + '</h3>' + (sub ? '<p class="panel__sub">' + sub + '</p>' : '');

  function viewService() {
    return title('Choose your service', 'Six demo services. Prices and durations are illustrative.') +
      '<div class="opts" role="radiogroup" aria-labelledby="panelTitle">' + SERVICES.map((s) =>
        '<label class="opt"><input type="radio" name="service" value="' + s.id + '"' + (S.service === s.id ? ' checked' : '') + '>' +
        '<span class="opt__body"><span class="opt__name">' + esc(s.name) + '</span><span class="opt__meta num">' + s.duration + ' min</span>' +
        '<span class="opt__price num">' + money(s.price) + ' <small>demo</small></span></span></label>').join('') + '</div>';
  }

  function viewBarber() {
    return title('Choose your barber', 'Fictional barbers. Pick one, or let us assign the first free chair.') +
      '<div class="opts" role="radiogroup" aria-labelledby="panelTitle">' + BARBERS.map((b) =>
        '<label class="opt"><input type="radio" name="barber" value="' + b.id + '"' + (S.barber === b.id ? ' checked' : '') + '>' +
        '<span class="opt__body opt__body--person">' +
        (b.img ? '<img class="opt__thumb" src="' + esc(b.img) + '" alt="" width="56" height="56" loading="lazy">' : '<span class="opt__thumb opt__thumb--any" aria-hidden="true">Any</span>') +
        '<span class="opt__name">' + esc(b.name) + '</span><span class="opt__meta">' + esc(b.specialty) + '</span></span></label>').join('') + '</div>';
  }

  function calendarHTML() {
    const today = startOfToday(), last = addDays(today, WINDOW_DAYS);
    const first = new Date(cal.y, cal.m, 1);
    const lead = (first.getDay() + 6) % 7;                  // Monday-first grid
    const days = new Date(cal.y, cal.m + 1, 0).getDate();
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(first);
    const canPrev = new Date(cal.y, cal.m, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
    const canNext = new Date(cal.y, cal.m + 1, 1) <= last;
    // roving tabindex: the selected day, else the first bookable day, receives Tab focus
    let focusTarget = S.date && parse(S.date).getMonth() === cal.m && parse(S.date).getFullYear() === cal.y ? S.date : null;
    if (!focusTarget) for (let d = 1; d <= days; d++) { const s = ymd(new Date(cal.y, cal.m, d)); if (dateStatus(s) === 'ok') { focusTarget = s; break; } }
    let cells = '<span class="cal__blank" aria-hidden="true"></span>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const dt = new Date(cal.y, cal.m, d), s = ymd(dt), st = dateStatus(s), sel = S.date === s;
      const note = st === 'ok' ? 'available' : st === 'closed' ? 'closed' : st === 'past' ? 'in the past' : 'too far ahead';
      cells += '<button type="button" class="cal__day' + (sel ? ' is-selected' : '') + (s === ymd(today) ? ' is-today' : '') + '" data-date="' + s + '"' +
        (st !== 'ok' ? ' aria-disabled="true"' : '') + ' aria-pressed="' + sel + '" tabindex="' + (s === focusTarget ? 0 : -1) + '"' +
        ' aria-label="' + esc(fmtLong(s)) + ', ' + note + '">' + d + '</button>';
    }
    return '<div class="cal__head"><button type="button" class="cal__nav" data-cal="-1" aria-label="Previous month"' + (canPrev ? '' : ' disabled') + '>←</button>' +
      '<p class="cal__month" id="calLabel" aria-live="polite">' + label + '</p>' +
      '<button type="button" class="cal__nav" data-cal="1" aria-label="Next month"' + (canNext ? '' : ' disabled') + '>→</button></div>' +
      '<div class="cal__weekdays" aria-hidden="true">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => '<span>' + w + '</span>').join('') + '</div>' +
      '<div class="cal__grid" id="calGrid">' + cells + '</div>';
  }
  function viewDate() {
    const h = S.date && hoursFor(S.date);
    return title('Choose a date', 'Demo calendar, open up to ' + WINDOW_DAYS + ' days ahead. Use the arrow keys to move between days.') +
      '<div class="cal" id="cal">' + calendarHTML() + '</div>' +
      '<p class="caption" id="calNote">' + (h ? esc(fmtLong(S.date)) + ': open ' + fmtTime(h[0]) + ' to ' + fmtTime(h[1]) + ' (demo hours).' : 'Mondays are closed in this demo.') + '</p>';
  }

  function viewTime() {
    const sv = svcById(S.service);
    const list = slotList();
    let body;
    if (!list.length) body = '<p class="panel__sub">Choose a service and date first.</p>';
    else {
      const states = list.map((t) => [t, slotState(t)]);
      if (!states.some(([, st]) => st === 'ok')) body = '<p class="panel__sub">No times are left on this day. Please choose another date.</p>';
      else {
        const groups = [['Morning', (t) => t < 720], ['Afternoon', (t) => t >= 720 && t < 1020], ['Evening', (t) => t >= 1020]];
        body = '<div role="radiogroup" aria-labelledby="panelTitle">' + groups.map(([g, f]) => {
          const items = states.filter(([t]) => f(t));
          if (!items.length) return '';
          return '<div class="slots__group"><p class="slots__label">' + g + '</p><div class="slots">' + items.map(([t, st]) =>
            '<label class="slot"><input type="radio" name="time" value="' + t + '"' + (st !== 'ok' ? ' disabled' : '') + (S.time === t ? ' checked' : '') + '>' +
            '<span>' + fmtTime(t) + (st !== 'ok' ? '<span class="sr-only"> (' + (st === 'taken' ? 'booked' : 'passed') + ')</span>' : '') + '</span></label>').join('') + '</div></div>';
        }).join('') + '</div><p class="caption">Struck-through times are already taken (demo data). Each slot is ' + (sv ? sv.duration : '') + ' minutes.</p>';
      }
    }
    return title('Choose a time', S.date ? esc(fmtLong(S.date)) : '') + body;
  }

  function viewDetails() {
    const c = S.customer;
    const f = (id, label, type, ac, ph) =>
      '<div class="field"><label for="f-' + id + '">' + label + '</label>' +
      '<input class="input" id="f-' + id + '" name="' + id + '" type="' + type + '" autocomplete="' + ac + '" placeholder="' + ph + '" value="' + esc(c[id]) + '"' +
      (errors[id] ? ' aria-invalid="true"' : '') + ' aria-describedby="err-' + id + '" required>' +
      '<p class="field__err" id="err-' + id + '">' + (errors[id] ? esc(errors[id]) : '') + '</p></div>';
    return title('Your details', 'Demo only. These details stay in this browser (LocalStorage) and are never sent anywhere. Made-up details are fine.') +
      '<form id="detailsForm" class="form" novalidate>' + f('name', 'Full name', 'text', 'name', 'Jane Sample') +
      f('email', 'Email', 'email', 'email', 'jane@example.com') + f('phone', 'Phone', 'tel', 'tel', '(555) 010-0100') + '</form>';
  }

  function viewReview() {
    const sv = svcById(S.service), b = barberById(S.barber), c = S.customer;
    const row = (k, v, step) => '<div><dt>' + k + '</dt><dd>' + v + '</dd><dd class="review__edit"><button type="button" class="link" data-goto="' + step + '">Edit<span class="sr-only"> ' + k.toLowerCase() + '</span></button></dd></div>';
    return title('Review your booking', 'Check everything below. This is a demonstration, so nothing is actually booked.') +
      '<dl class="review">' +
      row('Service', esc(sv.name) + ' <span class="muted">' + sv.duration + ' min</span>', 1) +
      row('Barber', esc(b.name), 2) + row('Date', esc(fmtLong(S.date)), 3) +
      row('Time', fmtTime(S.time) + ' to ' + fmtTime(S.time + sv.duration), 4) +
      row('Name', esc(c.name), 5) + row('Email', esc(c.email), 5) + row('Phone', esc(c.phone), 5) + '</dl>' +
      '<dl class="summary__money review__money"><div><dt>Service price <span class="muted">(demo)</span></dt><dd class="num">' + money(sv.price) + '</dd></div>' +
      '<div><dt>Illustrative deposit</dt><dd class="num">' + money(DEPOSIT) + '</dd></div>' +
      '<div class="is-total"><dt>Left at the chair</dt><dd class="num">' + money(Math.max(sv.price - DEPOSIT, 0)) + '</dd></div></dl>' +
      '<p class="caption">The $10 deposit is illustrative. No payment form is shown because no payment is taken.</p>' +
      '<label class="consent"><input type="checkbox" id="consent"' + (S.consent ? ' checked' : '') + '><span>I understand this is a demonstration. No appointment will be booked and no payment will be taken.</span></label>';
  }

  function viewDone() {
    const sv = svcById(S.service), b = barberById(S.barber), c = S.customer;
    return '<p class="services__tag">Demonstration complete</p>' +
      '<h3 class="panel__title done__title" id="panelTitle" tabindex="-1">That is the demo done.</h3>' +
      '<p class="done__ref">Demo reference <strong class="num">' + esc(S.confirmation.ref) + '</strong></p>' +
      '<p class="prose">Thanks' + (c.name ? ', ' + esc(c.name.trim().split(/\s+/)[0]) : '') + '. This is what a confirmation would look like for ' + esc(sv.name) + ' with ' + esc(b.name) + ' on ' + esc(fmtLong(S.date)) + ' at ' + fmtTime(S.time) + '.</p>' +
      '<div class="done__notice" role="note"><strong>This was a demonstration.</strong> No appointment has been made, no payment was taken and no email or text was sent. Your entries exist only in this browser.</div>' +
      '<button type="button" class="btn btn--lg" id="bookRestart">Start a new demo booking</button>';
  }

  const VIEWS = { 1: viewService, 2: viewBarber, 3: viewDate, 4: viewTime, 5: viewDetails, 6: viewReview, 7: viewDone };

  function render(focus) {
    renderStepper();
    panel.innerHTML = VIEWS[S.step]();
    renderSummary();
    renderNav();
    if (!reduceMotion) { panel.classList.remove('is-enter'); void panel.offsetWidth; panel.classList.add('is-enter'); }
    if (focus) {
      const t = document.getElementById('panelTitle');
      if (t) t.focus({ preventScroll: true });
      const top = stepperEl.getBoundingClientRect().top;
      if (top < 80 || top > window.innerHeight * 0.55) root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function refresh() { reconcile(); save(); renderSummary(); renderNav(); renderStepper(); }

  /* ---------- Navigation ---------- */
  function go(n) {
    if (n === DONE || (n >= 1 && n <= maxStep())) { S.step = n; errors = {}; save(); render(true); }
  }
  function next() {
    if (S.step === 5) {
      errors = fieldErrors();
      if (Object.keys(errors).length) {
        render(false);
        hintEl.textContent = 'Please fix the highlighted fields.';
        const first = panel.querySelector('[aria-invalid="true"]'); if (first) first.focus();
        return;
      }
    }
    if (S.step === 6) {
      if (!valid(6)) return;
      S.confirmation = { ref: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(), at: new Date().toISOString() };
      go(DONE); return;
    }
    if (valid(S.step) || S.step === 5) go(S.step + 1);
  }
  function restart() {
    S = blank(); cal = calFor(null); errors = {};
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    pushSelections();
    render(true);
  }

  /* ---------- Events (delegated) ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.goto) go(+t.dataset.goto);
    else if (t.id === 'bookNext') next();
    else if (t.id === 'bookBack') go(S.step - 1);
    else if (t.id === 'bookRestart') restart();
    else if (t.dataset.cal) {
      const m = new Date(cal.y, cal.m + +t.dataset.cal, 1);
      cal = { y: m.getFullYear(), m: m.getMonth() };
      document.getElementById('cal').innerHTML = calendarHTML();
      const b = document.querySelector('.cal__nav[data-cal="' + t.dataset.cal + '"]:not([disabled])') || document.getElementById('calGrid').querySelector('[tabindex="0"]');
      if (b) b.focus();
    } else if (t.dataset.date) {
      if (t.getAttribute('aria-disabled') === 'true') return;
      S.date = t.dataset.date; reconcile(); refresh();
      document.getElementById('cal').innerHTML = calendarHTML();
      document.querySelector('[data-date="' + S.date + '"]').focus();
      const h = hoursFor(S.date);
      document.getElementById('calNote').textContent = fmtLong(S.date) + ': open ' + fmtTime(h[0]) + ' to ' + fmtTime(h[1]) + ' (demo hours).';
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'service') { S.service = t.value; pushSelections(); }
    else if (t.name === 'barber') { S.barber = t.value; pushSelections(); }
    else if (t.name === 'time') { S.time = +t.value; }
    else if (t.id === 'consent') { S.consent = t.checked; }
    else return;
    refresh();
  });

  root.addEventListener('input', (e) => {                   // details form: save as you type, validate on blur or Continue
    const t = e.target;
    if (!t.closest('#detailsForm')) return;
    S.customer[t.name] = t.value;
    if (errors[t.name]) { delete errors[t.name]; t.removeAttribute('aria-invalid'); document.getElementById('err-' + t.name).textContent = ''; }
    save();
  });
  root.addEventListener('focusout', (e) => {
    const t = e.target;
    if (!t.closest || !t.closest('#detailsForm') || !t.value) return;
    // Moving to a button (Continue, Back, Edit)? Skip inline validation: an error message appearing now would shift the
    // layout between mouse-down and mouse-up and swallow the click. next() validates everything anyway.
    if (e.relatedTarget && e.relatedTarget.tagName === 'BUTTON') return;
    const msg = fieldErrors()[t.name];
    document.getElementById('err-' + t.name).textContent = msg || '';
    msg ? t.setAttribute('aria-invalid', 'true') : t.removeAttribute('aria-invalid');
  });
  root.addEventListener('submit', (e) => { e.preventDefault(); next(); });   // Enter inside the form

  root.addEventListener('keydown', (e) => {                 // calendar: arrows move by day or week
    const day = e.target.closest && e.target.closest('.cal__day');
    if (!day) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const target = addDays(parse(day.dataset.date), delta), t0 = startOfToday();
    if (target < t0 || target > addDays(t0, WINDOW_DAYS)) return;
    if (target.getMonth() !== cal.m || target.getFullYear() !== cal.y) { cal = { y: target.getFullYear(), m: target.getMonth() }; document.getElementById('cal').innerHTML = calendarHTML(); }
    const next = document.querySelector('[data-date="' + ymd(target) + '"]');
    document.querySelectorAll('.cal__day').forEach((b) => { b.tabIndex = -1; });
    next.tabIndex = 0; next.focus();
  });

  /* Choices made in the Services and Barbers sections flow into the booking. */
  window.addEventListener('hardpart:service', (e) => { if (S.step === DONE) return; S.service = e.detail ? e.detail.id : null; reconcile(); save(); render(false); });
  window.addEventListener('hardpart:barber', (e) => { if (S.step === DONE) return; S.barber = e.detail ? e.detail.id : null; reconcile(); save(); render(false); });

  S = load();
  cal = calFor(S.date);
  // "Continue to booking" in the Services and Barbers sections moves the booking on to the next open step
  const svcCont = document.getElementById('svcContinue'), barCont = document.getElementById('barberContinue');
  if (svcCont) svcCont.addEventListener('click', () => { if (S.step === 1 && valid(1)) { S.step = 2; save(); render(false); } });
  if (barCont) barCont.addEventListener('click', () => { if (S.step <= 2) { S.step = !valid(1) ? 1 : (valid(2) ? 3 : 2); save(); render(false); } });
  document.documentElement.classList.add('booking-ready');
  render(false);
})();
