# Connect — Rewire Execution Plan (from `CONNECT_CURRENT_PROJECT_REWIRE_FROM_SCRATCH_MEGA.txt`)

> Source spec: `CONNECT_CURRENT_PROJECT_REWIRE_FROM_SCRATCH_MEGA.txt` (36 sections).
> Ground truth verified on the **current** `C:\connect` tree — several spec
> "P0 restore" items are **already satisfied** here (see Baseline). This plan
> tracks only what is **actually still broken**, organized into parallel waves.

## Baseline (verified, not assumed)

**Already fixed in the current tree (spec assumed missing):**

- P0-01 `proxy.ts` — **exists** at root, `proxy` export + `config.matcher`, Next 16 Proxy convention. Live.
- `package.json`, `next.config.mjs`, `instrumentation.ts`, `.env.example` — **exist**.
- P0-03 / P0-35 page-level `DashboardShellBar` duplication — **already removed**; `app/dashboard/layout.tsx` owns the shell; `rg DashboardShellBar app components` = **0 refs**.
- `client/api/events.ts` `viewsBySource`, `services/ideas/revisions.ts` `revision_number` — fixed in prior passes.

**Confirmed still broken (to execute):**

| ID       | Defect                                                            | File(s)                                                                                    |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P0-04    | Event create is a no-op (`onSubmit={e=>e.preventDefault()}`)      | `app/dashboard/events/new/page.tsx`                                                        |
| P0-05    | Event edit has no update action; description TODO                 | `app/dashboard/events/[eventId]/edit/page.tsx`                                             |
| P0-06    | Attendee "Export" uses analytics export; no roster route          | `app/dashboard/events/[eventId]/attendees/*`, `app/api/events/[eventId]/attendees/export/` |
| P0-07    | `completeOnboardingAction` passes empty `lookingFor`/`offering`   | `app/actions/onboarding.ts`                                                                |
| P0-08    | `hasProfileIdea=true` vacuous                                     | `services/profiles/onboarding.ts`                                                          |
| P0-09    | Calendar step is required progress but not completable            | `app/dashboard/onboarding/page.tsx`                                                        |
| P0-10    | Settings false-success (account no-op, privacy hardcoded/partial) | `app/actions/settings.ts`                                                                  |
| P0-13    | Many actions unwired (avatar, block, ideas, chat, gdpr…)          | multiple                                                                                   |
| P0-15    | `requireAdmin` doesn't call `requireActiveUser`                   | `lib/auth.ts`                                                                              |
| P0-16    | `/logout` uses `NEXT_PUBLIC_APP_URL` with no fallback             | `app/logout/route.ts`                                                                      |
| P0-17    | Suspended CTA links `/login` (bounces) instead of POST `/logout`  | `app/suspended/page.tsx`                                                                   |
| P0-18/19 | No `deactivated_at`; privacy status/requests unbacked             | migrations + `services/profiles/*`                                                         |
| P0-31    | `config/routes.ts` incomplete                                     | `config/routes.ts`                                                                         |
| P0-33    | No `app/admin/layout.tsx` gate                                    | `app/admin/layout.tsx`                                                                     |
| P0-14    | `fetchProfile(userId)` ignores its arg                            | `client/api/profiles.ts`                                                                   |

## Execution waves (parallel, disjoint file ownership)

**Gate for every wave:** `npm run typecheck` (0), `npm run lint` (0 errors),
`npm run test` (all pass), `npm run build` (exit 0).

### Wave 1 — Trust boundaries + correctness (highest value)

- **A1 Events**: real create action + controlled form (`events/new`), real update
  (`events/[eventId]/edit`, incl. description), attendee roster export route +
  client. Schema/service for events.
- **A2 Onboarding + Settings truthfulness**: fix `completeOnboardingAction` to use
  persisted values; remove/repair vacuous `hasProfileIdea`; drop calendar from
  required steps; settings actions stop returning false success (account no-op →
  honest read-only or real write; privacy partial → persist all or block).
- **A3 Trust boundaries**: `requireAdmin` → active-user + role; `/logout` origin
  fallback; suspended page POST `/logout`; `app/admin/layout.tsx` gate.
- **A4 Routes + profile contract**: expand `config/routes.ts` into full builders;
  fix `client/api/profiles.ts#fetchProfile` to not return self for arbitrary ids.

### Wave 2 — Feature wiring (P0-13/21/22/23/24/26)

Avatar upload lifecycle, idea detail viewer actions (validate/join/track/toggle),
send-connection surface, block/unblock UI + blocked list, chat reactions/search/
suggestions wiring. Reduces dead backend surface.

### Wave 3 — Durability (P0-11/12/18/19, notifications, MFA)

Durable privacy columns + deactivation lifecycle migration; notification channel
fan-out fix (in_app independent of email/push); push or remove; persistent MFA or
remove the claim.

### Wave 4 — Hardening + verification

Static source checks (Section 34), RLS/RPC validation, tests per Section 33.

## Non-negotiables

- No fabricated success, no demo data in production paths, no dead actions kept.
- Services receive trusted `actorId` only from the action/API boundary.
- Every mutation authenticates + authorizes + validates server-side.
- Atomic transitions via existing SECURITY DEFINER RPCs.
