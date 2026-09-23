# Architecture

This document explains how Connect is put together, why the boundaries sit where they do,
and which invariants must hold. It is written for the engineer who has to change the
system safely — not as a feature tour.

---

## 1. System context

```
                     ┌──────────────────────────────────────────────┐
   Browser  ───────▶ │  Next.js 16 (App Router, Turbopack)          │
   (React 19)        │                                              │
                     │  proxy.ts      auth · suspension · rate limit │
                     │  app/          routes, server actions, APIs   │
                     │  services/     domain logic                   │
                     │  lib/          infrastructure                 │
                     └───────┬───────────────┬──────────────┬───────┘
                             │               │              │
                  ┌──────────▼──────┐  ┌─────▼──────┐  ┌────▼─────────┐
                  │ Supabase        │  │ Upstash    │  │ Ably /       │
                  │ Postgres + RLS  │  │ Redis      │  │ Resend /     │
                  │ Auth / Storage  │  │ (limits,   │  │ PostHog /    │
                  │ Realtime        │  │  caches)   │  │ Sentry       │
                  └─────────────────┘  └────────────┘  └──────────────┘
```

**Trust boundary.** Everything the browser sends is untrusted until a route handler or
server action has (a) established identity, (b) validated shape with zod, and (c) had the
database enforce RLS. There is no "trusted client" path.

---

## 2. Layering and dependency direction

| Layer | Directory | May depend on | Must not |
| --- | --- | --- | --- |
| Route / action | `app/` | services, lib, components, config, types | contain business rules or raw SQL |
| Domain | `services/<context>/` | lib, types, supabase client | import React or `next/headers` UI concerns |
| Infrastructure | `lib/` | other lib, types | import services (no cycles) |
| Presentation | `components/`, `hooks/`, `store/` | utils, config, components | import services (server-only) directly |
| Client data | `client/` | fetch wrappers, types | reach into `lib/supabase/admin` |
| Pure helpers | `utils/`, `types/` | nothing | perform I/O |

Dependency direction is one-way: **app → services → lib → types**. A violation is a bug,
not a style preference — it is what keeps server-only code out of client bundles.

**Enforced by construction, not convention.** `lib/supabase/admin.ts` throws if imported
in a browser context; `lib/logger.ts` is deliberately runtime-neutral so it can be shared
by Edge, Node and browser code.

---

## 3. Request lifecycle

### 3.1 Navigating to a page

```
GET /dashboard/events
  └─ proxy.ts                 (matcher: /dashboard/:path*)
       ├─ not configured?      → pass through (themed shells still render)
       ├─ getClaims() → getUser() fallback
       ├─ no session?          → 307 /login?next=<validated path>
       ├─ profiles.suspended_at?→ 307 /suspended
       ├─ rate limit (per group: swipe/search/message/auth/general)
       │    └─ exceeded?       → 429 + RateLimit-* headers
       └─ set x-user-id, x-user-email, x-request-id → RSC render
```

`proxy.ts` is the *only* place that resolves identity from the session; downstream code
reads `x-user-id` **or** re-derives it from the Supabase server client when it needs
per-user RLS. Both paths are acceptable; maintaining a third is not.

### 3.2 Mutating data

```
Client component
  └─ Server Action (app/actions/*)
       ├─ CSRF token verified (lib/csrf.ts)
       ├─ zod validation (lib/validation.ts, services/**/*.schema.ts)
       ├─ capability check (services/auth/capabilities.ts)
       ├─ domain service (services/**/**.service.ts)
       └─ Postgres (RLS + SECURITY DEFINER functions where atomicity is required)
```

Server Actions are the *only* mutation entry point for the UI. Route handlers under
`app/api/*` exist for machine callers (worker), integration callbacks (LinkedIn),
exports (GDPR, analytics) and the guest-safe read APIs.

### 3.3 Machine work

```
pg_cron ──HTTP──▶ POST /api/queue/worker   (Authorization: Bearer $WORKER_SECRET)
                    ├─ task: notification-deliveries
                    ├─ task: slack-alerts
                    ├─ task: analytics-flush
                    └─ requestId: GDPR job drain
```

There is no queue broker (ADR-001). Work is idempotent, bounded and re-runnable; the
worker returns a payload describing what it drained so a scheduler can log it.

---

## 4. Data and domain model

`supabase/migrations/` (74 files, timestamp-ordered) is the schema's source of truth;
`types/database.ts` and `supabase/database.types.ts` mirror it for application code.
Highlights, by concern:

| Concern | Representative migrations |
| --- | --- |
| Identity & profiles | `*_profiles_*`, `20260913100000_profile_idea_headline_education.sql` |
| Provider connections / LinkedIn | `20260912000000_profile_provider_connections.sql`, `20260912010000_profile_experiences.sql` |
| Matching & swipes | `20260912010001_perform_swipe_two_arg_contract.sql`, `20260915000000_swipe_daily_quota.sql`, `20260908060000_swipe_score_server_derived.sql` |
| Events | `20260906200000_register_event_full.sql`, `20260906210000_duplicate_event_atomic.sql`, `20260906190000_event_discovery_index.sql` |
| Analytics | `20260906240000_event_analytics_aggregate.sql`, `20260912120000_analytics_event_correlation_id.sql` |
| Notifications | `20260906160000_notification_dedupe.sql`, `20260906170000_notification_deliveries_outbox.sql` |
| Chat | `20260906000000_chat_threads_projection.sql`, `20260912030000_chat_threads_keyset_index.sql`, `20260916010000_message_reactions.sql` |
| Relationships | `20260907100000_relationship_safety.sql`, `20260916000000_relationship_history_events.sql` |
| GDPR | `20260908010000_gdpr_erase_phased_terminal_state.sql` |
| Public read views | `20260908030000_public_search_profiles_view.sql`, `20260908040000_public_listing_views.sql` |

**Invariants**

1. A multi-row state change (RSVP + seat count, swipe + score, duplicate event) happens
   inside a single `SECURITY DEFINER` function, never as a client-side sequence.
2. Anything a client can read without a session is exposed through a purpose-built view
   (`public_*`), not by loosening a base-table policy.
3. Cursor pagination is keyset-based (`*_keyset_index*`), so paging cannot drift under
   concurrent writes.

**Verification.** SQL probes under `supabase/tests/` assert the invariants above against
a real database (swipe e2e/quota/revalidation, connection accept, event registration,
GDPR erase, notification dedupe, settings upsert, analytics refresh, match transitions).

---

## 5. Security controls

| Layer | Control | Where |
| --- | --- | --- |
| Edge of app | Response headers: CSP, HSTS (prod), `nosniff`, `DENY`, Referrer-Policy, Permissions-Policy, COOP/CORP | `next.config.mjs` (single authority, contract-tested) |
| Edge of app | Auth gate, suspension gate, per-operation rate limits, correlation id | `proxy.ts` |
| Transport | Secrets only ever read server-side; `SUPABASE_SERVICE_ROLE_KEY` never crosses the client boundary | `lib/env.ts`, `lib/supabase/admin.ts` |
| Request | CSRF double-submit (HMAC-SHA256, constant-time compare) | `lib/csrf.ts` |
| Request | Open-redirect prevention (rejects `//`, backslashes, `%5c`, `%2f`, CR/LF) | `lib/redirect.ts` |
| Request | zod validation at every boundary, with normalisation | `lib/validation.ts`, `services/**/*.schema.ts` |
| Request | Attachment paths constrained to the sending match's storage prefix | `sendMessageSchema` |
| Data | RLS on every user-scoped table; privileges inventoried by probe | `supabase/migrations/**`, `supabase/probes/20260908_privilege_inventory.sql` |
| Observability | PII/secret scrubbing (keys, inline tokens, JWTs, depth-capped) before logs/Sentry | `lib/logger.ts`, `lib/observability.ts` |
| Privacy | GDPR export + phased erase with terminal state | `services/gdpr/**`, `app/api/gdpr/**` |
| CI | gitleaks over full history, `npm audit --audit-level=high`, no-secrets lint rule | `.github/workflows/ci.yml`, `eslint.config.mjs` |

**Threat-model notes**

- *Rate limiting is per operation group, not per endpoint*: a user shares one budget for
  swipe / search / message / auth / general, so hopping between endpoints cannot multiply
  it.
- *Fail-closed by default*: if Redis is unavailable, the limiter denies rather than allows.
  `/api/health/ready` surfaces that as `503` so the platform stops sending traffic.
- *`x-forwarded-for` is trusted only because deployment infrastructure rewrites it*; the
  proxy documents this assumption explicitly. If a new ingress is introduced, it must
  overwrite the header or the IP-scoped budgets become spoofable.
- *Two CSP headers must never coexist.* `lib/security.ts` contains a nonce-based builder
  kept for a future rollout; adopting it means **replacing** the policy in
  `next.config.mjs` (browsers intersect policies, and the intersection silently breaks
  the app).

---

## 6. Cross-cutting concerns

| Concern | Implementation | Notes |
| --- | --- | --- |
| Configuration | `lib/env.ts` (zod, lazy), `.env.example` | Loud at boot, never leaks values |
| Logging | `lib/logger.ts` | Runtime-neutral; redacts PII fields, depth-capped, never throws |
| Error reporting | `lib/observability.ts` → Sentry (opt-in) | Scrub-then-send; log-only fallback |
| Rate limiting | `lib/ratelimit.ts` + `proxy.ts` groups | Fail-closed; per *operation*, not per endpoint |
| Caching | `lib/cache/**`, Redis | Keys namespaced; anything per-user is never shared-cached |
| Realtime | `lib/websocket/**`, `client/websocket/`, Ably | Transport-agnostic client contract |
| Search | `lib/meilisearch/**`, `services/search/**`, `app/api/search` | Enhanceable: falls back to in-DB search when unconfigured |
| Analytics | `lib/analytics/**` (buffered flush via worker), `lib/posthog/**` | PostHog is a *mirror*, never a second source of truth |
| Tasks | `lib/tasks/**`, `app/api/queue/worker` | Idempotent, bounded, re-runnable |
| Privacy | `services/gdpr/**` | Export + phased erase with terminal state |
| Client state | `store/create-store.ts` (auth, ui) | Server data is fetched, not mirrored, into global stores |
| Correlation | `proxy.ts` → `x-request-id` on every response | Reuses a sane upstream id, otherwise mints a UUID |

---

## 7. Design decisions (ADR summary)

1. **ADR-001 — No queue broker.** Background work runs inline, on `pg_cron`, or through
   the secret-authenticated worker. Rationale: one fewer distributed system to operate;
   the work is idempotent and bounded, and volume does not justify a broker yet. Revisit
   when a single task consistently exceeds the request budget.
2. **ADR-002 — Server Actions over bespoke mutation APIs.** Rationale: the CSRF/validation
   pipeline lives in one place, and the client cannot bypass it. Route handlers are kept
   for machine callers, callbacks and file exports.
3. **ADR-003 — Database-enforced authorization.** Rationale: RLS survives application
   bugs; capability checks are a second, intentionally redundant layer.
4. **ADR-004 — Lazy environment validation.** Rationale: CI and containers must build with
   no secrets, while runtime access still fails fast. The trade-off (a bad value surfaces
   at first use rather than at boot) is closed by `instrumentation.ts` + readiness probe.
5. **ADR-005 — One canonical open-redirect validator.** Rationale: divergent copies of
   this check are how open redirects ship. `lib/redirect.ts` is the only implementation;
   `lib/security.ts` re-exports it.
6. **ADR-006 — `next.config.mjs` owns response headers.** Rationale: enforcement at the
   framework boundary covers static, dynamic and error responses identically, and is
   contract-tested.
7. **ADR-007 — Fail closed when an optional integration is missing.** Rationale: an
   unconfigured provider must disable its feature, never downgrade a control.

---

## 8. Extending the system

**Adding a feature (checklist)**

1. `services/<context>/` — schema (`*.schema.ts`), service function, unit tests for pure
   logic. Never import React here.
2. `app/actions/` — Server Action: CSRF → zod → capability → service → revalidate path.
3. `app/` — the route, wrapped in existing layout/shell components; use `--cx-*` tokens
   and `components/ui` primitives for anything visual.
4. `config/routes.ts` — add the path once and import it everywhere.
5. `supabase/migrations/` — new timestamped migration; never edit an applied one.
6. If the surface is public, decide explicitly whether it needs `robots.ts` / `sitemap.ts`
   updates and whether it belongs in `PUBLIC_API_PREFIXES` (default: it does not).

**Adding a dependency** — pin an explicit range (never `"latest"`), justify it against
`npm audit`, and if it runs in the browser add its origins to the CSP in `next.config.mjs`.

**Changing a security control** — update the implementation, then update
`tests/next-config.test.ts` / add a regression test, then update §5 of this document. A
control with no test is considered unenforced.


