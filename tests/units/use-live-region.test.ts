// @vitest-environment jsdom
// tests/units/use-live-region.test.ts
// Regression guard for hooks/use-live-region.ts — the only channel by which
// async UI state reaches a screen reader.
//
// The hook keeps MODULE-LEVEL singleton regions appended to `document.body`, so
// every test re-imports the module after `vi.resetModules()` to get a clean
// pair. Without that reset the later tests would silently reuse the first
// test's `ref`-cached region and assert nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { resetLiveRegionsForTests, useLiveRegion } from '@/hooks/use-live-region'

/** Must match the clear-delay in hooks/use-live-region.ts. */
const ANNOUNCE_MS = 1000

function regionFor(live: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[aria-live="${live}"]`)
}

describe('useLiveRegion — screen-reader announcements', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetLiveRegionsForTests()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('mounts a polite region with the attributes a screen reader needs', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => result.current.polite('Test message'))

    const polite = regionFor('polite')
    expect(polite).not.toBeNull()
    expect(polite?.getAttribute('role')).toBe('status')
    expect(polite?.getAttribute('aria-atomic')).toBe('true')
    // Visually hidden, never a layout participant.
    expect(polite?.className).toBe('sr-only')
    expect(polite?.textContent).toBe('Test message')
  })

  it('mounts assertive announcements as an alert region', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => result.current.assertive('Urgent message'))

    const assertive = regionFor('assertive')
    expect(assertive).not.toBeNull()
    expect(assertive?.getAttribute('role')).toBe('alert')
    expect(assertive?.getAttribute('aria-atomic')).toBe('true')
    expect(assertive?.textContent).toBe('Urgent message')
  })

  it('reuses one region per channel no matter how many times it announces', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => {
      result.current.polite('First')
      result.current.polite('Second')
      result.current.polite('Third')
    })

    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
    expect(regionFor('polite')?.textContent).toBe('Third')
  })

  it('keeps the channels independent (polite never writes to assertive)', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => {
      result.current.polite('Polite only')
      result.current.assertive('Assertive only')
    })

    expect(regionFor('polite')?.textContent).toBe('Polite only')
    expect(regionFor('assertive')?.textContent).toBe('Assertive only')
  })

  it('clears the region after the announce window so the next message re-reads', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => result.current.polite('Transient'))
    expect(regionFor('polite')?.textContent).toBe('Transient')

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_MS)
    })

    // An identical repeat must be an observable DOM change; a stale non-empty
    // region would make screen readers skip it.
    expect(regionFor('polite')?.textContent).toBe('')
  })

  it('cancels the previous clear timer on a rapid re-announcement', async () => {
    const { result } = renderHook(() => useLiveRegion())

    act(() => result.current.polite('First'))
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_MS - 1)
    })
    act(() => result.current.polite('Second'))

    // The first timer would have fired 1ms later; it must not blank the newer
    // message early.
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(regionFor('polite')?.textContent).toBe('Second')

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_MS)
    })
    expect(regionFor('polite')?.textContent).toBe('')
  })

  it('is inert when there is no document (SSR render pass)', async () => {
    const { result } = renderHook(() => useLiveRegion())

    const originalDocument = globalThis.document
    // @ts-expect-error — simulate the server render where `document` is absent.
    delete globalThis.document
    try {
      expect(() => result.current.polite('server side')).not.toThrow()
    } finally {
      globalThis.document = originalDocument
    }
  })
})
