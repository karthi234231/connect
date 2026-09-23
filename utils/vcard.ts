// utils/vcard.ts

export interface VCardSocialLinks {
  github?: string | null
  linkedin?: string | null
  twitter?: string | null
  portfolio?: string | null
}

export interface VCardContactInfo {
  fullName: string
  role?: string | null
  bio?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  timezone?: string | null
  socialLinks?: VCardSocialLinks | null
}

function escapeVCardValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

export function formatUrl(url: string): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

export function formatSocialUrl(
  platform: 'github' | 'linkedin' | 'twitter' | 'portfolio',
  value: string,
): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  const clean = trimmed.replace(/^@/, '')
  switch (platform) {
    case 'github':
      return `https://github.com/${clean}`
    case 'linkedin':
      return clean.startsWith('in/') || clean.startsWith('company/')
        ? `https://linkedin.com/${clean}`
        : `https://linkedin.com/in/${clean}`
    case 'twitter':
      return `https://x.com/${clean}`
    case 'portfolio':
      return `https://${trimmed}`
    default:
      return `https://${trimmed}`
  }
}

/**
 * Generates a standard vCard (v3.0) string formatted for contact export (.vcf).
 */
export function generateVCard(info: VCardContactInfo): string {
  const name = (info.fullName || 'Community Member').trim()
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(name)}`,
  ]

  const parts = name.split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : ''
  lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`)

  if (info.role) {
    lines.push(`TITLE:${escapeVCardValue(info.role)}`)
  }

  if (info.bio) {
    lines.push(`NOTE:${escapeVCardValue(info.bio).replace(/\n/g, '\\n')}`)
  }

  if (info.city) {
    lines.push(`ADR;TYPE=WORK:;;;${escapeVCardValue(info.city)};;;`)
  }

  if (info.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(info.email)}`)
  }

  if (info.phone) {
    lines.push(`TEL;TYPE=CELL:${escapeVCardValue(info.phone)}`)
  }

  if (info.timezone) {
    lines.push(`TZ:${escapeVCardValue(info.timezone)}`)
  }

  if (info.socialLinks) {
    const { portfolio, linkedin, github, twitter } = info.socialLinks
    if (portfolio) {
      lines.push(`URL;TYPE=portfolio:${formatUrl(portfolio)}`)
    }
    if (linkedin) {
      lines.push(`URL;TYPE=linkedin:${formatSocialUrl('linkedin', linkedin)}`)
    }
    if (github) {
      lines.push(`URL;TYPE=github:${formatSocialUrl('github', github)}`)
    }
    if (twitter) {
      lines.push(`URL;TYPE=twitter:${formatSocialUrl('twitter', twitter)}`)
    }
  }

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

/**
 * Triggers a browser download of the generated vCard as a .vcf file.
 */
export function downloadVCardFile(filename: string, vcardContent: string): void {
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeFilename = filename.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  link.setAttribute('download', `${safeFilename}.vcf`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
