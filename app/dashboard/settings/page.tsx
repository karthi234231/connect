'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@teispace/next-themes'
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Globe,
  Lock,
  MessageSquare,
  Moon,
  Palette,
  ShieldAlert,
  ShieldBan,
  Sparkles,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  StatusDot,
  Switch,
} from '@/components/ui'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import { SettingsGroup, SettingsRow } from '@/components/profile'
import { LoadingState } from '@/components/states/LoadingState'
import { ROUTES } from '@/config/routes'
import {
  deactivateAccount,
  fetchNotificationSettings,
  fetchPrivacySettings,
  updateNotificationSettings,
  updatePrivacySettings,
  type PrivacyFlags,
} from '@/client/api/settings'
import type { NotificationToggleFlags } from '@/app/dashboard/settings/notification-model'
import { useQuery, queryClient } from '@/client/query/client'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

const APPEARANCE_STORAGE_KEY = 'connect:appearance'

const sections = [
  {
    label: 'Account',
    description: 'Sign-in details and account actions.',
    icon: UserRound,
    href: ROUTES.settingsAccount,
  },
  {
    label: 'Blocked accounts',
    description: 'People you have blocked.',
    icon: ShieldBan,
    href: ROUTES.settingsBlocked,
  },
  {
    label: 'Appearance',
    description: 'Density, motion, and theme.',
    icon: Palette,
    href: ROUTES.settingsAppearance,
  },
  {
    label: 'Community',
    description: 'Your presence in the network.',
    icon: UsersRound,
    href: ROUTES.settingsCommunity,
  },
  {
    label: 'Notifications',
    description: 'What you hear about and how.',
    icon: Bell,
    href: ROUTES.settingsNotifications,
  },
  {
    label: 'Privacy',
    description: 'Who sees what, and data requests.',
    icon: Lock,
    href: ROUTES.settingsPrivacy,
  },
  {
    label: 'Profile',
    description: 'The story you tell the network.',
    icon: UserRound,
    href: ROUTES.settingsProfile,
  },
]

export default function SettingsPage() {
  // Theme & Appearance state
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDarkMode = theme === 'dark' || resolvedTheme === 'dark'
  const [appearanceFlags, setAppearanceFlags] = useLocalStorage(APPEARANCE_STORAGE_KEY, {
    compact: false,
    motion: false,
  })

  // Notification Quick Settings State
  const notifQueryKey = 'settings/notifications'
  const { data: notifData, isLoading: notifLoading } = useQuery(notifQueryKey, () =>
    fetchNotificationSettings(),
  )
  const [notifFlags, setNotifFlags] = useState<NotificationToggleFlags>({
    matches: true,
    messages: true,
    reminders: true,
    updates: false,
  })

  // Privacy Quick Settings State
  const privacyQueryKey = 'settings/privacy'
  const { data: privacyData, isLoading: privacyLoading } = useQuery(
    privacyQueryKey,
    () => fetchPrivacySettings(),
  )
  const [privacyFlags, setPrivacyFlags] = useState<PrivacyFlags>({
    public: true,
    status: true,
    requests: true,
  })

  // Deactivation Modal state
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('taking_break')
  const [deactivating, setDeactivating] = useState(false)
  const [deactivatedDone, setDeactivatedDone] = useState(false)

  useEffect(() => {
    if (notifData?.flags) {
      setNotifFlags(notifData.flags)
    }
  }, [notifData])

  useEffect(() => {
    if (privacyData?.flags) {
      setPrivacyFlags(privacyData.flags)
    }
  }, [privacyData])

  async function handleToggleNotif(
    key: keyof NotificationToggleFlags,
    checked: boolean,
  ) {
    const next = { ...notifFlags, [key]: checked }
    setNotifFlags(next)
    const res = await updateNotificationSettings(next)
    if (!res.ok) {
      setNotifFlags((prev: NotificationToggleFlags) => ({ ...prev, [key]: !checked }))
      showErrorToast(res.error ?? 'Failed to update notification settings.')
    } else {
      showSuccessToast('Notification preference updated')
      queryClient.invalidate(notifQueryKey)
    }
  }

  async function handleTogglePrivacy(
    key: keyof PrivacyFlags,
    checked: boolean,
  ) {
    const next = { ...privacyFlags, [key]: checked }
    setPrivacyFlags(next)
    const res = await updatePrivacySettings(next)
    if (!res.ok) {
      setPrivacyFlags((prev: PrivacyFlags) => ({ ...prev, [key]: !checked }))
      showErrorToast(res.error ?? 'Failed to update privacy settings.')
    } else {
      showSuccessToast(
        key === 'public'
          ? checked
            ? 'Profile is now public'
            : 'Profile is now private'
          : 'Privacy setting updated',
      )
      queryClient.invalidate(privacyQueryKey)
    }
  }

  function handleToggleDarkMode(checked: boolean) {
    setTheme(checked ? 'dark' : 'light')
    showSuccessToast(checked ? 'Dark mode enabled' : 'Light mode enabled')
  }

  function handleToggleCompact(checked: boolean) {
    setAppearanceFlags({ ...appearanceFlags, compact: checked })
    showSuccessToast(checked ? 'Compact view enabled' : 'Standard view enabled')
  }

  async function handleDeactivateAccount() {
    setDeactivating(true)
    try {
      const result = await deactivateAccount()
      if (result.ok) {
        setDeactivatedDone(true)
        showSuccessToast('Your profile has been set to private')
        queryClient.invalidate(privacyQueryKey)
      } else {
        showErrorToast(result.error ?? 'Could not deactivate profile.')
      }
    } catch {
      showErrorToast('Something went wrong. Please try again.')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <PageHeader
          eyebrow="Preferences & Governance"
          title="Settings"
          description="Manage your account, privacy, notifications, appearance, and network preferences."
        />

        {/* Section Navigation Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ label, description, icon: Icon, href }) => (
            <Link key={label} href={href} className="group">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-[var(--cx-border-2)]">
                <CardContent className="p-0">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-surface-2)] text-[var(--cx-brand-strong)]">
                    <Icon className="size-[18px]" />
                  </div>
                  <h2 className="mt-4 text-sm font-medium">{label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--cx-text-3)]">
                    {description}
                  </p>
                  <span className="mt-4 flex items-center gap-1 text-[10px] font-medium text-[var(--cx-text-3)] group-hover:text-[var(--cx-brand-strong)]">
                    Configure <ChevronRight className="size-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Settings Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. Quick Notification Controls */}
          <Card>
            <CardHeader className="border-b border-[var(--cx-border-1)] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-[var(--cx-brand-strong)]" />
                  <CardTitle className="text-base">Notification Preferences</CardTitle>
                </div>
                <Link href={ROUTES.settingsNotifications}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Control which updates and message alerts land in your inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {notifLoading ? (
                <LoadingState label="Loading notification preferences…" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        New matches &amp; recommendations
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Alerts when someone aligns with your goals.
                      </p>
                    </div>
                    <Switch
                      checked={notifFlags.matches}
                      onCheckedChange={(checked) =>
                        void handleToggleNotif('matches', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Chat DMs &amp; replies
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Alerts when you receive direct messages.
                      </p>
                    </div>
                    <Switch
                      checked={notifFlags.messages}
                      onCheckedChange={(checked) =>
                        void handleToggleNotif('messages', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Event reminders
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Reminders for upcoming hosted gatherings.
                      </p>
                    </div>
                    <Switch
                      checked={notifFlags.reminders}
                      onCheckedChange={(checked) =>
                        void handleToggleNotif('reminders', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Product news &amp; updates
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Monthly summary of new feature releases.
                      </p>
                    </div>
                    <Switch
                      checked={notifFlags.updates}
                      onCheckedChange={(checked) =>
                        void handleToggleNotif('updates', checked)
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Quick Appearance Controls */}
          <Card>
            <CardHeader className="border-b border-[var(--cx-border-1)] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-[var(--cx-brand-strong)]" />
                  <CardTitle className="text-base">Appearance &amp; Theme</CardTitle>
                </div>
                <Link href={ROUTES.settingsAppearance}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Customize theme, color density, and motion preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                <div className="flex items-center gap-2.5">
                  {isDarkMode ? (
                    <Moon className="size-4 text-[var(--cx-brand-strong)] shrink-0" />
                  ) : (
                    <Sun className="size-4 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                      Dark Mode Theme
                    </p>
                    <p className="text-[11px] text-[var(--cx-text-3)]">
                      Switch between dark-first and light mode interface.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={handleToggleDarkMode}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                <div>
                  <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                    Compact View Density
                  </p>
                  <p className="text-[11px] text-[var(--cx-text-3)]">
                    Reduce padding and card spacing for higher screen density.
                  </p>
                </div>
                <Switch
                  checked={Boolean(appearanceFlags.compact)}
                  onCheckedChange={handleToggleCompact}
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Quick Privacy Controls */}
          <Card>
            <CardHeader className="border-b border-[var(--cx-border-1)] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-[var(--cx-brand-strong)]" />
                  <CardTitle className="text-base">Privacy &amp; Visibility</CardTitle>
                </div>
                <StatusDot
                  tone={privacyFlags.public ? 'success' : 'neutral'}
                  label={privacyFlags.public ? 'Public' : 'Private'}
                />
              </div>
              <CardDescription>
                Manage public discoverability and profile permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {privacyLoading ? (
                <LoadingState label="Loading privacy status…" />
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Public Profile Visibility
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Allow people outside your network to find your profile.
                      </p>
                    </div>
                    <Switch
                      checked={privacyFlags.public}
                      onCheckedChange={(checked) =>
                        void handleTogglePrivacy('public', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Online Activity Indicator
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Show active status to verified connections.
                      </p>
                    </div>
                    <Switch
                      checked={privacyFlags.status}
                      onCheckedChange={(checked) =>
                        void handleTogglePrivacy('status', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--cx-surface-2)]">
                    <div>
                      <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                        Accept Connection Requests
                      </p>
                      <p className="text-[11px] text-[var(--cx-text-3)]">
                        Allow incoming connection requests from non-matched profiles.
                      </p>
                    </div>
                    <Switch
                      checked={privacyFlags.requests}
                      onCheckedChange={(checked) =>
                        void handleTogglePrivacy('requests', checked)
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 4. Account Management & Deactivation */}
          <Card>
            <CardHeader className="border-b border-[var(--cx-border-1)] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-[var(--cx-brand-strong)]" />
                  <CardTitle className="text-base">Account Management</CardTitle>
                </div>
                <Link href={ROUTES.settingsAccount}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Account Details
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Pause, deactivate, or manage your account presence.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-xl border border-[var(--cx-danger)]/30 bg-[var(--cx-danger-soft)]/20 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="size-4 text-[var(--cx-danger)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                      Deactivate or Pause Profile
                    </p>
                    <p className="text-[11px] text-[var(--cx-text-3)] mt-0.5">
                      Need a break? Temporarily hide your profile from search, Discover, and matching decks.
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeactivateModalOpen(true)}
                >
                  Deactivate Profile…
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback Section */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="size-4 text-[var(--cx-brand-strong)]" />
              <p className="text-sm font-medium text-[var(--cx-text-1)]">Send product feedback</p>
            </div>
            <p className="mb-4 text-xs leading-5 text-[var(--cx-text-3)]">
              Spotted a bug, miss something, or want a feature? Tell us what would make Connect better for you.
            </p>
            <FeedbackForm context="/dashboard/settings" />
          </CardContent>
        </Card>

        {/* Account Deactivation Modal */}
        <Dialog open={isDeactivateModalOpen} onOpenChange={setIsDeactivateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogClose onClick={() => setIsDeactivateModalOpen(false)} />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[var(--cx-danger)]">
                <AlertTriangle className="size-5" /> Deactivate Your Profile
              </DialogTitle>
              <DialogDescription>
                Deactivating sets your profile to private, hiding it from Discover, search, and new match cards. Your messages and existing connections remain saved.
              </DialogDescription>
            </DialogHeader>

            {deactivatedDone ? (
              <div className="py-6 text-center space-y-3">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--cx-success-soft)] text-[var(--cx-success)]">
                  <Check className="size-6" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--cx-text-1)]">
                  Profile set to private
                </h4>
                <p className="text-xs text-[var(--cx-text-3)]">
                  Your profile is now hidden. You can make it public again anytime from Settings.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDeactivateModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="py-3 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                    Reason for leaving / deactivating
                  </label>
                  <Select
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                  >
                    <option value="taking_break">Taking a break from networking</option>
                    <option value="privacy">Privacy &amp; data concerns</option>
                    <option value="duplicate">Duplicate account</option>
                    <option value="other">Other reason</option>
                  </Select>
                </div>

                <div className="rounded-xl bg-[var(--cx-surface-2)] p-3 text-xs text-[var(--cx-text-3)] leading-relaxed">
                  You can reactivate your public profile at any time with one click from Privacy Settings.
                </div>

                <DialogFooter className="pt-2 border-t border-[var(--cx-border-1)] flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deactivating}
                    onClick={() => setIsDeactivateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deactivating}
                    onClick={() => void handleDeactivateAccount()}
                  >
                    {deactivating ? 'Deactivating…' : 'Confirm Deactivation'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
