'use client'

import Link from 'next/link'
import { Compass, Home, SearchX, Sparkles, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0C0F] px-4 py-12 text-[#F1EEE7] selection:bg-[#D0A45B] selection:text-[#0A0C0F] overflow-hidden cx-page-enter">
      {/* Background Luxury Ambient Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(208,164,91,0.14)_0%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-10 size-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(208,164,91,0.06)_0%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />

      {/* Luxury Glass Card */}
      <main className="relative z-10 flex w-full max-w-lg flex-col items-center rounded-3xl border border-[#293038]/80 bg-[#101317]/85 p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-12">
        {/* Subtle Luxury Card Border Glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl border border-[#D0A45B]/20 mask-[linear-gradient(to_bottom,white,transparent)]"
          aria-hidden="true"
        />

        {/* Floating 404 Badge Icon */}
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl border border-[#D0A45B]/30 bg-gradient-to-b from-[#211B14] to-[#14171C] text-[#D0A45B] shadow-[0_0_24px_rgba(208,164,91,0.2)]">
          <SearchX className="size-9 text-[#D0A45B]" />
        </div>

        {/* 404 Metallic Header Tag */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D0A45B]/30 bg-[#D0A45B]/10 px-3.5 py-1 text-xs font-medium tracking-wide text-[#D0A45B]">
          <Sparkles className="size-3.5" />
          <span>404 · Destination Lost</span>
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-[#F1EEE7] sm:text-3xl">
          Page lost in the ether
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-[#8D8A84] sm:text-base">
          The page or dynamic entity you are looking for does not exist, has
          been moved, or is restricted in visibility.
        </p>

        {/* Recovery Action Buttons */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Link href="/" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full border-none bg-gradient-to-r from-[#D0A45B] to-[#E6C687] text-[#0A0C0F] font-semibold hover:brightness-110 shadow-[0_4px_20px_rgba(208,164,91,0.3)] transition-all duration-200"
              icon={<Home className="size-4" />}
            >
              Return Home
            </Button>
          </Link>

          <Link href="/browse" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="lg"
              className="w-full border-[#293038] bg-[#161B22]/70 text-[#F1EEE7] hover:bg-[#21262D] hover:border-[#D0A45B]/40 transition-all duration-200"
              icon={<Compass className="size-4" />}
            >
              Explore Ideas
            </Button>
          </Link>
        </div>

        {/* Go Back & Search Links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs font-medium text-[#8D8A84]">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 transition hover:text-[#D0A45B]"
          >
            <ArrowLeft className="size-3.5" /> Go Back
          </button>
          <span className="text-[#293038]">•</span>
          <Link
            href="/events/search"
            className="transition hover:text-[#D0A45B]"
          >
            Search Events
          </Link>
        </div>
      </main>
    </div>
  )
}
