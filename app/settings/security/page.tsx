'use client'

import { useState, useTransition } from 'react'
import {
  KeyRound,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import {
  generateMfaSecretAction,
  verifyMfaSetupAction,
  type MfaSecretResult,
} from '@/app/actions/auth'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui'
import { isFeatureEnabled } from '@/config/feature-flags'

// TODO(WS-1): MFA persistence — there is NO column for TOTP enrolment in
// types/database.ts (no `totp`/`mfa` migration exists in supabase/). Until that
// migration lands, enrolment is SESSION-SCOPED page state: refresh wipes it, and
// recovery codes are displayed but not stored server-side. Do NOT invent a
// migration this pass; the persistence + revocation surface must be designed
// (encrypted secret storage, single-use recovery-code tracking, reset flow).

// TODO(WS-1): Password last-changed, trusted-device count and active-session
// inventory have NO backing store in types/database.ts (no password_changed_at
// / device / session tables). Their descriptions stay honest and non-numeric
// until those reads exist — never a fabricated "3 weeks ago" or "2 devices".
const rows = [
  {
    label: 'Password',
    description: 'Change your password',
    icon: KeyRound,
  },
  {
    label: 'Two-factor authentication',
    description: 'Authenticator app',
    icon: ShieldCheck,
    mfa: true,
  },
  {
    label: 'Trusted devices',
    description: 'Manage the devices you sign in from',
    icon: Smartphone,
  },
  {
    label: 'Active sessions',
    description: 'Review where you are signed in',
    icon: Monitor,
  },
]

// Honest explainers: none of these rows has a backing store yet, so each row
// says what it would do instead of pretending the action already exists.
const explains: Record<string, string> = {
  Password:
    'Changes to your password run through your sign-in provider (LinkedIn OIDC) — Connect holds no separate password, so there is nothing to reset here.',
  'Trusted devices':
    'Trusted-device management is on the roadmap — no device inventory is stored yet, so there is nothing to revoke here today.',
  'Active sessions':
    'Active-session review is on the roadmap — no session table exists yet, so where you are signed in is managed by your provider for now.',
}

export default function SecuritySettingsPage() {
  const mfaEnabled = isFeatureEnabled('mfa')

  // Session-scoped MFA enrolment state (see TODO above).
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [enrolment, setEnrolment] = useState<Extract<
    MfaSecretResult,
    { ok: true }
  > | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mfaBusy, startMfa] = useTransition()

  const openMfaDialog = () => {
    setDialogOpen(true)
    setMfaError(null)
    setRecoveryCodes(null)
    setVerifyCode('')
    setEnrolment(null)
    startMfa(async () => {
      const result = await generateMfaSecretAction()
      if (result.ok) {
        setEnrolment(result)
      } else {
        setMfaError(result.error)
      }
    })
  }

  const confirmEnrolment = () => {
    if (!enrolment) return
    setMfaError(null)
    startMfa(async () => {
      const result = await verifyMfaSetupAction({
        secret: enrolment.secret,
        code: verifyCode.trim(),
      })
      if (result.ok) {
        setMfaEnrolled(true)
        setRecoveryCodes(result.recoveryCodes)
      } else {
        setMfaError(result.error)
      }
    })
  }

  const mfaDescription = mfaEnabled
    ? mfaEnrolled
      ? 'Authenticator app enabled (this session)'
      : 'Not set up yet — add an authenticator app'
    : 'Authenticator app enabled'

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-10 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--cx-text-4)]">
            Settings
          </p>
        </div>
        <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          Security
        </h1>
        <p className="mb-8 mt-1 text-sm text-[var(--cx-text-3)]">
          Keep your account and sessions safe.
        </p>

        <Accordion type="single">
          {rows.map(({ label, description, icon: Icon, mfa }) => {
            const isMfaRow = mfa === true
            return (
              <AccordionItem
                key={label}
                value={label}
                className="mb-3 rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]"
              >
                <AccordionTrigger className="rounded-[20px] px-4 py-4 sm:px-5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-surface-2)] text-[var(--cx-brand-strong)]">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--cx-text-1)]">
                        {label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--cx-text-3)]">
                        {isMfaRow ? mfaDescription : description}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 sm:px-5">
                  {isMfaRow ? (
                    <div className="space-y-3">
                      <Alert
                        variant="warning"
                        title="Session-scoped for now"
                        description="MFA enrolment has no server-side store yet, so codes you set up apply to this browser session and reset on refresh."
                      />
                      {mfaEnabled ? (
                        <Button size="sm" onClick={openMfaDialog}>
                          {mfaEnrolled ? 'Manage' : 'Enable two-factor'}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p>{explains[label] ?? description}</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <div className="mt-6 space-y-3">
          {mfaEnabled && !mfaEnrolled ? (
            <Alert
              variant="warning"
              icon={<LockKeyhole className="size-4" />}
              title="Two-factor isn't stored server-side yet"
              description="Enrolment is session-scoped — refreshing this page clears it. Persisting and revoking authenticator codes lands with the TOTP store migration."
            />
          ) : null}
          <Alert
            variant="info"
            icon={<ShieldCheck className="size-4" />}
            description="Activity that looks unusual is blocked and reviewed automatically."
          />
        </div>
      </div>

      {mfaEnabled && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogTitle>
              {mfaEnrolled
                ? 'Two-factor authentication enabled'
                : 'Set up two-factor authentication'}
            </DialogTitle>
            <DialogDescription>
              {mfaEnrolled
                ? 'Authenticator codes are active for this session.'
                : 'Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.'}
            </DialogDescription>

            {mfaEnrolled ? (
              <div className="mt-4 space-y-4">
                {recoveryCodes && (
                  <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4">
                    <p className="text-xs font-medium text-[var(--cx-text-2)]">
                      Recovery codes
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--cx-text-3)]">
                      Store these somewhere safe — each one can be used once if
                      you lose access to your authenticator app.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {recoveryCodes.map((code) => (
                        <code
                          key={code}
                          className="rounded-md bg-[var(--cx-surface-3)] px-2 py-1 text-[11px] tracking-wide text-[var(--cx-text-1)]"
                        >
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <DialogClose className="rounded-full bg-[var(--cx-brand)] px-4 py-2 text-xs font-medium text-white transition hover:bg-[var(--cx-brand-strong)]">
                    Done
                  </DialogClose>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {enrolment ? (
                  <>
                    <div className="flex justify-center rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral in-memory data URL; next/image cannot optimize it */}
                      <img
                        src={enrolment.qrDataUrl}
                        alt="Scan this QR code with your authenticator app"
                        className="size-40"
                      />
                    </div>
                    <p className="break-all text-center font-mono text-xs text-[var(--cx-text-3)]">
                      {enrolment.secret}
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={verifyCode}
                      onChange={(event) =>
                        setVerifyCode(event.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="000000"
                      className="w-full rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-center text-sm outline-none placeholder:text-[var(--cx-text-4)] focus:border-[var(--cx-brand)]"
                    />
                  </>
                ) : (
                  <p className="text-xs text-[var(--cx-text-3)]">
                    Generating a secure secret…
                  </p>
                )}

                {mfaError && (
                  <p className="text-xs text-[var(--cx-danger)]">{mfaError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <DialogClose className="rounded-full border border-[var(--cx-border-1)] px-4 py-2 text-xs font-medium text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)]">
                    Cancel
                  </DialogClose>
                  <button
                    type="button"
                    disabled={mfaBusy || !enrolment || verifyCode.length < 6}
                    onClick={confirmEnrolment}
                    className="rounded-full bg-[var(--cx-brand)] px-4 py-2 text-xs font-medium text-white transition hover:bg-[var(--cx-brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Verify &amp; enable
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
