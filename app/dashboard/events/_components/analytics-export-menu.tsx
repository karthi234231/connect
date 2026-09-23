'use client'

import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import {
  exportEventAnalyticsCsv,
  exportEventAnalyticsJson,
} from '@/client/api/events'

/** Organizer export menu: analytics snapshot as JSON or CSV (WS-A2). */
export function AnalyticsExportMenu({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'json' | 'csv') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'json') {
        await exportEventAnalyticsJson(eventId)
      } else {
        await exportEventAnalyticsCsv(eventId)
      }
      setOpen(false)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        icon={<Download className="size-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Export
      </Button>

      {open ? (
        <>
          <button
            aria-label="Close export menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Card className="absolute right-0 top-full z-20 mt-2 w-56 p-1.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('json')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] hover:bg-[var(--cx-surface-2)] disabled:opacity-60"
            >
              <FileJson className="size-4 text-[var(--cx-text-3)]" />
              Analytics (JSON)
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('csv')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] hover:bg-[var(--cx-surface-2)] disabled:opacity-60"
            >
              <FileSpreadsheet className="size-4 text-[var(--cx-text-3)]" />
              Analytics (CSV)
            </button>
            {error ? (
              <p
                role="alert"
                className="px-3 pb-1 pt-1 text-xs text-[var(--cx-danger)]"
              >
                {error}
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  )
}
