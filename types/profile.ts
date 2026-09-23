import type { Tables } from '@/types/database'

export interface SocialLinks {
  github?: string | null
  linkedin?: string | null
  twitter?: string | null
  portfolio?: string | null
}

export type ProfileRow = Tables<'profiles'>

export type ProfileSummary = Pick<
  ProfileRow,
  'id' | 'full_name' | 'avatar_url' | 'bio' | 'city' | 'role' | 'skills'
> & {
  /** User-owned introduction headline (profiles.headline, Session 03). */
  headline: string | null
  socialLinks?: SocialLinks | null
  social_links?: SocialLinks | null
}

export type ProfileDraft = Partial<
  Pick<
    ProfileRow,
    | 'full_name'
    | 'avatar_url'
    | 'bio'
    | 'city'
    | 'timezone'
    | 'role'
    | 'skills'
    | 'availability'
    | 'looking_for'
    | 'offering'
  >
> & {
  socialLinks?: SocialLinks | null
  social_links?: SocialLinks | null
}

export function initialsForName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

