const AVATAR_TONES = [
  'bg-amber-200',
  'bg-rose-200',
  'bg-sky-200',
  'bg-violet-200',
  'bg-emerald-200',
] as const

/**
 * Code points that never render as a standalone "initial": combining
 * diacritical marks, variation selectors, emoji (skin-tone) modifiers,
 * zero-width characters, and the byte-order mark. Skipping them means names
 * like "\u0301Alix" or "👩🏽 Dev" still yield a clean, visible initial.
 */
function isSkippedCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) || // combining diacriticals
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) || // combining extended
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) || // combining supplement
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // combining marks for symbols
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // variation selectors
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) || // combining half marks
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) || // emoji modifiers
    (codePoint >= 0x200b && codePoint <= 0x200d) || // zero-width space/non-joiner/joiner
    codePoint === 0x2060 || // word joiner
    codePoint === 0xfeff // byte-order mark / zero-width no-break space
  )
}

/**
 * First meaningful character of a word. Iterates code points (never raw UTF-16
 * units) so astral-plane characters such as emoji are not sliced in half into a
 * lone surrogate. Returns '' when the word is only marks/zero-width chars.
 */
function firstInitialOf(word: string): string {
  for (const codePoint of word) {
    if (!isSkippedCodePoint(codePoint.codePointAt(0) ?? 0)) return codePoint
  }
  return ''
}

/** Up to two uppercase initials: first char of the first and last word. */
export function getInitials(
  fullName: string | null | undefined,
  fallback = '?',
): string {
  const trimmed = fullName?.trim()
  if (!trimmed) return fallback

  // NFC so composed and decomposed forms of the same name (é vs e\u0301)
  // produce identical initials across callers/invocations.
  const normalized = trimmed.normalize('NFC')
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0) return fallback

  const first = firstInitialOf(words[0])
  const last = words.length > 1 ? firstInitialOf(words[words.length - 1]) : ''
  const initials = `${first}${last}`.toUpperCase()

  return initials || fallback
}

/** Deterministic pastel tone class for an avatar. Same seed, same tone. */
export function avatarTone(seed: string | null | undefined): string {
  // NFC keeps the hash stable for NFC/NFD spellings of the same name.
  const normalized = (seed ?? '').normalize('NFC')
  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]
}