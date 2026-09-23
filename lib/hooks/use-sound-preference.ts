'use client'

import * as React from 'react'

import {
  getSoundPreference,
  setSoundPreference,
  type SoundPreference,
} from '@/lib/sound'

/**
 * localStorage is an external store — read it through useSyncExternalStore so
 * the client value is never written back into state from an effect.
 */
const storageListeners = new Set<() => void>()

function subscribeToStorage(onChange: () => void): () => void {
  storageListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    storageListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useSoundPreference() {
  const preference = React.useSyncExternalStore<SoundPreference>(
    subscribeToStorage,
    getSoundPreference,
    () => 'system',
  )

  const updatePreference = React.useCallback(
    (nextPreference: SoundPreference) => {
      setSoundPreference(nextPreference)
      for (const listener of storageListeners) {
        listener()
      }
    },
    [],
  )

  return {
    preference,
    setPreference: updatePreference,
    enabled: preference !== 'off',
  }
}
