// app/api/health/ready/route.ts
// Readiness probe — answers: "can this instance serve real traffic right now?"
//
// Semantics (documented so on-call reads them the same way every time):
//   • 200 → every CONFIGURED critical dependency answered within the timeout.
//   • 503 → a configured critical dependency is unreachable, or (in
//           production) the environment is incomplete.
//   • Unconfigured OPTIONAL integrations are reported as `skipped` and never
//     fail the probe: this codebase is explicitly designed to build and boot
//     without them (see lib/env.ts).
//
// Never leaks secrets: only check names, latencies and coarse status codes.
import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { validateEnvAtStartup } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROBE_TIMEOUT_MS = 2500

type CheckStatus = 'ok' | 'degraded' | 'skipped' | 'error'

interface CheckResult {
  name: string
  status: CheckStatus
  latencyMs: number
  detail?: string
}

function elapsed(startedAt: number): number {
  return Math.round(performance.now() - startedAt)
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'timeout' : error.name
  }
  return 'unknown error'
}

/** Auth service reachability + key validity (cheap, unauthenticated endpoint). */
async function checkSupabaseAuth(): Promise<CheckResult> {
  const startedAt = performance.now()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return {
      name: 'supabase-auth',
      status: 'skipped',
      latencyMs: 0,
      detail: 'not configured',
    }
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })

    return {
      name: 'supabase-auth',
      status: response.ok ? 'ok' : 'error',
      latencyMs: elapsed(startedAt),
      detail: response.ok ? undefined : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      name: 'supabase-auth',
      status: 'error',
      latencyMs: elapsed(startedAt),
      detail: errorDetail(error),
    }
  }
}

/**
 * Database reachability with the service-role client. `head: true` issues a
 * HEAD request, so the probe costs no row transfer even on large tables.
 */
async function checkSupabaseDatabase(): Promise<CheckResult> {
  const startedAt = performance.now()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      name: 'supabase-db',
      status: 'skipped',
      latencyMs: 0,
      detail: 'not configured',
    }
  }

  try {
    const { getAdminSupabaseClient } = await import('@/lib/supabase/admin')
    const { error } = await getAdminSupabaseClient()
      .from('profiles')
      .select('id', { head: true })
      .limit(1)

    return {
      name: 'supabase-db',
      status: error ? 'error' : 'ok',
      latencyMs: elapsed(startedAt),
      detail: error ? `pg error ${error.code ?? 'unknown'}` : undefined,
    }
  } catch (error) {
    return {
      name: 'supabase-db',
      status: 'error',
      latencyMs: elapsed(startedAt),
      detail: errorDetail(error),
    }
  }
}

/** Rate-limit / cache backend. The app fails closed without it, so it gates. */
async function checkRedis(): Promise<CheckResult> {
  const startedAt = performance.now()

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return {
      name: 'redis',
      status: 'skipped',
      latencyMs: 0,
      detail: 'not configured',
    }
  }

  try {
    const { getRedisClient } = await import('@/lib/redis')
    const pong = await getRedisClient().ping()

    return {
      name: 'redis',
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: elapsed(startedAt),
      detail: pong === 'PONG' ? undefined : 'unexpected response',
    }
  } catch (error) {
    return {
      name: 'redis',
      status: 'error',
      latencyMs: elapsed(startedAt),
      detail: errorDetail(error),
    }
  }
}

export async function GET() {
  const config = validateEnvAtStartup()

  const checks = await Promise.all([
    checkSupabaseAuth(),
    checkSupabaseDatabase(),
    checkRedis(),
  ])

  const failing = checks.filter((check) => check.status === 'error')
  const configFailsProduction =
    !config.ok && process.env.NODE_ENV === 'production'

  const ready = failing.length === 0 && !configFailsProduction

  if (!ready) {
    logger.error('Readiness probe failed', {
      failing: failing.map((check) => check.name),
      configIssues: configFailsProduction ? config.errors.length : 0,
    })
  }

  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not_ready',
      environment: process.env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      config: {
        // Only ever counts — never the variable names, never the values.
        valid: config.ok,
        issueCount: config.errors.length,
      },
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}
