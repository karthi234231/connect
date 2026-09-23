# AGENTS.md — Connect

## Stack
Next.js 16 / React 19 / TypeScript 5 / Tailwind v4 (css variables `--cx-*`) / Supabase / lucide-react / vitest.

## Commands
- Typecheck: `npm run typecheck` (fast safe variant: `npx tsc --NoEmit --incremental false`)
- Lint: `npm run lint` (eslint . — security + no-secrets plugins enabled)
- Tests: `npm run test` (vitest run, environment node)
- Build+analyze: `npm run build` (set ANALYZE=true for bundle report)
- Full gate: `npm run check` (lint + typecheck + test + build)
- Format: `npm run format` / `npm run format:check`

## Conventions
- Server-action boundary: clients never call `fetch('/api/...')` directly. Reads go through `@/app/actions/*` ('use server') exposed via `@/client/api/*`, consumed with `useQuery` from `@/client/query/client`.
- Query keys are strings; use `keys.x().join('/')` (see `@/client/query/keys.ts`). The notifications LIST key is the literal `JSON.stringify(keys.notifications())`.
- Server actions authenticate with `requireUser()` from `@/lib/auth`.
- Never fabricate data: render only real stored values; missing/empty values are omitted, never invented or defaulted to a claim.
- Imports: `@/*` alias; `cn` from `@/utils/cn`; icons from `lucide-react`; design tokens `--cx-*`; 'use client' on interactive components.
