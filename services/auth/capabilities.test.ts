// src/services/auth/capabilities.test.ts
// S009 — capability/security matrix tests: one resolver, no forked tier logic.
import { describe, it, expect } from 'vitest'

import {
  CAPABILITIES,
  CAPABILITY_MATRIX,
  can,
  capabilitiesFor,
  effectiveCapabilities,
  ensureCapability,
  resolveAuthTier,
  resolveTierFromProfile,
} from './capabilities'

describe('S009 capability matrix', () => {
  it('has exactly one boolean entry per capability per tier', () => {
    for (const tier of Object.keys(
      CAPABILITY_MATRIX,
    ) as (keyof typeof CAPABILITY_MATRIX)[]) {
      for (const capability of CAPABILITIES) {
        expect(typeof CAPABILITY_MATRIX[tier][capability]).toBe('boolean')
      }
    }
  })

  it('GUEST may only view public content and browse', () => {
    const caps = capabilitiesFor('GUEST')
    expect(caps.viewPublic).toBe(true)
    expect(caps.browse).toBe(true)
    expect(caps.swipe).toBe(false)
    expect(caps.sendMessage).toBe(false)
    expect(caps.publishIdea).toBe(false)
  })

  it('AUTH_PENDING may edit own profile but not take matching actions', () => {
    const caps = capabilitiesFor('AUTH_PENDING')
    expect(caps.editOwnProfile).toBe(true)
    expect(caps.viewOwnProfile).toBe(true)
    expect(caps.swipe).toBe(false)
    expect(caps.requestIntro).toBe(false)
    expect(caps.sendMessage).toBe(false)
  })

  it('AUTH_READY grants full member capabilities but never admin', () => {
    const caps = capabilitiesFor('AUTH_READY')
    expect(caps.swipe).toBe(true)
    expect(caps.sendMessage).toBe(true)
    expect(caps.publishIdea).toBe(true)
    expect(caps.manageEvents).toBe(true)
    expect(caps.admin).toBe(false)
  })

  it('FORBIDDEN withholds every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(can('FORBIDDEN', capability)).toBe(false)
    }
  })
})

describe('S009 tier resolution', () => {
  it('resolves the full state lattice deterministically', () => {
    expect(
      resolveAuthTier({
        isSignedIn: false,
        isSuspended: false,
        isOnboarded: false,
        isAdmin: false,
      }),
    ).toBe('GUEST')
    expect(
      resolveAuthTier({
        isSignedIn: true,
        isSuspended: false,
        isOnboarded: false,
        isAdmin: false,
      }),
    ).toBe('AUTH_PENDING')
    expect(
      resolveAuthTier({
        isSignedIn: true,
        isSuspended: false,
        isOnboarded: true,
        isAdmin: false,
      }),
    ).toBe('AUTH_READY')
    expect(
      resolveAuthTier({
        isSignedIn: true,
        isSuspended: true,
        isOnboarded: true,
        isAdmin: true,
      }),
    ).toBe('FORBIDDEN')
  })

  it('admin upgrade applies only when READY; suspended admin stays forbidden', () => {
    expect(
      effectiveCapabilities({
        isSignedIn: true,
        isSuspended: false,
        isOnboarded: true,
        isAdmin: true,
      }).admin,
    ).toBe(true)
    expect(
      effectiveCapabilities({
        isSignedIn: true,
        isSuspended: true,
        isOnboarded: true,
        isAdmin: true,
      }).admin,
    ).toBe(false)
  })

  it('resolves from a profile row and treats missing profile as GUEST', () => {
    expect(resolveTierFromProfile(null)).toBe('GUEST')
    expect(
      resolveTierFromProfile({
        onboarding_status: 'completed',
        app_role: 'user',
        suspended_at: null,
      }),
    ).toBe('AUTH_READY')
    expect(
      resolveTierFromProfile({
        onboarding_status: 'pending',
        app_role: 'user',
        suspended_at: null,
      }),
    ).toBe('AUTH_PENDING')
    expect(
      resolveTierFromProfile({
        onboarding_status: 'completed',
        app_role: 'user',
        suspended_at: '2026-01-01T00:00:00Z',
      }),
    ).toBe('FORBIDDEN')
  })

  it('denial carries safe copy + status from the canonical message library', () => {
    const denial = ensureCapability('GUEST', 'swipe')
    expect(denial).not.toBeNull()
    expect(denial!.message.length).toBeGreaterThan(0)
    expect(denial!.status).toBe(403)
    expect(ensureCapability('AUTH_READY', 'swipe')).toBeNull()
  })
})
