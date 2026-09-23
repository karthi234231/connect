import Link from 'next/link'
import { cn } from '@/utils/cn'

type FooterLink = {
  href: string
  label: string
}

type FooterProps = {
  links?: FooterLink[]
  note?: string
  className?: string
}

export function Footer({ links = [], note, className }: FooterProps) {
  return (
    <footer
      className={cn(
        'border-t border-[var(--cx-border-1)] py-8 text-center text-xs text-[var(--cx-text-4)]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1180px] px-2.5 sm:px-6 lg:px-8">
        {links.length > 0 ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
            aria-label="Footer"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors hover:text-[var(--cx-text-2)]"
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        {note ? <p className="mt-4">{note}</p> : null}
      </div>
    </footer>
  )
}
