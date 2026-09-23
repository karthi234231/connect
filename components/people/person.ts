import { initialsForName } from '@/types/profile'

export type Person = {
  id: string
  name: string
  role: string
  company: string
  initials: string
  tone: string
  note: string
  tags: string[]
  location: string
  availability: string
  mutuals: number
  experience: string
  interests: string[]
  education: string
  /** Optional avatar image (sourced profile); falls back to initials. */
  avatarUrl?: string | null
  /** Optional server-authored match score, shown as a badge. */
  score?: number
  /** Optional explainability factors rendered alongside the score badge. */
  factors?: { label: string; value: number }[]
}

/** First letters of the first two words of a name, uppercase. */
export function personInitials(name: string): string {
  return initialsForName(name)
}
