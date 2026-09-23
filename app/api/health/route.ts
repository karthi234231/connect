// app/api/health/route.ts
// Liveness probe — answers one question: "is this process able to serve HTTP?"
// It deliberately performs NO I/O, so a slow or degraded dependency can never
// cause the orchestrator to kill an otherwise healthy container. Use
// /api/health/ready for dependency gating.
//
// Public by design: `proxy.ts` lists `/api/health` in PUBLIC_API_PREFIXES, and
// the payload contains build metadata only — never secrets or user data.
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SERVICE = 'connect-web'
const VERSION =
  process.env.SENTRY_RELEASE ??
  process.env.npm_package_version ??
  process.env.NEXT_PUBLIC_APP_VERSION ??
  'unknown'

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: SERVICE,
      version: VERSION,
      environment: process.env.NODE_ENV ?? 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  })
}
