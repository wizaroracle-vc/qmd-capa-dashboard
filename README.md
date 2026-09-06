# CAPA Management System — Next.js + Supabase

Corrective & Preventive Action management. Hierarchy: **Branch → Month → Department
→ CAPA Plan → CAPA Sets**, with QMD verification.

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Supabase** — Postgres + Auth + Row Level Security
- Branch accounts see only their own branch; QMD sees everything and manages the
  branch logins.

The original single-file build is preserved in [`_legacy/`](_legacy/).

---

## 1. Create a Supabase project

<https://supabase.com/dashboard> → New project. Then from **Project Settings → API**
copy the values into `.env.local` (copy `.env.local.example` first):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-only, keep secret
CRON_SECRET=<openssl rand -hex 32>             # keep-alive ping, see §5
```

## 2. Apply the schema

Link the CLI to your project and push the migrations:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

(Or, in the Supabase SQL editor, run each file in
[`supabase/migrations/`](supabase/migrations/) in order — `0001_…` then `0002_…`.
`0002` is a small additive column and is safe to run on an existing DB.)

## 3. Create the QMD user (in Supabase) + seed

Auth is 100% Supabase — no passwords live in this codebase.

1. Supabase dashboard → **Authentication → Users → Add user**. Give it an email +
   password and tick "Auto Confirm User". This is your QMD login.
2. Put that email in `.env.local` as `SEED_QMD_EMAIL=…`.
3. Run the seed — it grants that user the `QMD` role, seeds the branch list, and
   loads demo CAPA data:

   ```bash
   npm run seed
   ```

To change the QMD password later: Supabase dashboard → Authentication → Users, or
add a QMD self-service screen later.

## 4. Run

**Node 22+ is required** (`@supabase/supabase-js` needs native `WebSocket`; Node 20
throws at startup). An `.nvmrc` is included:

```bash
nvm use          # or: nvm install 22
npm install
npm run dev
```

Open <http://localhost:3000>.

- Sign in with the QMD username + password (the login screen is just username +
  password — the account itself carries the role and, for branches, the branch).
- Go to **Branch accounts** (`/qmd/accounts`). **Add a branch** (code + name) —
  the seed ships a starter list, but QMD can add more here anytime — then create
  its login (username + password). You can later reveal the password, reset it,
  disable the account, or remove it.
- Sign out, then sign in as a branch with that branch's username/password. It
  lands straight on that branch's dashboard.

## 5. Keeping the free Supabase project awake

Supabase pauses a **free** project after 7 idle days. This app is used about once
a month, so without a nudge the database would keep pausing and users would hit
connection errors until someone restores it from the dashboard.

[`vercel.json`](vercel.json) defines a **Vercel Cron** job that calls
[`/api/keep-alive`](app/api/keep-alive/route.ts) once a day; that route runs a
single tiny query, which resets Supabase's inactivity timer. (A Supabase-side
`pg_cron` job can't do this — it pauses along with the project.)

One manual step after deploying: in the **Vercel project → Settings →
Environment Variables**, add `CRON_SECRET` (Production) with a random value
(`openssl rand -hex 32`). Vercel signs cron requests with it and the route
rejects anything else. The job then shows under **Vercel project → Cron Jobs**,
where you can run it on demand and view logs.

> Local: add the same `CRON_SECRET` to `.env.local` and test with
> `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/keep-alive`.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typegen` | Regenerate Next route types (`PageProps`/`LayoutProps`) after adding routes |
| `npm run seed` | Grant QMD role (`SEED_QMD_EMAIL`) + seed branches + demo data (`-- --force-data` to reload) |
| `npm run db:types` | Regenerate `lib/database.types.ts` from a local Supabase |

## Status

Working: Supabase auth (branch + QMD), RLS scoping (verified), QMD + branch
dashboards, QMD branch-account management, create-month / create-CAPA flows, the
full **workflow editor** (Issue & 6M → Fishbone → 5 Whys → Action Plan) with
optimistic-concurrency save, **QMD verification**, and the printable report route.

Not yet built: the fully charted QMD dashboard (tabs + recharts) — currently a
summary + table — and the styling pass to move inline styles to Tailwind. See
`~/.claude/plans/declarative-twirling-leaf.md`.
