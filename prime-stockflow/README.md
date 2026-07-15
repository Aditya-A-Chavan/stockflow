# StockFlow

Warehouse inventory and sales-order management for Prime. Scan or look up SKUs, reserve stock against open orders, and dispatch when ready. Backed by Supabase (Postgres) with custom username/password auth.

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Supabase Postgres (service-role client on server only)
- Custom auth: bcrypt + signed JWT session cookie (`jose`)

## Security model

**Row Level Security (RLS) is disabled** on all tables. Every database read/write goes through Next.js server actions and API routes using the Supabase **service role key**, which never reaches the browser. Route protection is enforced by middleware that validates the session cookie before any app page loads.

This is appropriate for a single-tenant internal warehouse tool with a small fixed user list in `APP_USERS`.

## Prerequisites

- Node.js 20+
- A Supabase project (hosted or local)

## Local setup

### 1. Install dependencies

```bash
cd prime-stockflow
npm install
```

### 2. Configure environment

Copy the example env file and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Project Settings → API) |
| `SESSION_SECRET` | Random string, at least 32 characters |
| `APP_USERS` | JSON map of username → plaintext password |

Set your users in `.env.local`:

```
APP_USERS={"alice":"her-password"}
```

Avoid `$` in passwords — Next.js expands `$VAR` references in env files. If you must
use one, escape it as `\$`.

### 3. Run database migration

Apply the SQL migration to your Supabase project. Options:

**Supabase Dashboard:** SQL Editor → paste and run `supabase/migrations/001_initial_schema.sql`

**Supabase CLI:**

```bash
supabase db push
```

(or link your project and run the migration file manually)

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run test` | Run unit tests (domain logic) |

## Deploy to Vercel

1. Push the repo and import the `prime-stockflow` directory as a Vercel project.
2. Set the same environment variables as `.env.local` in Vercel Project Settings → Environment Variables.
3. Deploy. Middleware runs on the Edge; server actions run serverless with the service role key.

**Required Vercel env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `APP_USERS`

## App routes

| Route | Purpose |
|-------|---------|
| `/login` | Sign in |
| `/` | Dashboard (stats + recent activity) |
| `/scan` | Barcode scan / manual lookup → reserve |
| `/orders` | Sales orders (filter, paginate, dispatch) |
| `/stock` | Stock list with debounced search |
| `/import` | CSV imports + manual SKU add |

## CSV import notes

- Uses PapaParse (handles quoted commas, BOM).
- **Duplicate SKU codes within one file:** last row wins.
- **Stock import:** rows for unknown SKUs are skipped with a warning.
- **Order import:** rows for unknown SKUs are imported with an "Unknown SKU" badge; existing `order_no` values are skipped and reported.
- **Stock import:** if `qty_on_hand` is below current `reserved`, that row is rejected.

## Tests

```bash
npm run test
```

Covers available-stock math, order status transitions, and reserve validation.

## Differences from the HTML prototype

See project handoff notes in the implementation summary. Key points:

- Persistence in Supabase instead of `localStorage`
- Auth required; no public sign-up
- Server-enforced atomic reserve/dispatch (Postgres RPC + row locks)
- No "Clear all data" danger zone
- Unknown SKUs on order import are flagged in the UI
- Unknown SKUs on stock import are skipped
- Case-sensitive SKU/EAN lookup (same as prototype)
- Barcode: native `BarcodeDetector` with `@zxing/browser` fallback (not Quagga)
- XSS-safe React rendering (no `innerHTML`)
- Paginated orders/activity; debounced server-side stock search
