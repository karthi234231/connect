'use client'

import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0C0F] px-4 py-12 text-[#F1EEE7] selection:bg-[#D0A45B] selection:text-[#0A0C0F] overflow-hidden cx-page-enter">
      {/* Background Luxury Ambient Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(228,125,114,0.12)_0%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />

      {/* Luxury Glass Card */}
      <main className="relative z-10 flex w-full max-w-lg flex-col items-center rounded-3xl border border-[#293038]/80 bg-[#101317]/85 p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-12">
        {/* Card Top Border Accent */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl border border-[#E47D72]/20 mask-[linear-gradient(to_bottom,white,transparent)]"
          aria-hidden="true"
        />

        {/* Warning Icon Badge */}
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl border border-[#E47D72]/30 bg-gradient-to-b from-[#38211E] to-[#1A1315] text-[#E47D72] shadow-[0_0_24px_rgba(228,125,114,0.2)]">
          <AlertTriangle className="size-9 text-[#E47D72]" />
        </div>

        {/* 500 Exception Tag */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E47D72]/30 bg-[#E47D72]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#E47D72]">
          500 · Unexpected Error
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-[#F1EEE7] sm:text-3xl">
          Something went wrong
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-[#8D8A84] sm:text-base">
          An unexpected exception occurred while rendering this surface. Your
          data is safe — use the recovery actions below to restore session
          state.
        </p>

        {error?.digest ? (
          <div className="mt-3 rounded-lg border border-[#293038] bg-[#16191E] px-3 py-1 text-[11px] font-mono text-[#666762]">
            Reference: {error.digest}
          </div>
        ) : null}

        {/* Recovery Action Buttons */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            size="lg"
            onClick={reset}
            className="w-full sm:w-auto border-none bg-gradient-to-r from-[#D0A45B] to-[#E6C687] text-[#0A0C0F] font-semibold hover:brightness-110 shadow-[0_4px_20px_rgba(208,164,91,0.3)] transition-all duration-200"
            icon={<RotateCcw className="size-4" />}
          >
            Try again
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto border-[#293038] bg-[#161B22]/70 text-[#F1EEE7] hover:bg-[#21262D] hover:border-[#D0A45B]/40 transition-all duration-200"
            icon={<RefreshCw className="size-4" />}
          >
            Reload page
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8D8A84] transition hover:text-[#D0A45B]"
          >
            <Home className="size-3.5" /> Return to home page
          </Link>
        </div>
      </main>
    </div>
  )
}
