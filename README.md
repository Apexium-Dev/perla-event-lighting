# Perla Event Lighting — Linktree + Admin

A "link in bio" page for **Perla Event Lighting** (dry ice, cold sparklers, bubble machines,
LED/gobo lighting for weddings & events), a matching QR code, and a password-protected `/admin`
panel to edit everything (links, logo, tagline, services, QR target) without touching code.

All content lives in a **Supabase Postgres database**, so edits made via `/admin` persist
correctly when this is deployed to Vercel — no local file writes, which wouldn't survive Vercel's
serverless environment.

## Running it locally

Needs Node (already installed).

```
npm install        # first time only
npm run start       # http://localhost:4173
```

Visit `http://localhost:4173` for the public page, `http://localhost:4173/admin` for the admin
panel. Default password is **perla123** — set in `.env`.

## Structure

- `server.js` — the Express server: serves the public site, checks the admin password against
  `.env`, exposes the API the admin panel uses to save edits, and generates the QR code on the fly
- `db.js` — the Supabase data access layer (reads/writes the 6 tables, translates to/from the
  JSON shape the frontend expects)
- `api/index.js` — thin re-export of `server.js` so Vercel can run it as a serverless function
- `vercel.json` — routes `/api/*` to that function; everything else in `public/` is served as
  static files directly by Vercel (fast, no function invocation)
- `public/` — the public-facing static site
  - `index.html` / `styles.css` / `script.js` — the public page (fetches `/api/content` at load
    time and renders links/logo/tagline/services from it)
  - `admin/` — the admin dashboard (`index.html`, `admin.css`, `admin.js`)
  - `assets/` — favicon and the placeholder logo (the real logo lives in Supabase Storage once
    uploaded via `/admin`)
- `scripts/seed-supabase.mjs` — one-time script that loaded the original content into Supabase
  (already run — see "Database" below)
- `.env` — `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (gitignored, never commit this)
- `.env.example` — template for the above

## Database

Six tables in Supabase: `company`, `company_translations`, `links`, `link_translations`,
`services`, `service_translations` — one company row, with each translatable field split out per
language (`sq` / `mk` / `en`) in its own translations table.

`db.js` assembles/flattens these into the same JSON shape the frontend already used
(`{ name, nameSub, siteUrl, logo, i18n, links, services }`), so `script.js` and `admin.js` didn't
need to change when this moved off local files.

Saving from `/admin` updates the company row + its translations, and replaces all links/services
(delete-then-reinsert) with whatever's currently in the form — this keeps ordering and add/remove
simple without needing to track stable IDs in the UI.

**The service-role key in `.env` bypasses all database security (Row Level Security).** It's used
only server-side in `db.js` — never expose it in client-side code, and never commit `.env`.

### Logo storage

Uploaded logos go to a public Supabase Storage bucket called `logos` (created automatically the
first time you use `/admin`'s upload, via `ensureLogoBucket()` in `db.js`). The `company.logo`
column stores the resulting public URL.

## Admin panel (`/admin`)

Log in with the password in `.env`, then you can:

- Edit name, subtitle, tagline, location, footer note — each in Albanian, Macedonian, and English
- Upload a new logo (PNG/JPG/SVG/WEBP, up to 5MB)
- Add, remove, reorder, and edit every link (icon, title, subtitle per language, URL, "primary" highlight)
- Add/remove service chips (icon + text per language)
- Update the site URL and regenerate the QR code in one click

The **Ruaj** button in the top bar and the one at the bottom of the form both save everything —
brand fields, all links, all services, all three languages — at once.

## Languages

The public page has a language switcher (SQ / MK / EN) at the top of the card. Visitors' choice
is remembered in their browser (`localStorage`) so it sticks on their next visit; the default for
first-time visitors is Albanian.

In the admin panel, the **"Duke redaktuar" bar** below the top bar switches which language's text
you're editing. Switching tabs doesn't discard anything; Save always sends all three languages at
once.

The Macedonian and English translations were written by AI, not a native speaker — worth a
proofread before this goes live, especially the Macedonian.

### Changing the password

Edit `ADMIN_PASSWORD` in `.env` (and in Vercel's environment variables if deployed), then restart
the server. Also replace `SESSION_SECRET` with your own random string if you ever suspect it's
leaked — this invalidates all existing admin sessions.

## ⚠️ Placeholders still to replace

Edit these via `/admin`:

| What | Current placeholder |
|---|---|
| WhatsApp number | `wa.me/389XXXXXXXXX` — needs real number |
| Email | `info@perlaeventlighting.example` — needs real inbox |
| Facebook URL | `facebook.com/perlaeventlighting` — guessed slug, please confirm |
| Site URL (for the QR code) | `https://your-real-domain.com` — update once deployed |

## QR code

Generated on the fly at `/api/qr.png` and `/api/qr.svg` from the current `siteUrl` — no file is
written to disk, so it always reflects whatever's saved, including on Vercel. Update the URL via
the admin panel's "Rigjenero QR kodin" button (or by editing the site URL and saving).

## Deploying to Vercel

1. **Set environment variables** in the Vercel project (Dashboard → Settings → Environment
   Variables, or `vercel env add`): `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` — same values as your local `.env`. Never put these in `vercel.json`
   or any committed file.
2. Deploy:
   ```
   vercel          # preview deployment
   vercel --prod   # production
   ```
   (Or connect the GitHub repo in the Vercel dashboard for auto-deploy on push.)
3. Once you have a real domain, update the site URL via `/admin` so the QR code points to it.

Because content lives in Supabase rather than local files, admin edits persist correctly across
deployments and serverless invocations — this was the whole reason for the migration off the
original JSON-file version.
