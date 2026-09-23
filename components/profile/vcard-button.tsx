'use client'

import { useState } from 'react'
import { Download, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  generateVCard,
  downloadVCardFile,
  type VCardContactInfo,
} from '@/utils/vcard'
import { cn } from '@/utils/cn'

export interface VCardExportButtonProps {
  profile: VCardContactInfo
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  className?: string
  label?: string
}

export function VCardExportButton({
  profile,
  variant = 'secondary',
  size = 'sm',
  className,
  label = 'Export vCard',
}: VCardExportButtonProps) {
  const [downloaded, setDownloaded] = useState(false)

  const handleExport = () => {
    try {
      const vcardContent = generateVCard(profile)
      const filename = `${profile.fullName || 'contact'}_connect`
      downloadVCardFile(filename, vcardContent)
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2500)
    } catch (err) {
      console.error('Failed to generate vCard:', err)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleExport}
      className={cn('gap-2 font-medium transition-all', className)}
      title="Download contact card as .vcf file"
      aria-label="Export contact vCard file"
    >
      {downloaded ? (
        <>
          <Check className="size-4 text-[var(--cx-success)]" />
          <span>Downloaded</span>
        </>
      ) : (
        <>
          <Download className="size-4" />
          <span>{label}</span>
        </>
      )}
    </Button>
  )
}
