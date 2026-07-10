import { useEffect, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useQuickKeys } from '../../hooks/useQuickKeys'
import { useToast } from '../../components/Toast'
import AccountAccessPanel from '../../components/admin/AccountAccessPanel'
import WidgetBank from '../../components/admin/WidgetBank'
import { AdminSectionNavItem, type AdminSection } from '../../components/admin/AdminSectionNavItem'
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarStatus,
  pullInboundGoogleCalendarChanges,
  pushPendingGoogleCalendarBookings,
  startGoogleCalendarConnect,
  type GoogleCalendarConnectionStatus,
} from '../../lib/googleCalendar'
import {
  Save, Loader2, Database, Globe, Bell, Sun, Image as ImageIcon, Keyboard, Shield, LayoutGrid, Clock, MessageSquareText, Archive,
  Trash2,
} from 'lucide-react'
import StudioHoursPanel from '../../components/admin/StudioHoursPanel'
import FeedbackReportsPanel from '../../components/admin/FeedbackReportsPanel'
import ArchivedMembersPanel from '../../components/admin/ArchivedMembersPanel'
import {
  fetchTeamSiteBranding,
  removeTeamSiteBanner,
  teamSiteBrandingKeys,
  updateTeamSiteBranding,
  uploadTeamSiteBanner,
  type SiteBannerFit,
  type TeamSiteBranding,
} from '../../lib/queries/teamSiteBranding'

/**
 * Settings section nav model. Each section renders its own right-pane
 * content via a `key`, and the left sidebar decorates the row with icon +
 * title + subtitle (reference layout — Theme/Branding/Quick Keys etc.).
 */
type SectionKey =
  | 'account-access'
  | 'archive'
  | 'widgets'
  | 'theme'
  | 'branding'
  | 'quick-keys'
  | 'studio-hours'
  | 'organization'
  | 'notifications'
  | 'feedback'
  | 'database'

type Section = AdminSection<SectionKey>

const SECTIONS: Section[] = [
  { key: 'account-access', icon: Shield,      title: 'Account Access', subtitle: 'Admin vs employee permissions' },
  { key: 'archive',        icon: Archive,     title: 'Archive',        subtitle: 'Restore or delete removed members' },
  { key: 'widgets',        icon: LayoutGrid,  title: 'Widgets',        subtitle: 'Toggle widgets on Overview + Hub' },
  { key: 'theme',          icon: Sun,         title: 'Theme',          subtitle: 'Colors and appearance' },
  { key: 'branding',       icon: ImageIcon,   title: 'Branding',       subtitle: 'Logos and header' },
  { key: 'quick-keys',     icon: Keyboard,    title: 'Quick Keys',     subtitle: 'Keyboard shortcuts' },
  // 2026-05-23 — Studio hours of operation editor. Drives the gold
  // band on /calendar (when the studio is open for business).
  { key: 'studio-hours',   icon: Clock,       title: 'Studio Hours',   subtitle: 'When the studio is open' },
  { key: 'organization',   icon: Globe,       title: 'Organization',   subtitle: 'Name and branding' },
  { key: 'notifications',  icon: Bell,        title: 'Notifications',  subtitle: 'Alerts and preferences' },
  { key: 'feedback',       icon: MessageSquareText, title: 'Feedback',   subtitle: 'Reports from the Feedback button' },
  { key: 'database',       icon: Database,    title: 'Database',       subtitle: 'Connection and admin' },
]

/**
 * Keycap-style input used in the Quick Keys section. Displays the currently
 * bound single character and accepts one keystroke to rebind. Empty string
 * means "unassigned" and the input shows a thin dash instead.
 */
function KeyCapInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  return (
    <input
      type="text"
      value={value.toUpperCase()}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      aria-label={ariaLabel}
      maxLength={1}
      spellCheck={false}
      autoCapitalize="characters"
      className="w-14 h-14 rounded-lg border border-border bg-surface text-text text-lg font-bold text-center focus:border-gold outline-none"
    />
  )
}

function isGoogleTokenRevoked(message: string | null | undefined): boolean {
  const lower = (message ?? '').toLowerCase()
  return lower.includes('expired or revoked') || lower.includes('invalid_grant')
}

export default function AdminSettings() {
  useDocumentTitle('Settings - Checkmark Workspace')
  const { profile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState<SectionKey>('account-access')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Organization + notifications state (existing)
  const [orgName, setOrgName] = useState('Checkmark Workspace')
  const [orgTagline, setOrgTagline] = useState('Team Management System')
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true)
  const [notifyOnLeadUpdate, setNotifyOnLeadUpdate] = useState(true)
  const [requireDailyNotes, setRequireDailyNotes] = useState(false)

  // Theme state
  const [introVideo, setIntroVideo] = useState(false)
  const [theme, setTheme] = useState<'dark'>('dark')

  // Branding state. The header image is persisted as a team-wide
  // banner and rendered by the global Layout header for every member.
  const [logoLight, setLogoLight] = useState<File | null>(null)
  const [logoDark, setLogoDark] = useState<File | null>(null)
  const [headerImage, setHeaderImage] = useState<string | null>(null)
  const [headerOpacity, setHeaderOpacity] = useState(100)
  const [headerFit, setHeaderFit] = useState<SiteBannerFit>('cover')
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(true)
  const [googleCalendarConnecting, setGoogleCalendarConnecting] = useState(false)
  const [googleCalendarDisconnecting, setGoogleCalendarDisconnecting] = useState(false)
  const [googleCalendarPulling, setGoogleCalendarPulling] = useState(false)
  const [googleCalendarPushing, setGoogleCalendarPushing] = useState(false)
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarConnectionStatus | null>(null)

  // Quick keys
  const { actions, bindings, setBinding, resetDefaults } = useQuickKeys()
  const siteBrandingQuery = useQuery({
    queryKey: teamSiteBrandingKeys.current(),
    queryFn: fetchTeamSiteBranding,
    enabled: Boolean(profile?.id),
    staleTime: 5 * 60_000,
  })
  const updateBrandingMutation = useMutation({
    mutationFn: updateTeamSiteBranding,
    onSuccess: (branding) => {
      queryClient.setQueryData(teamSiteBrandingKeys.current(), branding)
      void queryClient.invalidateQueries({ queryKey: teamSiteBrandingKeys.all })
    },
  })

  useEffect(() => {
    const branding = siteBrandingQuery.data
    if (!branding) return
    setHeaderImage(branding.site_banner_url)
    setHeaderFit(branding.site_banner_fit)
    setHeaderOpacity(branding.site_banner_opacity)
  }, [siteBrandingQuery.data])

  const loadGoogleCalendar = async () => {
    setGoogleCalendarLoading(true)
    try {
      const status = await fetchGoogleCalendarStatus()
      setGoogleCalendarStatus(status.connection)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setGoogleCalendarLoading(false)
    }
  }

  useEffect(() => {
    void loadGoogleCalendar()
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    const connected = url.searchParams.get('google_calendar')
    const error = url.searchParams.get('google_calendar_error')
    if (!connected && !error) return

    if (connected === 'connected') {
      toast('Google Calendar connected.', 'success')
      void loadGoogleCalendar()
    }
    if (error) {
      toast(`Google Calendar connect failed: ${error}`, 'error')
    }

    url.searchParams.delete('google_calendar')
    url.searchParams.delete('google_calendar_error')
    window.history.replaceState({}, '', url.toString())
  }, [])

  const handleConnectGoogleCalendar = async () => {
    setGoogleCalendarConnecting(true)
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}admin/settings`
      const authUrl = await startGoogleCalendarConnect(redirectTo)
      window.location.assign(authUrl)
    } catch (err) {
      toast((err as Error).message, 'error')
      setGoogleCalendarConnecting(false)
    }
  }

  const handleDisconnectGoogleCalendar = async () => {
    setGoogleCalendarDisconnecting(true)
    try {
      await disconnectGoogleCalendar()
      setGoogleCalendarStatus(null)
      toast('Google Calendar disconnected.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setGoogleCalendarDisconnecting(false)
    }
  }

  const handlePullInboundGoogleCalendar = async () => {
    setGoogleCalendarPulling(true)
    try {
      const result = await pullInboundGoogleCalendarChanges()
      const summary = result.summary
      toast(
        `Inbound sync complete: ${summary.updated_count} updated, ${summary.cancelled_count} cancelled, ${summary.unchanged_count} unchanged, ${summary.skipped_count} skipped.`,
        'success',
      )
      await loadGoogleCalendar()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setGoogleCalendarPulling(false)
    }
  }

  const handlePushPendingGoogleCalendar = async () => {
    if (isGoogleTokenRevoked(googleCalendarStatus?.last_sync_error)) {
      toast('Reconnect Google Calendar first, then push pending bookings.', 'error')
      return
    }
    setGoogleCalendarPushing(true)
    try {
      const result = await pushPendingGoogleCalendarBookings()
      const summary = result.summary
      const toastType = summary.failed_count > 0 ? 'error' : 'success'
      toast(
        `Outbound sync complete: ${summary.synced_count} pushed, ${summary.failed_count} failed, ${summary.skipped_count} skipped.`,
        toastType,
      )
      await loadGoogleCalendar()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setGoogleCalendarPushing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeSection === 'branding') {
        await updateBrandingMutation.mutateAsync({
          site_banner_url: headerImage,
          site_banner_fit: headerFit,
          site_banner_opacity: headerOpacity,
        })
      } else {
        // Remaining settings sections still keep their existing local-save
        // behavior until their persistence tables are wired.
        await new Promise(r => setTimeout(r, 500))
      }
      setSaved(true)
      toast('Settings saved.', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleHeaderImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingHeader(true)
    try {
      const publicUrl = await uploadTeamSiteBanner(file, headerImage)
      const next: TeamSiteBranding = {
        site_banner_url: publicUrl,
        site_banner_fit: headerFit,
        site_banner_opacity: headerOpacity,
      }
      const savedBranding = await updateBrandingMutation.mutateAsync(next)
      setHeaderImage(savedBranding.site_banner_url)
      setHeaderFit(savedBranding.site_banner_fit)
      setHeaderOpacity(savedBranding.site_banner_opacity)
      setSaved(true)
      toast('Header banner uploaded.', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Header upload failed', 'error')
    } finally {
      setUploadingHeader(false)
    }
  }

  const handleRemoveHeaderImage = async () => {
    setSaving(true)
    try {
      await removeTeamSiteBanner(headerImage)
      const savedBranding = await updateBrandingMutation.mutateAsync({
        site_banner_url: null,
        site_banner_fit: headerFit,
        site_banner_opacity: headerOpacity,
      })
      setHeaderImage(savedBranding.site_banner_url)
      setSaved(true)
      toast('Header banner removed.', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove header banner', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Two-pane layout: left section nav + right content */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* ── Left: section nav ── */}
        <aside className="bg-surface rounded-xl border border-border p-2 space-y-1" aria-label="Settings sections">
          <p className="px-3 pt-3 pb-2 text-label">Settings</p>
          {SECTIONS.map(section => (
            <AdminSectionNavItem
              key={section.key}
              section={section}
              active={activeSection === section.key}
              onSelect={() => setActiveSection(section.key)}
            />
          ))}
        </aside>

        {/* ── Right: active section content ── */}
        <section className="bg-surface rounded-xl border border-border p-6 min-h-[320px]">
          {activeSection === 'account-access' && <AccountAccessPanel />}
          {activeSection === 'archive' && <ArchivedMembersPanel />}
          {activeSection === 'feedback' && <FeedbackReportsPanel />}
          {activeSection === 'widgets' && <WidgetBank />}

          {activeSection === 'theme' && (
            <div className="space-y-6">
              <header>
                <h2 className="text-lg font-bold">Theme</h2>
              </header>

              {/* Intro Video on Startup */}
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold text-text">Intro Video on Startup</p>
                  <p className="text-[13px] text-text-muted mt-1">Shows the brand intro each time the app opens.</p>
                </div>
                <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={introVideo}
                    onChange={e => setIntroVideo(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                    aria-label="Intro Video on Startup"
                  />
                  <span className="text-sm text-text-muted w-8">{introVideo ? 'On' : 'Off'}</span>
                </label>
              </div>

              {/* Theme dropdown */}
              <div>
                <label htmlFor="admin-settings-theme" className="block text-sm font-semibold text-text mb-2">Theme</label>
                <select
                  id="admin-settings-theme"
                  value={theme}
                  onChange={e => setTheme(e.target.value as 'dark')}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-alt text-sm"
                >
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === 'branding' && (
            <div className="space-y-6">
              <header>
                <h2 className="text-lg font-bold">Branding</h2>
              </header>

              {/* Logo pair */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-settings-logo-light" className="block text-sm font-semibold text-text mb-2">Logo (Light)</label>
                  <div className="p-3 rounded-lg border border-border bg-surface-alt">
                    <input
                      id="admin-settings-logo-light"
                      type="file"
                      accept="image/*"
                      onChange={e => setLogoLight(e.target.files?.[0] ?? null)}
                      className="text-sm text-text-muted"
                    />
                    {logoLight && <p className="text-xs text-text-muted mt-2 truncate">{logoLight.name}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="admin-settings-logo-dark" className="block text-sm font-semibold text-text mb-2">Logo (Dark)</label>
                  <div className="p-3 rounded-lg border border-border bg-surface-alt">
                    <input
                      id="admin-settings-logo-dark"
                      type="file"
                      accept="image/*"
                      onChange={e => setLogoDark(e.target.files?.[0] ?? null)}
                      className="text-sm text-text-muted"
                    />
                    {logoDark && <p className="text-xs text-text-muted mt-2 truncate">{logoDark.name}</p>}
                  </div>
                </div>
              </div>

              {/* Custom Header Image */}
              <div>
                <label htmlFor="admin-settings-header-image" className="block text-sm font-semibold text-text mb-2">
                  Custom Header Image <span className="text-text-muted font-normal">(Optional)</span>
                </label>
                <div className="p-3 rounded-lg border border-border bg-surface-alt">
                  <input
                    id="admin-settings-header-image"
                    type="file"
                    accept="image/*"
                    onChange={handleHeaderImageChange}
                    className="text-sm text-text-muted"
                    disabled={uploadingHeader}
                  />
                  {uploadingHeader && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gold font-semibold mt-2">
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      Uploading banner…
                    </span>
                  )}
                </div>
              </div>

              {/* Header image preview + opacity */}
              {headerImage && (
                <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="aspect-[16/6] w-full overflow-hidden rounded-lg border border-border bg-surface-alt">
                    <img
                      src={headerImage}
                      alt="Header preview"
                      style={{ opacity: headerOpacity / 100 }}
                      className={[
                        'w-full h-full',
                        headerFit === 'contain' ? 'object-contain' : headerFit === 'original' ? 'object-none object-center' : 'object-cover',
                      ].join(' ')}
                    />
                  </div>
                  <div className="w-20 flex flex-col items-center gap-2">
                    <span className="text-[11px] font-semibold text-text uppercase tracking-wider">Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={headerOpacity}
                      onChange={e => setHeaderOpacity(Number(e.target.value))}
                      aria-label="Header image opacity"
                      className="w-full accent-gold"
                    />
                    <span className="text-xs text-text-muted tabular-nums">{headerOpacity}%</span>
                  </div>
                </div>
              )}

              {/* Header Image Fit */}
              <div>
                <label htmlFor="admin-settings-header-fit" className="block text-sm font-semibold text-text mb-2">Header Image Fit</label>
                <select
                  id="admin-settings-header-fit"
                  value={headerFit}
                  onChange={e => setHeaderFit(e.target.value as typeof headerFit)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-alt text-sm"
                >
                  <option value="original">None (Original)</option>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </div>

              {headerImage && (
                <button
                  type="button"
                  onClick={() => void handleRemoveHeaderImage()}
                  disabled={saving || uploadingHeader}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50 focus-ring"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove Header Banner
                </button>
              )}
            </div>
          )}

          {activeSection === 'quick-keys' && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold">Quick Keys</h2>
                <p className="text-[13px] text-text-muted mt-1">
                  Set a single character per action. Leave blank to clear a shortcut.
                </p>
              </header>

              <div className="space-y-2">
                {actions.map(action => {
                  const current = bindings[action.id] ?? ''
                  return (
                    <div
                      key={action.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-surface-hover"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text">{action.label}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Current: <span className="font-mono">{current ? current.toUpperCase() : '—'}</span>
                        </p>
                      </div>
                      <KeyCapInput
                        value={current}
                        onChange={next => setBinding(action.id, next)}
                        ariaLabel={`Shortcut key for ${action.label}`}
                      />
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={resetDefaults}
                className="w-full py-3 rounded-lg border border-border hover:bg-surface-hover text-sm font-semibold text-text transition-colors focus-ring"
              >
                Reset to defaults
              </button>
            </div>
          )}

          {/* 2026-05-23 — Studio Hours editor. Drives the gold/8%
              in-hours band on /calendar. Edits flow live to the
              calendar via the useStudioHours realtime sub. */}
          {activeSection === 'studio-hours' && <StudioHoursPanel adminId={profile?.id ?? ''} />}

          {activeSection === 'organization' && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold">Organization</h2>
                <p className="text-[13px] text-text-muted mt-0.5">Your team's name and public-facing tagline.</p>
              </header>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-settings-org-name" className="block text-sm font-medium mb-1.5">Organization Name</label>
                  <input
                    id="admin-settings-org-name"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="admin-settings-org-tagline" className="block text-sm font-medium mb-1.5">Tagline</label>
                  <input
                    id="admin-settings-org-tagline"
                    value={orgTagline}
                    onChange={e => setOrgTagline(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold">Notifications</h2>
                <p className="text-[13px] text-text-muted mt-0.5">Control when and how the dashboard alerts the team.</p>
              </header>
              <div className="space-y-3">
                <label htmlFor="admin-settings-notify-daily-notes" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-hover cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Daily note submissions</p>
                    <p className="text-xs text-text-muted">Get notified when team members submit daily notes</p>
                  </div>
                  <input
                    id="admin-settings-notify-daily-notes"
                    type="checkbox"
                    checked={notifyOnSubmission}
                    onChange={e => setNotifyOnSubmission(e.target.checked)}
                    className="rounded border-border"
                  />
                </label>
                <label htmlFor="admin-settings-notify-lead-updates" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-hover cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Lead updates</p>
                    <p className="text-xs text-text-muted">Get notified when leads change status</p>
                  </div>
                  <input
                    id="admin-settings-notify-lead-updates"
                    type="checkbox"
                    checked={notifyOnLeadUpdate}
                    onChange={e => setNotifyOnLeadUpdate(e.target.checked)}
                    className="rounded border-border"
                  />
                </label>
                <label htmlFor="admin-settings-require-daily-notes" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-hover cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Require daily notes</p>
                    <p className="text-xs text-text-muted">Team members must submit daily notes before end of day</p>
                  </div>
                  <input
                    id="admin-settings-require-daily-notes"
                    type="checkbox"
                    checked={requireDailyNotes}
                    onChange={e => setRequireDailyNotes(e.target.checked)}
                    className="rounded border-border"
                  />
                </label>
              </div>
            </div>
          )}

          {activeSection === 'database' && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold">Database</h2>
                <p className="text-[13px] text-text-muted mt-0.5">Read-only view of the connected Supabase project.</p>
              </header>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-alt">
                  <span className="text-text-muted">Supabase Project</span>
                  <code className="text-xs bg-surface px-2 py-1 rounded border border-border">ncljfjdcyswoeitsooty</code>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-alt">
                  <span className="text-text-muted">Admin User</span>
                  <span className="font-medium">{profile?.email}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text">Google Calendar Sync</h3>
                    <p className="text-xs text-text-muted mt-1">
                      Phase 1 sync pushes Checkmark bookings to the connected Google account, which Apple Calendar then mirrors.
                    </p>
                  </div>
                  {googleCalendarLoading && <Loader2 size={16} className="animate-spin text-text-muted shrink-0" />}
                </div>

                {googleCalendarStatus ? (
                  <div className="space-y-2">
                    {(() => {
                      const hasTokenError = isGoogleTokenRevoked(googleCalendarStatus.last_sync_error)
                      return hasTokenError ? (
                        <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs text-amber-100 space-y-2">
                          <p className="font-semibold text-amber-100">Google Calendar needs reconnecting.</p>
                          <p>
                            The saved Google token expired or was revoked. Reconnect first, then push pending bookings.
                          </p>
                        </div>
                      ) : null
                    })()}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-alt">
                      <span className="text-text-muted">Connected account</span>
                      <span className="font-medium">{googleCalendarStatus.google_email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-alt">
                      <span className="text-text-muted">Calendar target</span>
                      <code className="text-xs bg-surface px-2 py-1 rounded border border-border">
                        {googleCalendarStatus.calendar_id}
                      </code>
                    </div>
                    <div className="p-3 rounded-lg border border-sky-400/20 bg-sky-500/8 text-xs text-text-muted space-y-1">
                      <p className="font-medium text-text">Phase 2 beta: inbound sync for already-linked events</p>
                      <p>
                        Pull Google/Apple edits into existing Checkmark bookings manually. This does not auto-import brand-new external events and does not hard-delete bookings.
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-surface-alt text-xs">
                        <p className="text-text-muted">Last inbound sync</p>
                        <p className="mt-1 font-medium text-text">
                          {googleCalendarStatus.inbound_last_synced_at
                            ? new Date(googleCalendarStatus.inbound_last_synced_at).toLocaleString()
                            : 'Not run yet'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-alt text-xs">
                        <p className="text-text-muted">Last inbound summary</p>
                        <p className="mt-1 font-medium text-text">
                          {googleCalendarStatus.inbound_last_sync_summary
                            ? `${googleCalendarStatus.inbound_last_sync_summary.updated_count ?? 0} updated · ${googleCalendarStatus.inbound_last_sync_summary.cancelled_count ?? 0} cancelled`
                            : 'No runs yet'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-alt text-xs">
                        <p className="text-text-muted">Pending outbound bookings</p>
                        <p className="mt-1 font-medium text-text">
                          {googleCalendarStatus.outbound_pending_count ?? 0}
                        </p>
                      </div>
                    </div>
                    {googleCalendarStatus.outbound_last_error && (
                      <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs text-amber-200">
                        Last outbound sync error: {googleCalendarStatus.outbound_last_error}
                      </div>
                    )}
                    {googleCalendarStatus.inbound_last_sync_error && (
                      <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs text-amber-200">
                        Last inbound sync error: {googleCalendarStatus.inbound_last_sync_error}
                      </div>
                    )}
                    {googleCalendarStatus.last_sync_error && (
                      <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs text-amber-200">
                        Last sync error: {googleCalendarStatus.last_sync_error}
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {isGoogleTokenRevoked(googleCalendarStatus.last_sync_error) && (
                        <button
                          type="button"
                          onClick={handleConnectGoogleCalendar}
                          disabled={googleCalendarConnecting}
                          className="px-4 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50"
                        >
                          {googleCalendarConnecting ? 'Reconnecting…' : 'Reconnect Google Calendar'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handlePushPendingGoogleCalendar}
                        disabled={googleCalendarPushing || isGoogleTokenRevoked(googleCalendarStatus.last_sync_error)}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"
                      >
                        {googleCalendarPushing ? 'Pushing…' : 'Push pending bookings'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePullInboundGoogleCalendar}
                        disabled={googleCalendarPulling || isGoogleTokenRevoked(googleCalendarStatus.last_sync_error)}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"
                      >
                        {googleCalendarPulling ? 'Pulling…' : 'Pull inbound changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleCalendar}
                        disabled={googleCalendarDisconnecting}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"
                      >
                        {googleCalendarDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-text-muted">
                      No Google Calendar connection yet. Connect `checkmarkaudio@gmail.com` to let Checkmark drive Google and Apple Calendar from one place.
                    </p>
                    <div className="p-3 rounded-lg border border-border bg-surface-alt text-xs text-text-muted">
                      During Phase 1, Checkmark should stay the source of truth. Bookings created directly in Apple Calendar will not flow back into Checkmark until Phase 2 is added.
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleConnectGoogleCalendar}
                        disabled={googleCalendarConnecting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50"
                      >
                        {googleCalendarConnecting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            Connecting…
                          </>
                        ) : (
                          'Connect Google Calendar'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Save bar (global to most sections; hidden on panels that
            commit inline: Account Access, Archive, Feedback). ── */}
      {activeSection !== 'account-access' && activeSection !== 'archive' && activeSection !== 'feedback' && (
        <div className="flex items-center justify-end gap-3 mt-6">
          {saved && (
            <span className="text-sm text-emerald-400 font-medium" role="status" aria-live="polite">
              Settings saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploadingHeader}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold hover:bg-gold-muted text-black font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            Save Settings
          </button>
        </div>
      )}
    </div>
  )
}
