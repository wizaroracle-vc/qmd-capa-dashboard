# CAPA Management System — Standalone Build

This is a static, framework-build-free version of the CAPA Management System.
It's just two files — `index.html` and `app.js` — so it can be hosted on
**any** static web host with no build step, no Node install, and no server
required.

## How it works

- `app.js` is the app, already compiled from JSX to plain JavaScript.
- `index.html` loads it as an ES module and resolves `react`, `react-dom`,
  `lucide-react`, and `recharts` via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
  pointing at [esm.sh](https://esm.sh) — a public CDN that serves npm
  packages as ES modules. **This means visitors need an internet connection**
  for those four libraries to load (same as almost any web app using a CDN
  for its JS framework).
- Data (locales, months, CAPA plans, sets, etc.) is saved to the browser's
  `localStorage`, scoped to whatever domain you host this on. It seeds itself
  with demo data the first time it loads. Each visitor/browser has their own
  separate local copy — there is no shared backend or database, so different
  people on different devices will *not* see each other's changes. If you
  need real multi-user shared data, you'd want to swap the storage layer for
  an actual backend (see "Going further" below).

## Deploy it (pick one)

Any of these work — just upload/point the host at this folder:

**Netlify (easiest, no account needed for a quick test)**
1. Go to https://app.netlify.com/drop
2. Drag this folder (containing `index.html` and `app.js`) onto the page.
3. You'll get a live `https://random-name.netlify.app` URL immediately.

**Vercel**
1. `npm i -g vercel` (or use the Vercel dashboard's "Add New Project" → drag & drop).
2. From this folder: `vercel --prod`.

**GitHub Pages**
1. Create a new GitHub repo and push these files to it.
2. Repo Settings → Pages → Deploy from branch → select `main` / root.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

**Cloudflare Pages**
1. Cloudflare dashboard → Pages → Upload assets → drag this folder in.

**Your own server (nginx, Apache, S3, etc.)**
Just copy `index.html` and `app.js` to the web root — they're static files,
no server-side processing needed.

**Testing locally first**
From this folder, run:
```
python3 -m http.server 8080
```
then open `http://localhost:8080` — note opening `index.html` directly via
`file://` will NOT work because ES module imports require an actual HTTP
origin.

## Login credentials (demo data)

- **Locale login**: click any of the 8 locale buttons (VCHI, VCPA, VCNE,
  VCLP, VCMA, VCSF, KHBA, KHPA) — no password, matching the original spec.
- **QMD / Management login**:
  - Username: `qmd.admin`
  - Password: `QMD@2026`

You can change these in `app.js` by searching for `QMD_CREDENTIALS`.

## Resetting demo data

There's a "Reset demo data" link on the login screen, or you can clear it
manually via your browser's DevTools console:
```js
Object.keys(localStorage)
  .filter(k => k.startsWith('capa_qms_store::'))
  .forEach(k => localStorage.removeItem(k));
```

## Going further

This build is intentionally dependency-free to deploy, but two things are
worth knowing if you plan to use it for real, multi-user work:

1. **Shared/multi-user data**: since storage is per-browser `localStorage`,
   two different locale users won't see each other's submissions unless
   they're on the same browser profile. To make this a real shared system,
   the `storage` object near the top of `app.js` (the `get`/`set`/`delete`/
   `list` functions) is the only place that needs to change — point those
   at a real backend/API instead of `localStorage`.
2. **Authentication**: the QMD login is a simple hardcoded credential check
   for demo purposes, not real security. For production use you'd want
   proper authentication (e.g. a backend session/JWT check) rather than a
   client-side password comparison.
