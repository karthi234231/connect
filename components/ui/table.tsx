import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type TableProps = HTMLAttributes<HTMLTableElement>

export function Table({ className, ...props }: TableProps) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  )
}

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return <thead className={cn(className)} {...props} />
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>

export function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody className={className} {...props} />
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement>

export function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn('border-b border-[var(--cx-border-1)]', className)}
      {...props}
    />
  )
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]',
        className,
      )}
      {...props}
    />
  )
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>

export function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      className={cn('px-4 py-3 text-sm text-[var(--cx-text-1)]', className)}
      {...props}
    />
  )
}
