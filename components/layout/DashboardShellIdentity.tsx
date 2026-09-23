'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { fetchOwnProfile } from '@/client/api/profiles'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { initialsForName } from '@/types/profile'
import { ROUTES } from '@/config/routes'
import { secondaryNavItems } from '@/config/navigation'
import { cn } from '@/utils/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function DashboardShellIdentity() {
  const [profileKey] = useState(() => keys.profile('me').join('/'))
  const { data } = useQuery(profileKey, () => fetchOwnProfile())
  const name = data?.full_name?.trim() ? data.full_name : null
  const firstWord = name?.split(/\s+/)[0]
  const initials = initialsForName(name ?? 'You') || '··'

  const [open, setOpen] = useState(false)

  const itemBase =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]'

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-[var(--cx-text-3)] sm:block">
        {firstWord ? `Good day, ${firstWord}` : 'Welcome back'}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Open profile menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex size-9 items-center justify-center gap-0.5 rounded-full bg-[#e4c1aa] text-xs font-semibold text-[#3b2822] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--cx-brand-strong)]"
        >
          {initials}
          <ChevronDown
            className={cn(
              'size-3 shrink-0 text-[#3b2822]/50 transition-transform',
              open && 'rotate-180',
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {secondaryNavItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className={itemBase}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          ))}
          <div className="my-1 h-px bg-[var(--cx-border-1)]" />
          <form
            action={ROUTES.logout}
            method="post"
            onSubmit={() => setOpen(false)}
          >
            <button
              type="submit"
              className={cn(
                itemBase,
                'text-[var(--cx-danger)] hover:bg-[var(--cx-danger-soft)] hover:text-[var(--cx-danger)]',
              )}
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
