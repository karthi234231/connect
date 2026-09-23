import { Gauge } from 'lucide-react'

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--cx-border-1)] bg-[color:var(--cx-bg)/.94] backdrop-blur-xl">
      <div className="mx-auto flex h-[50px] max-w-[1180px] items-center justify-between px-2.5 sm:h-[68px] sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]">
            <Gauge className="size-4" />
          </div>
          <span className="text-xs uppercase tracking-[.16em] text-[var(--cx-text-3)]">
            Admin
          </span>
        </div>
      </div>
    </header>
  )
}
