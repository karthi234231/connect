'use client'

import { useState } from 'react'
import { Globe, Save, Loader2, Check, Link2 } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import type { SocialLinks } from '@/types/profile'
import { updateProfileAction } from '@/app/actions/profiles'
import { cn } from '@/utils/cn'

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.74a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
    </svg>
  )
}

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export interface SocialLinksEditorProps {
  initialSocialLinks?: SocialLinks | null
  onSaved?: (links: SocialLinks) => void
  className?: string
}

export function SocialLinksEditor({
  initialSocialLinks,
  onSaved,
  className,
}: SocialLinksEditorProps) {
  const [links, setLinks] = useState<SocialLinks>({
    github: initialSocialLinks?.github ?? '',
    linkedin: initialSocialLinks?.linkedin ?? '',
    twitter: initialSocialLinks?.twitter ?? '',
    portfolio: initialSocialLinks?.portfolio ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (key: keyof SocialLinks, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const payload: SocialLinks = {
        github: links.github?.trim() || null,
        linkedin: links.linkedin?.trim() || null,
        twitter: links.twitter?.trim() || null,
        portfolio: links.portfolio?.trim() || null,
      }

      const res = await updateProfileAction({ socialLinks: payload })
      if (res.ok) {
        setSaved(true)
        if (onSaved) onSaved(payload)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(res.error || 'Failed to save social links.')
      }
    } catch (err) {
      console.error('Failed to update social links:', err)
      setError('An unexpected error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 shadow-sm space-y-6',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--cx-border-1)] pb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--cx-text-1)] flex items-center gap-2">
            <Link2 className="size-5 text-[var(--cx-brand)]" />
            <span>Social & Professional Links</span>
          </h3>
          <p className="mt-1 text-xs text-[var(--cx-text-3)]">
            Connect your GitHub, LinkedIn, X/Twitter, and Portfolio to display on your public profile & contact card.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[var(--cx-error)]/30 bg-[var(--cx-error-soft)] p-3 text-xs text-[var(--cx-error)]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GitHub */}
        <div className="space-y-1.5">
          <label
            htmlFor="github-input"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-2)]"
          >
            <GithubIcon className="size-4 text-[#2da44e]" />
            <span>GitHub Profile</span>
          </label>
          <Input
            id="github-input"
            type="text"
            placeholder="github.com/username or @username"
            value={links.github ?? ''}
            onChange={(e) => handleChange('github', e.target.value)}
            className="bg-[var(--cx-surface-2)] text-xs"
          />
        </div>

        {/* LinkedIn */}
        <div className="space-y-1.5">
          <label
            htmlFor="linkedin-input"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-2)]"
          >
            <LinkedinIcon className="size-4 text-[#0a66c2]" />
            <span>LinkedIn Profile</span>
          </label>
          <Input
            id="linkedin-input"
            type="text"
            placeholder="linkedin.com/in/username or username"
            value={links.linkedin ?? ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            className="bg-[var(--cx-surface-2)] text-xs"
          />
        </div>

        {/* Twitter / X */}
        <div className="space-y-1.5">
          <label
            htmlFor="twitter-input"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-2)]"
          >
            <TwitterIcon className="size-4 text-[#1d9bf0]" />
            <span>X / Twitter</span>
          </label>
          <Input
            id="twitter-input"
            type="text"
            placeholder="x.com/username or @username"
            value={links.twitter ?? ''}
            onChange={(e) => handleChange('twitter', e.target.value)}
            className="bg-[var(--cx-surface-2)] text-xs"
          />
        </div>

        {/* Portfolio */}
        <div className="space-y-1.5">
          <label
            htmlFor="portfolio-input"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-2)]"
          >
            <Globe className="size-4 text-[var(--cx-brand)]" />
            <span>Portfolio / Website</span>
          </label>
          <Input
            id="portfolio-input"
            type="text"
            placeholder="https://yourwebsite.com"
            value={links.portfolio ?? ''}
            onChange={(e) => handleChange('portfolio', e.target.value)}
            className="bg-[var(--cx-surface-2)] text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 font-medium"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : saved ? (
            <>
              <Check className="size-4 text-[var(--cx-success)]" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="size-4" />
              <span>Save Social Links</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
