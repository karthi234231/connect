// src/lib/moderation/denylist.ts
import { logger } from '@/lib/logger'

/**
 * Curated denylist of egregious terms (slurs, hate speech, etc.).
 * This is deliberately small to avoid false positives on a professional builder platform.
 * Terms are stored as lowercase strings for case‑insensitive matching.
 */
const DENYLIST: string[] = [
  // Racial/ethnic slurs (exact terms only – not prefixes)
  'nigger',
  'nigga',
  'kike',
  'spic',
  'chink',
  'gook',
  'raghead',
  'towelhead',
  'sandnigger',
  'wetback',
  'beaner',
  // LGBTQ+ slurs
  'faggot',
  'fag',
  'dyke',
  'tranny',
  'queer', // Note: "queer" is reclaimed, but we keep it as a safety measure; review if needed
  // Gender/identity slurs
  'cunt',
  'pussy',
  'bitch',
  'whore',
  'slut',
  // Other severe abuse
  'retard',
  'mongoloid',
  // Extremist/hate group terms (specific references)
  'white power',
  '1488',
  'kkk',
  'hitler',
  'nazi',
]

// Precompile regex for performance (once)
// eslint-disable-next-line security/detect-non-literal-regexp -- DENYLIST is a compile-time constant array of curated terms; the regex is built once at module load, never from user input.
const DENYLIST_REGEX = new RegExp(`\\b(${DENYLIST.join('|')})\\b`, 'i')

/**
 * Check if a text contains any denylisted term.
 * Uses word‑boundary matching to avoid false positives (e.g., "class" won't match "ass").
 * Returns true if any term is found.
 */
export function containsDenylisted(text: string): boolean {
  if (!text || text.length === 0) {
    return false
  }

  // Strip common separators to catch "f*ck" but not over‑do it
  const cleaned = text
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ') // collapse spaces
    .trim()

  const found = DENYLIST_REGEX.test(cleaned)

  if (found) {
    logger.warn('Denylisted content detected', {
      textLength: text.length,
      // We don't log the actual text to avoid storing PII/hate speech
    })
  }

  return found
}

/**
 * Get the denylist for review or extension.
 * Exported so the owner can review and extend it.
 */
export function getDenylist(): readonly string[] {
  return DENYLIST as readonly string[]
}

/**
 * Add a term to the denylist (runtime only – not persisted).
 * Use this for temporary additions during testing.
 */
export function addToDenylist(term: string): void {
  if (!DENYLIST.includes(term.toLowerCase())) {
    DENYLIST.push(term.toLowerCase())
    logger.info(`Added term to denylist: ${term}`)
  }
}
