# HARD PART — Barber Shop (showcase project)

A premium barber shop website built with **HTML5, CSS3 and vanilla JavaScript only**. No frameworks, no build step, no backend.

> **Everything here is fictional demo content**: the business, address, barbers, prices, reviews and bookings.
> The booking flow is a frontend simulation saved in your browser's LocalStorage. No real appointment is made and no payment is taken. The $10 deposit is illustrative.

## Run locally
Open `index.html` in a browser, or serve the folder (recommended):

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

An internet connection is needed for Google Fonts (system fonts are the fallback) and for the optional 3D chair, which loads Three.js from jsDelivr. Without it, the site shows a static preview of the chair.

## Project structure
```
hard-part/
├── index.html            Page markup (header, hero, sections, booking, footer)
├── style.css             Design tokens, components and all section styles
├── script.js             Menu, parallax, reveals, services/barber selection, gallery filter, FAQ, 3D loader
├── booking.js            Frontend-only 7-step booking demo (LocalStorage key: hardpart.booking)
├── chair.js              Three.js barber chair, lazy-loaded on demand
├── design-system.html    Internal style reference page (not linked from the site; safe to delete)
├── README.md
├── .nojekyll             Tells GitHub Pages to serve the files as-is
└── assets/
    ├── images/
    │   ├── hero-barber.svg
    │   ├── chair-fallback.svg
    │   ├── barbers/      4 illustrated portraits
    │   └── gallery/      10 illustrated haircut images
    └── models/           Reserved for 3D models (the chair is built in code, so it is empty)
```

## Replacing the placeholder images
All images are illustrated placeholders, not photography. To use real photos, replace the files (or change the `src`) in:
- `assets/images/hero-barber.svg` (portrait 4:5)
- `assets/images/barbers/*.svg` (portrait 4:5)
- `assets/images/gallery/*.svg` (sizes vary: square, tall 1:2, wide 2:1)

Keep the `width`/`height` attributes accurate and use compressed JPEG/WebP files.

## Deploy to GitHub Pages
1. Create a new GitHub repository (for example `hard-part`).
2. Put the **contents of the `hard-part` folder** (so `index.html` sits at the repository root) in the repository:
   ```
   cd hard-part
   git init
   git add .
   git commit -m "HARD PART demo site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/hard-part.git
   git push -u origin main
   ```
3. On GitHub open **Settings, then Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then **Save**.
5. Wait a minute or two. The site appears at `https://<your-username>.github.io/hard-part/`.

Notes:
- All paths in the project are relative, so it works under the `/hard-part/` sub-path with no changes.
- Use `https` links only. The CDN and font requests already do.
- Updates: commit and push to `main`; Pages redeploys automatically.
- To use a custom domain, add it under Settings, then Pages, then Custom domain.

## Progress
- [x] Foundation, navigation, hero
- [x] Interactive 3D barber chair (static fallback included)
- [x] Services and deposit explanation
- [x] Barbers and gallery
- [x] Reviews, FAQ, location
- [x] Booking demo and confirmation
- [x] Footer and final polish
