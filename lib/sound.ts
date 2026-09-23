export type SoundPreference = 'system' | 'on' | 'off'

export const SOUND_STORAGE_KEY = 'connect:sound-preference'

const DEFAULT_SOUND_PREFERENCE: SoundPreference = 'system'

export function getSoundPreference(): SoundPreference {
  if (typeof window === 'undefined') {
    return DEFAULT_SOUND_PREFERENCE
  }

  const stored = window.localStorage.getItem(SOUND_STORAGE_KEY)

  if (stored === 'system' || stored === 'on' || stored === 'off') {
    return stored
  }

  return DEFAULT_SOUND_PREFERENCE
}

export function setSoundPreference(preference: SoundPreference) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SOUND_STORAGE_KEY, preference)
}

export function isSoundEnabled(): boolean {
  return getSoundPreference() !== 'off'
}

/**
 * Connect does not autoplay sounds.
 *
 * This helper only plays a caller-supplied sound after an
 * explicit user interaction has already occurred.
 */
let audioContext: AudioContext | null = null

/**
 * Unlock Web-Audio on the first user gesture so later sounds can play
 * without violating autoplay policies. Harmless when called repeatedly.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!Ctor) {
      return
    }

    if (!audioContext) {
      audioContext = new Ctor()
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
  } catch {
    audioContext = null
  }
}

function getChimeContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!Ctor) {
    return null
  }

  try {
    if (!audioContext) {
      audioContext = new Ctor()
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    return audioContext
  } catch {
    return null
  }
}

const CHIME_NOTES = [660, 880, 990] as const

/**
 * Soft synthesized welcome chime — no audio assets required. Respects the
 * sound preference; silently no-ops on unsupported/busy surfaces.
 */
export function playSplashChime(volume = 0.18): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  if (!isSoundEnabled()) {
    return false
  }

  const ctx = getChimeContext()

  if (!ctx) {
    return false
  }

  try {
    const now = ctx.currentTime
    const master = ctx.createGain()

    master.gain.value = 0
    master.connect(ctx.destination)
    master.gain.setValueAtTime(0, now)
    master.gain.linearRampToValueAtTime(volume, now + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)

    CHIME_NOTES.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      const start = now + index * 0.09

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      osc.detune.value = -4

      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.55, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)

      osc.connect(gain).connect(master)
      osc.start(start)
      osc.stop(start + 1)
    })

    return true
  } catch {
    return false
  }
}

export function playUiSound(
  source: string,
  volume = 0.35,
): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (!isSoundEnabled()) {
    return null
  }

  if (!source) {
    return null
  }

  try {
    const audio = new Audio(source)

    audio.volume = Math.min(1, Math.max(0, volume))

    void audio.play().catch(() => {
      // Browsers may reject playback when no user gesture
      // has been received. Sound is optional and must not
      // interrupt the primary interaction.
    })

    return audio
  } catch {
    return null
  }
}
