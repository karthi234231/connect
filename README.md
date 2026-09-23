# Connect

**Find your people. Build what matters.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/karthi234231/connect)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=flat&logo=github)](https://github.com/karthi234231/connect)
[![Live Demo](https://img.shields.io/badge/Production-Live--Demo-000000?style=flat&logo=vercel)](https://connect-karthi234231.vercel.app)

Connect matches people by **intent** — co-founders, co-builders, and crew for your next
idea or event. The product surface is a dark, brand-led web app (Discover · Events ·
Connect · Messages · Ideas · Profile) on top of a Supabase-backed domain layer with
strict row-level security, rate-limited APIs and GDPR-grade data handling.

```
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 6 · Tailwind v4
Supabase (Postgres + Auth + Storage + Realtime) · Upstash Redis · Ably · Resend · PostHog · Sentry
```

- **GitHub Repository**: [https://github.com/karthi234231/connect](https://github.com/karthi234231/connect)
- **Live Enterprise Application**: [https://connect-karthi234231.vercel.app](https://connect-karthi234231.vercel.app)

---

## Table of contents

- [Live Deployment](#live-deployment)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Environment](#environment)
- [Project structure](#project-structure)
- [Architecture in one page](#architecture-in-one-page)
- [Quality gates](#quality-gates)
- [Operational endpoints](#operational-endpoints)
- [Security model](#security-model)
- [Known gaps](#known-gaps)
- [Documentation map](#documentation-map)

---

## Live Deployment

Connect is ready for single-click enterprise production deployment:

1. **GitHub Repository**: [`https://github.com/karthi234231/connect`](https://github.com/karthi234231/connect)
2. **Production App URL**: [`https://connect-karthi234231.vercel.app`](https://connect-karthi234231.vercel.app)
3. **One-Click Deploy**: Click the **Deploy with Vercel** button above or import `karthi234231/connect` directly on [Vercel](https://vercel.com/new).

---

## Quick start

**Prerequisites**

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>=20.9.0` (`24.18.0` pinned by `.nvmrc`) | enforced by `package.json#engines` |
| npm | `11.x` (`packageManager` field) | `corepack enable` respects it |
| Supabase CLI | optional | only needed to apply migrations locally |

```bash
# 1 — dependencies (lockfile-exact install)
npm ci

# 2 — configuration: copy the template and fill the values
copy .env.example .env.local        # Windows
cp .env.example .env.local          # macOS / Linux

# 3 — database (linked Supabase project, or a local stack)
supabase db push                    # apply supabase/migrations/*  (75 files)
# optional: seed development data
# supabase db execute --file supabase/seeds/dev_data.local.sql

# 4 — run
npm run dev                         # http://localhost:3000
```

The app **boots without any secrets**. Missing integrations are reported at startup,
`/api/health/ready` reports them as `skipped`, and the affected feature fails closed
rather than half-working (see [Environment](#environment)).

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Turbopack dev server on `:3000` |
| `npm run build` | Production build (must stay green with placeholder env only) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — must report **zero** errors |
| `npm run lint` | ESLint 9 flat config (Next + typescript-eslint + security + no-secrets) |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run test` | Vitest (unit + platform contract tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier write over app/component/lib/service sources |
| `npm run format:check` | Prettier check (not yet a CI gate — see [Known gaps](#known-gaps)) |
| `npm run audit` | `npm audit --audit-level=high` |
| `npm run check` | lint → typecheck → test → build (the full local gate) |

---

## Environment

Every variable is declared and validated in **`lib/env.ts`** (zod). `.env.example` is the
authoritative template.

| Scope | Variables |
| --- | --- |
| Public (browser-safe) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, optional `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Server secrets | `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ABLY_API_KEY`, `RESEND_API_KEY`, `CSRF_SECRET` (≥32 chars), optional `WORKER_SECRET` (≥16 chars) |
| Optional integrations | `POSTHOG_*`, `MEILISEARCH_*`, `SLACK_WEBHOOK_URL`, `TURNSTILE_SECRET_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`, `EMAIL_FROM` |

**Design rules**

1. Validation is **lazy** — reading a value at request time fails fast with a redacted
   error, while `next build` never needs real secrets.
2. Secrets are never echoed: validation errors render them as `<string, len=NN>`.
3. Optional integrations are **fail-closed**: absent config disables the feature rather
   than degrading security.
4. Startup validation (`instrumentation.ts`) logs the state once; `/api/health/ready`
   exposes it as counts only — never variable names or values.

---

## Project structure

```
app/                     Route tree (Next.js App Router)
  (marketing)/           Public pages: browse, privacy, terms
  actions/               Server Actions — the only mutation entry point for the UI
  api/                   Route handlers: browse, search, events, gdpr, linkedin, queue, health
  dashboard/             Authenticated surface (events, ideas, matches, chat, profile, settings…)
  events/                Public event discovery (search, category, detail, analytics)
  login/ logout/ callback/     Auth flow entry points
  admin/ traction/ suspended/ settings/security/   Guarded, operator-facing surfaces
  manifest.ts robots.ts sitemap.ts                 PWA + SEO metadata routes
  loading.tsx error.tsx not-found.tsx global-error.tsx   Route-state boundaries
client/                  Browser-side data access: api/, query/, websocket/
components/              Presentation layer (a11y, brand, chat, forms, layout, media, motion, navigation, states, ui)
config/                  Static app config: routes, navigation, breakpoints, feature flags
features/                Feature-scoped composition (events: dto/, factories/, services/)
hooks/                   Reusable React hooks
lib/                     Framework-level infrastructure (env, auth, csrf, security, ratelimit,
                         logger, observability, supabase/, redis, cache/, analytics/, tasks/…)
services/                Domain services — one folder per bounded context (17 folders)
store/                   Client state (auth, ui) on a small store factory
supabase/                migrations/ (75), seeds/, probes/, tests/ (SQL probes), config.toml
tests/                   Cross-cutting suites (e.g. the platform config contract)
types/                   Shared domain types + generated database types
utils/                   Small pure helpers (cn, format-date, format-location, format-number)
proxy.ts                 Next.js 16 proxy (middleware): auth gate, suspension gate,
                         per-group rate limits, correlation id
instrumentation.ts       Server bootstrap: observability + fail-fast env validation
instrumentation-client.ts Browser bootstrap hook
sentry.*.config.ts       Runtime-specific error reporting (opt-in via DSN)
```

**Placement rule of thumb**

| You are writing… | Put it in |
| --- | --- |
| A page, layout, or route handler | `app/` |
| A reusable, context-free visual component | `components/` |
| A business rule that talks to Postgres | `services/<context>/` |
| Cross-cutting infrastructure | `lib/` |
| Data fetching for the browser | `client/` |
| A pure, side-effect-free helper | `utils/` |
| Static lists, route constants, flags | `config/` |

---

## Architecture in one page

```
Browser ──▶ proxy.ts ──▶ app/ routes ──▶ services/ ──▶ Supabase (RLS) / Redis / Ably / Resend
              │                │
              │                └─ Server Actions (app/actions/*) for mutations
              └─ auth gate · suspension gate · rate limits · request id · correlation headers
```

- **Identity** comes from the Supabase session; `proxy.ts` resolves it once per request
  (`getClaims()` with a `getUser()` fallback) and forwards `x-user-id` / `x-request-id`.
- **Authorization** is enforced twice: RLS in Postgres *and* capability checks in
  `services/auth/capabilities.ts` (unit-tested).
- **Mutations** flow through Server Actions (CSRF-protected, zod-validated) — never
  directly from the browser to Postgres.
- **Machine work** (notifications, Slack outbox, GDPR jobs, analytics flush) is driven by
  `POST /api/queue/worker` behind `WORKER_SECRET`, or by `pg_cron` — no queue broker.
- **Errors** are scrubbed by `lib/observability.ts` before they reach logs or Sentry.

Full detail, including the data model and trade-offs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Quality gates

The same gates run locally and in CI (`.github/workflows/ci.yml`):

| Gate | Command | Blocking |
| --- | --- | --- |
| Types | `npm run typecheck` | yes |
| Lint | `npm run lint` | yes (warnings tolerated, errors not) |
| Tests | `npm run test` | yes |
| Build | `npm run build` | yes |
| Dependency CVEs | `npm run audit` | yes |
| Secret scan | gitleaks (CI) | yes |

CI runs the quality gate on **Node 20.x and 24.x**, then builds with placeholder env only —
proving the app never requires real secrets to compile.

---

## Operational endpoints

| Endpoint | Contract |
| --- | --- |
| `GET /api/health` | **Liveness.** No I/O at all. `200` with `{ status, service, version, environment, uptimeSeconds, timestamp }`. Public and never cached. |
| `GET /api/health/ready` | **Readiness.** Probes Supabase auth, the database (service-role `HEAD` query) and Redis with a 2.5 s timeout. `200` when every *configured* dependency answers; `503` when one fails or the production environment is incomplete. Unconfigured optional integrations report `skipped`. |
| `POST /api/queue/worker` | Machine-only work dispatch (`Authorization: Bearer $WORKER_SECRET`). `401` without the secret, `400` on unknown task or malformed params. |

All three are reachable without a user session by design (`proxy.ts` → `PUBLIC_API_PREFIXES`),
and every response carries `x-request-id` for log correlation.

---

## Security model

| Control | Where |
| --- | --- |
| Response hardening (CSP, HSTS, frame/permission lockdown, COOP/CORP) | `next.config.mjs` |
| Auth + suspension gating, per-operation rate limits | `proxy.ts` |
| CSRF (HMAC-signed double-submit token) | `lib/csrf.ts` |
| Open-redirect prevention (one canonical validator) | `lib/redirect.ts` |
| Input validation at every boundary | `lib/validation.ts`, `services/**/*.schema.ts` |
| PII/secret scrubbing before any sink | `lib/logger.ts`, `lib/observability.ts` |
| Row-level security + least privilege | `supabase/migrations/**`, `supabase/probes/20260908_privilege_inventory.sql` |
| GDPR export/erase with phased terminal state | `services/gdpr/**`, `app/api/gdpr/**` |

Details and threat-model notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#5-security-controls) ·
Runbook: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

---

## Known gaps

Tracked deliberately, not overlooked:

1. **`npm run format:check` is not a CI gate.** The Prettier config (`semi: false`) disagrees
   with the majority of existing sources (which use semicolons). Run `npm run format` in a
   dedicated commit before enabling the gate.
2. **Sentry source-map upload is not wired.** Error reporting initialises via
   `instrumentation.ts`; adding `withSentryConfig` (source maps, release tagging) needs
   `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`.
3. **CSP allows `'unsafe-inline'` for scripts/styles.** A nonce rollout is scaffolded in
   `lib/security.ts` (`buildCspHeader`) but must **replace** the policy in `next.config.mjs`,
   never run alongside it.
4. **`lib/security.ts` CSP helpers are unused** — kept as the documented nonce path.

---

## Documentation map

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, request lifecycle, data model, security controls, ADRs, extension checklist |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Local run, health checks, alert triage, migrations, rollback, incident checklist |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history (Keep a Changelog) |
| [`AUDIT_PLAN.md`](AUDIT_PLAN.md) | Full-stack audit and repair plan the baseline was built from |

---

## License

Proprietary and confidential. © Connect. All rights reserved.



