'use client'

import { useCallback, useRef } from 'react'

interface LiveRegion {
  polite: (message: string) => void
  assertive: (message: string) => void
}

let politeRegion: HTMLDivElement | null = null
let assertiveRegion: HTMLDivElement | null = null

function getPoliteRegion(): HTMLDivElement {
  if (!politeRegion && typeof document !== 'undefined') {
    politeRegion = document.createElement('div')
    politeRegion.setAttribute('role', 'status')
    politeRegion.setAttribute('aria-live', 'polite')
    politeRegion.setAttribute('aria-atomic', 'true')
    politeRegion.className = 'sr-only'
    document.body.appendChild(politeRegion)
  }
  return politeRegion!
}

function getAssertiveRegion(): HTMLDivElement {
  if (!assertiveRegion && typeof document !== 'undefined') {
    assertiveRegion = document.createElement('div')
    assertiveRegion.setAttribute('role', 'alert')
    assertiveRegion.setAttribute('aria-live', 'assertive')
    assertiveRegion.setAttribute('aria-atomic', 'true')
    assertiveRegion.className = 'sr-only'
    document.body.appendChild(assertiveRegion)
  }
  return assertiveRegion!
}

const timers = new Map<HTMLDivElement, ReturnType<typeof setTimeout>>()

function announce(region: HTMLDivElement, message: string) {
  region.textContent = ''
  const timer = timers.get(region)
  if (timer) clearTimeout(timer)
  region.textContent = message
  timers.set(
    region,
    setTimeout(() => {
      region.textContent = ''
      timers.delete(region)
    }, 1000),
  )
}

export function resetLiveRegionsForTests(): void {
  if (typeof document === 'undefined') return

  for (const region of [politeRegion, assertiveRegion]) {
    if (!region) continue
    const timer = timers.get(region)
    if (timer) clearTimeout(timer)
    region.remove()
    timers.delete(region)
  }

  politeRegion = null
  assertiveRegion = null
}

export function useLiveRegion(): LiveRegion {
  const politeRef = useRef<HTMLDivElement | null>(null)
  const assertiveRef = useRef<HTMLDivElement | null>(null)

  const polite = useCallback((message: string) => {
    if (typeof document === 'undefined') return
    const region = politeRef.current ?? getPoliteRegion()
    politeRef.current = region
    announce(region, message)
  }, [])

  const assertive = useCallback((message: string) => {
    if (typeof document === 'undefined') return
    const region = assertiveRef.current ?? getAssertiveRegion()
    assertiveRef.current = region
    announce(region, message)
  }, [])

  return { polite, assertive }
}
