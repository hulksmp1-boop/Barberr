# HARD PART — Barber Shop (showcase project)

Premium barber website built with HTML5, CSS3 and vanilla JavaScript only. Demo data; no backend, no real payments.

## Run
Open `index.html` in a browser, or serve the folder:
```
python3 -m http.server 8000   # then visit http://localhost:8000
```
Google Fonts (Archivo, Newsreader) need an internet connection; system fallbacks are defined.

## Structure
- `index.html` — markup
- `style.css` — tokens, layout, components
- `script.js` — behaviour (menu, parallax, lazy 3D loader)
- `chair.js` — Three.js barber chair (built procedurally, loaded on demand from jsDelivr)
- `assets/images/`, `assets/models/` — media (empty until later phases)

## Progress
- [x] Phase 1 — Foundation, navigation, hero
- [x] Phase 2 — Interactive 3D barber chair (with static fallback)
- [ ] Phase 3 — Services and barbers
- [ ] Phase 4 — Gallery, reviews, FAQ, hours
- [ ] Phase 5 — Booking, confirmation, footer, polish
