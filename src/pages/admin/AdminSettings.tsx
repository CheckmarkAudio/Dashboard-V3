import { useState, type ComponentType, type ChangeEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useQuickKeys } from '../../hooks/useQuickKeys'
import AccountAccessPanel from '../../components/admin/AccountAccessPanel'
import WidgetBank from '../../components/admin/WidgetBank'
import type { LucideProps } from 'lucide-react'
import {
  Save, Loader2, Database, Globe, Bell, Sun, Image as ImageIcon, Keyboard, Shield, LayoutGrid,
} from 'lucide-react'

/**
 * Settings section nav model. Each section renders its own right-pane
 * content via a `key`, and the left sidebar decorates the row with icon +
 * title + subtitle (reference layout — Theme/Branding/Quick Keys etc.).
 */
type SectionKey =
  | 'account-access'
  | 'widgets'
  | 'theme'
  | 'branding'
  | 'quick-keys'
  | 'organization'
  | 'notifications'
  | 'database'

type Section = {
  key: SectionKey
  icon: ComponentType<LucideProps>
  title: string
  subtitle: string
}

const SECTIONS: Section[] = [
  { key: 'account-access', icon: Shield,      title: 'Account Access', subtitle: 'Admin vs employee permissions' },
  { key: 'widgets',        icon: LayoutGrid,  title: 'Widgets',        subtitle: 'Toggle widgets on Overview + Hub' },
  { key: 'theme',          icon: Sun,         title: 'Theme',          subtitle: 'Colors and appearance' },
  { key: 'branding',       icon: ImageIcon,   title: 'Branding',       subtitle: 'Logos and header' },
  { key: 'quick-keys',     icon: Keyboard,    title: 'Quick Keys',     subtitle: 'Keyboard shortcuts' },
  { key: 'organization',   icon: Globe,       title: 'Organization',   subtitle: 'Name and branding' },
  { key: 'notifications',  icon: Bell,        title: 'Notifications',  subtitle: 'Alerts and preferences' },
  { key: 'database',       icon: Database,    title: 'Database',       subtitle: 'Connection and admin' },
]

/**
 * Single row in the left Settings nav. Icon sits in a rounded surface tile so
 * the active state reads as a filled card (matching the reference) rather
 * than a pill — subtitle text carries the "what's here" hint.
 */
function SectionNavItem({
  section,
  active,
  onSelect,
}: {
  section: Section
  active: boolean
  onSelect: () => void
}) {
  const Icon = section.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={[
        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 focus-ring',
        active ? 'bg-surface-alt ring-1 ring-border-light' : 'hover:bg-surface-hover',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-surface',
          active ? 'text-gold' : 'text-text-muted',
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold text-text">{section.title}</span>
        <span className="block text-[12px] text-text-muted truncate">{section.subtitle}</span>
      </span>
    </button>
  )
}

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

export default function AdminSettings() {
  useDocumentTitle('Settings - Checkmark Audio')
  const { profile } = useAuth()
  const [activeSection, setActiveSection] = useState<SectionKey>('account-access')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Organization + notifications state (existing)
  const [orgName, setOrgName] = useState('Checkmark Audio')
  const [orgTagline, setOrgTagline] = useState('Team Management System')
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true)
  const [notifyOnLeadUpdate, setNotifyOnLeadUpdate] = useState(true)
  const [requireDailyNotes, setRequireDailyNotes] = useState(false)

  // Theme state
  const [introVideo, setIntroVideo] = useState(false)
  const [theme, setTheme] = useState<'dark'>('dark')

  // Branding state (UI-only — no backend wiring yet)
  const [logoLight, setLogoLight] = useState<File | null>(null)
  const [logoDark, setLogoDark] = useState<File | null>(null)
  const [headerImage, setHeaderImage] = useState<string | null>(null)
  const [headerOpacity, setHeaderOpacity] = useState(100)
  const [headerFit, setHeaderFit] = useState<'original' | 'cover' | 'contain'>('original')

  // Quick keys
  const { actions, bindings, setBinding, resetDefaults } = useQuickKeys()

  const handleSave = async () => {
    setSaving(true)
    // Settings would be persisted to a settings table in Supabase
    await new Promise(r => setTimeout(r, 500))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleHeaderImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setHeaderImage(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-muted mt-1">Configure your team dashboard</p>
      </div>

      {/* Two-pane layout: left section nav + right content */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* ── Left: section nav ── */}
        <aside className="bg-surface rounded-xl border border-border p-2 space-y-1" aria-label="Settings sections">
          <p className="px-3 pt-3 pb-2 text-label">Settings</p>
          {SECTIONS.map(section => (
            <SectionNavItem
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
                  />
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
                      className="w-full h-full object-cover"
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
            </div>
          )}
        </section>
      </div>

      {/* ── Save bar (global to most sections; hidden on Account Access
            since that panel commits every toggle inline via RPC). ── */}
      {activeSection !== 'account-access' && (
        <div className="flex items-center justify-end gap-3 mt-6">
          {saved && (
            <span className="text-sm text-emerald-400 font-medium" role="status" aria-live="polite">
              Settings saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
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
