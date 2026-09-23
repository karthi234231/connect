'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number
}

export interface DataTableSort {
  key: string
  direction: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  rows: readonly T[]
  columns: DataTableColumn<T>[]
  keyField: (row: T) => string
  initialSort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort | null) => void
  empty?: ReactNode
  className?: string
}

function compareValues(
  a: string | number,
  b: string | number,
  direction: 'asc' | 'desc',
): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a
  }
  const cmp = String(a).localeCompare(String(b))
  return direction === 'asc' ? cmp : -cmp
}

function cycleSort(
  current: DataTableSort | null,
  key: string,
): DataTableSort | null {
  if (current === null || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

export function DataTable<T>({
  rows,
  columns,
  keyField,
  initialSort = null,
  onSortChange,
  empty,
  className,
}: DataTableProps<T>) {
  const isControlled = onSortChange !== undefined
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(
    initialSort,
  )

  const sort = isControlled ? initialSort : internalSort

  const handleSort = useCallback(
    (key: string) => {
      const next = cycleSort(sort, key)
      if (isControlled) {
        onSortChange?.(next)
      } else {
        setInternalSort(next)
      }
    },
    [isControlled, onSortChange, sort],
  )

  const sortedRows = useMemo(() => {
    if (isControlled || !sort) return rows
    const active = columns.find((column) => column.key === sort.key)
    if (!active?.sortValue) return rows
    const value = active.sortValue
    return [...rows].sort((a, b) =>
      compareValues(value(a), value(b), sort.direction),
    )
  }, [isControlled, sort, rows, columns])

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => {
            const active = sort?.key === column.key
            return (
              <TableHead
                key={column.key}
                aria-sort={
                  column.sortable
                    ? active
                      ? sort?.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className="inline-flex items-center gap-1 text-inherit hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)]"
                  >
                    {column.header}
                    {active ? (
                      sort?.direction === 'asc' ? (
                        <ArrowUp className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden="true" />
                      )
                    ) : (
                      <ChevronsUpDown
                        className="size-3 opacity-50"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="px-4 py-10 text-center text-[var(--cx-text-4)]"
            >
              {empty ?? 'No data'}
            </TableCell>
          </TableRow>
        ) : (
          sortedRows.map((row) => (
            <TableRow key={keyField(row)}>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
