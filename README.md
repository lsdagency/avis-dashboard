# Avis Budget Group — Live Reporting Dashboard

Live paid-media reporting across **Meta Ads, Reddit Ads and TikTok Ads**. Pulls
daily campaign performance, shows spend / ROAS / current budgets / weightings,
calculates optimised budget recommendations per platform, and lets an admin push
the recommended budgets back to each platform with one click.

Built on the LSD Agency house stack (same as the PHYT dashboard).

## Stack

- **Next.js 15** (App Router, Server Components + Route Handlers), **React 19**, **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first `@theme` tokens), Avis brand colours
- **Neon serverless Postgres** via `@netlify/database` (auto-provisioned on Netlify) + **Drizzle ORM**
- **Auth:** custom JWT (`jose`, HS256, httpOnly cookie) + `bcryptjs`, two roles (`admin` / `client`), enforced by Edge middleware
- **Client fetching:** SWR (5-min auto-refresh)
- **Scheduling:** Netlify Scheduled Function (`netlify/functions/daily-refresh.mts`), 09:00 UTC, protected by `CRON_SECRET`
- **Hosting:** Netlify (`@netlify/plugin-nextjs`), deployed from GitHub

## Key patterns

1. **Sample-data fallback everywhere.** Every platform has a live client and a
   deterministic sample-data generator. The app is fully clickable before any
   credential exists; a failing platform falls back to sample data + a per-platform
   warning, never blanking the dashboard.
2. **Normalized integration types** (`lib/types.ts`). The UI only ever sees
   `CampaignSnapshot` / `BudgetRecommendation` — never raw API payloads.
3. **Per-source resilience.** One broken integration never affects the other two
   (`Promise.allSettled` in the orchestrator).
4. **TTL cache** of live API results in the `api_cache` table (4h), keyed by
   platform + date.
5. **Settings-driven config.** API keys are editable in-app, encrypted with
   AES-256-GCM; a resolver merges saved keys over env vars (saved keys win).
6. **Per-platform budget isolation.** `calculateRecommendations` runs once per
   platform — budgets are never mixed between channels.

## Local development

```bash
npm install
cp .env.example .env.local   # optional — runs on sample data with zero config
npm run dev
```

With no `ADMIN_PASSWORD` set, the app runs in **demo mode**: log in with
`admin@avis.local` / `avis-demo`. No database or API keys are required — all three
platforms render deterministic sample data.

## Campaign naming convention

```
ABG16785 - AVIS - [REGION] - SALES - [UP|LOW] - BAU - 2026
```

`UP` → Prospecting, `LOW` → Retargeting. Region is any ISO 3166-1 alpha-2 code;
the one exception is `UK` in the name, which is normalised to **`GB`** everywhere.
The five Z1 priority regions (GB, FR, ES, DE, IT) receive a 1.25× ROAS multiplier.
Names that don't match the pattern are skipped.

## Deployment (Netlify)

1. Connect the GitHub repo to a Netlify project.
2. Netlify auto-provisions the Neon database via `@netlify/database` and applies
   `netlify/database/migrations/0001_init/migration.sql` on deploy.
3. Set environment variables (see `.env.example`): `JWT_SECRET`, `CREDENTIALS_SECRET`,
   `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `CLIENT_EMAIL`/`CLIENT_PASSWORD`, `CRON_SECRET`,
   `APP_URL`, and any live platform keys (all optional — sample data is used
   until they're set; keys can also be entered in-app under Settings).

`DATABASE_URL` is **not** needed on Netlify — it's auto-provisioned. Set it only for
local dev against your own Neon instance.
