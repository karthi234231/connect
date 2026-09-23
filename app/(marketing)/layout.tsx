import Link from 'next/link'
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Logo } from '@/components/brand/Logo'

const footerLinks = [
  { href: '/browse', label: 'Browse' },
  { href: '/events/search', label: 'Events' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <Header
        left={
          <Link href="/">
            <Logo wordmark />
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer links={footerLinks} />
    </div>
  )
}
