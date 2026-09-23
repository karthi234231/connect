// tests/units/post-login-route.test.ts
// Auth contract: every post-login entry point falls back to the Discover
// swipe deck (POST_LOGIN_ROUTE) — never /dashboard — unless a safe `next`
// deep-link was requested. Guards the route constant, the navbar registry,
// routes config, and the server provisioning decision.
import { describe, expect, it } from 'vitest'

import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { ROUTES } from '@/config/routes'
import { mainNavItems } from '@/config/navigation'
import { decideProvisioning } from '@/services/auth/provisioning'

describe('post-login landing contract', () => {
  it('lands on the Discover swipe deck', () => {
    expect(POST_LOGIN_ROUTE).toBe('/dashboard/discover')
  })

  it('routes config exposes the discover path', () => {
    expect(ROUTES.discover).toBe('/dashboard/discover')
  })

  it('navbar Discover item points at the deck', () => {
    const discover = mainNavItems.find((item) => item.label === 'Discover')
    expect(discover?.href).toBe('/dashboard/discover')
  })

  it('onboarded users fall back to the Discover deck', () => {
    const decision = decideProvisioning(
      { id: 'u1' },
      {
        id: 'u1',
        fullName: 'Ada',
        bio: 'Builder of things',
        // A genuinely ONBOARDED profile must satisfy every persisted
        // requirement (identity + bio + lookingFor + offering) — the fixture
        // previously passed empty arrays, which is a not-onboarded profile.
        onboardingStatus: 'completed',
        availability: { days: [], hours: null },
        skills: [],
        lookingFor: { roles: ['co_founder'] },
        offering: { categories: ['engineering'] },
        timezone: 'UTC',
        city: null,
        lastActiveAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        onboardingCompletedAt: '2026-01-02T00:00:00Z',
      } as never,
    )
    expect(decision.redirectTo).toBe('/dashboard/discover')
  })

  it('fresh (never-onboarded) users are routed to profile completion', () => {
    const decision = decideProvisioning(
      { id: 'u2', user_metadata: { full_name: 'Grace' } },
      null,
    )
    expect(decision.redirectTo).toBe('/dashboard/profile/edit')
    expect(decision.isNewProfile).toBe(true)
  })
})
