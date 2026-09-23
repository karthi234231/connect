// sentry.server.config.ts
// Node-runtime error reporting. Loaded by `instrumentation.ts` only when
// NEXT_PUBLIC_SENTRY_DSN is configured, so projects without Sentry pay nothing.
import * as Sentry from '@sentry/nextjs'

/** Keeps a bad env value (e.g. "0,1") from silently disabling telemetry. */
function parseSampleRate(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    // PII never leaves the process: lib/observability.ts scrubs payloads, and
    // here we stop the SDK from auto-attaching request metadata as well.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
        delete event.request.data
      }
      return event
    },
  })
}
