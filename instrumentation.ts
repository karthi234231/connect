// instrumentation.ts
// Next.js calls `register()` exactly once per server process — in BOTH the
// Node.js and Edge runtimes — before the first request is handled. It is the
// enterprise bootstrap hook: initialise observability, then validate the
// environment loudly so a misconfigured deploy is visible in logs at boot
// instead of surfacing as scattered 500s.
//
// This file must stay dependency-light: it is bundled into every runtime.
import { logger } from '@/lib/logger'

export async function register(): Promise<void> {
  const runtime = process.env.NEXT_RUNTIME

  if (runtime === 'nodejs' || runtime === 'edge') {
    await initObservability(runtime)
  }

  if (runtime !== 'nodejs') {
    return
  }

  // ── Fail-fast configuration check ────────────────────────────────────────
  // Local dev is allowed to be incomplete (integrations fail closed), so only
  // production escalates. Readiness reports the same state to the platform.
  const { validateEnvAtStartup } = await import('@/lib/env')
  const config = validateEnvAtStartup()

  if (config.ok) {
    logger.info('Environment validated', { runtime })
    return
  }

  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'Environment validation failed in production — readiness will report not_ready',
      { issueCount: config.errors.length, issues: config.errors },
    )
  } else {
    logger.warn(
      'Environment incomplete (dev) — optional integrations disabled',
      {
        issueCount: config.errors.length,
      },
    )
  }
}

/** Sentry is opt-in: without a DSN the SDK is never loaded (zero cost). */
async function initObservability(runtime: string): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    logger.info('Error reporting disabled (NEXT_PUBLIC_SENTRY_DSN unset)', {
      runtime,
    })
    return
  }

  try {
    if (runtime === 'edge') {
      await import('./sentry.edge.config')
    } else {
      await import('./sentry.server.config')
    }
    logger.info('Error reporting initialised', { runtime })
  } catch (error) {
    logger.warn('Error reporting initialisation failed', {
      runtime,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
