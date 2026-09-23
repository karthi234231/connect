# Changelog

All notable changes to Connect are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Follow-up hardening pass over the released 1.0.0 surface: one timing-safe
comparison defect, one silent-write UI defect, the schema↔types drift, and the
vitest/Playwright runner boundary.

### Added

- **Schema alignment migration** — `supabase/migrations/20260921000000_schema_type_alignment.sql`
  reconciles the database with `types/database.ts`: `message_reactions`,
  `swipe_daily_quota` and `slack_alerts` were defined by migrations but absent
  from the generated types, and `match_timeline_event_type` was missing the four
  transitions added by `20260916000000` (`relationship_ended`, `call_scheduled`,
  `group_joined`, `contribution`). All statements are idempotent
  (`if not exists` / `add value if not exists`), so the migration is safe to
  re-run.
- **Typed tables** — `message_reactions`, `swipe_daily_quota` and `slack_alerts`
  added to `types/database.ts` (Row/Insert/Update + foreign-key relationships),
  and the timeline enum widened to all eight values.
- **`npm run test:e2e`** — explicit Playwright entry point (see Fixed below).

### Changed

- **Service facades removed where types now exist** — the hand-rolled untyped
  clients in `services/chat/reaction.service.ts` (`ReactionQueryClient`),
  `services/alerts/slack-outbox.ts` (loose table shim) and
  `app/actions/matches.ts` (`SwipeQuotaAdminClient`) are gone; each call site now
  uses the generated `Database` types directly. Row Level Security remains the
  real boundary in every case.

### Fixed

- **`safeCompare` trailing-NUL collapse (security)** — the previous
  zero-padding implementation made `safeCompare('a\u0000', 'a')` return `true`,
  so any bearer/cron secret carrying a trailing NUL byte matched its truncated
  form. Both inputs are now hashed to a fixed 32-byte SHA-256 digest before
  `timingSafeEqual`, which also removes the `RangeError` on length mismatch that
  the padding scheme existed to work around. Regression test added.
- **Raw `timingSafeEqual` on variable-length secrets** — `lib/csrf.ts`
  (`verifyCsrfToken`) and `services/discover/candidates.service.ts` (discover
  batch signature check) compared unhashed, unequal-length HMAC/tag strings
  directly, throwing a `RangeError` that surfaced as a hard failure instead of a
  clean "invalid" result — a tampered or truncated CSRF cookie or discover batch
  token crashed the request rather than being rejected. Both now route through
  `safeCompare`.
- **Profile edit silently discarded rejected writes** — `handleSave` in
  `app/dashboard/profile/edit/page.tsx` awaited two Server Actions and ignored
  their typed `{ ok: false }` result, so a validation or authorization rejection
  still navigated away as if it had saved. Failures now surface the in-place
  error state.
- **Work style / commitment selects accepted any string** — the two selects
  (and the profile prefill) treated persisted values as free-form text, so a
  legacy or unknown stored value could not round-trip through the typed state.
  Values are now narrowed against the same option lists the UI renders.
- **`npm test` reported a phantom failing suite** — vitest's `tests/**/*.ts`
  discovery glob also matched the Playwright specs in `tests/e2e/**`, so
  `test.describe()` threw inside the vitest process and the run exited non-zero
  on a suite that was never meant to execute there. `tests/e2e/**` is now
  excluded and Playwright is invoked through `npm run test:e2e`.
- **Unused `createHash` import** in `lib/security.ts` (exposed by the
  `safeCompare` rewrite) — `logCspViolation` also now scrubs attacker-influenced
  CSP report URLs through `scrubForObservability`, matching `captureError`.

## [1.0.0] — 2026-09-21

The first release where the frontend product surface, the domain services and the
platform layer are versioned, hardened and testable as one system.

### Added

- **Platform hardening** — response security headers applied to every route from
  `next.config.mjs`: Content-Security-Policy (origins derived from env, dev-aware),
  HSTS (production only), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, COOP/CORP, `X-Permitted-Cross-Domain-Policies`; `poweredByHeader`
  disabled and `Cache-Control: no-store` forced on `/api/*`.
- **Observability bootstrap** — root `instrumentation.ts` initialises error reporting
  (Sentry server/edge, opt-in via `NEXT_PUBLIC_SENTRY_DSN`) and validates the environment
  loudly at boot; `instrumentation-client.ts` covers the browser with zero cost when no
  DSN is compiled in.
- **Operational endpoints** — `GET /api/health` (liveness, no I/O) and
  `GET /api/health/ready` (readiness: Supabase auth, database and Redis with timeouts,
  `503` when a configured dependency fails).
- **Request correlation** — `proxy.ts` reuses or mints an `x-request-id`, echoes it on
  every response (pass-through, redirect, `429`, `403`) and forwards it upstream.
- **PWA + SEO metadata routes** — `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`,
  plus canonical `metadataBase`, OpenGraph and Twitter metadata, and Apple web-app hints.
- **Route-state boundaries** — root `app/loading.tsx` (themed Suspense fallback) and
  `app/global-error.tsx` (self-contained, provider-free last-resort boundary).
- **Environment introspection** — `validateEnvAtStartup()` in `lib/env.ts` returns a
  redacted, throw-free validation report consumed by the bootstrap hook and readiness probe.
- **Test suite expansion** — Vitest now discovers every `*.test.ts(x)`; added contract
  tests for the security headers (`tests/next-config.test.ts`), the open-redirect guard
  (`lib/redirect.test.ts`), PII scrubbing (`lib/observability.test.ts`) and the input
  schemas (`lib/validation.test.ts`).
- **Engineering documentation** — `README.md`, `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`
  and this changelog.

### Changed

- **Dependency pinning** — every `"latest"` range (14 packages) replaced with an explicit
  caret range resolved from the lockfile, so installs are reproducible.
- **Reproducible runtimes** — `package.json#engines` (`node >=20.9.0`), `packageManager`
  (`npm@11.16.0`) and `.nvmrc` (24.18.0).
- **CI pipeline** — least-privilege permissions, per-ref concurrency cancellation, a
  Node 20.x/24.x quality matrix, a production build job using placeholder env only, and a
  security job (audit + gitleaks over full history).
- **Version** — `0.1.0` → `1.0.0`; the audit-repair work is now released rather than
  pre-release.
- `vitest.config.mjs` — widened discovery, generated/vendored trees excluded,
  `clearMocks`/`restoreMocks` enabled.

### Fixed

- `metadataBase` warning on every build/route (canonical origin now resolved defensively).
- Sentry runtime configs lived under `services/matching/`, where nothing could load them;
  they now sit at the project root where `instrumentation.ts` expects them.

### Removed

- `services/matching/sentry.server.config.ts` and `services/matching/sentry.edge.config.ts`
  (dead files, superseded by the root configs).

### Known gaps

`format:check` is not yet a CI gate (see README → Known gaps), Sentry source-map upload is
not wired, and CSP still relies on `'unsafe-inline'` pending a nonce rollout.
