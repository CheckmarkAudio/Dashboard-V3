import { useMemo, type CSSProperties } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import {
  ADMIN_WIDGET_DEFINITIONS,
  MEMBER_WIDGET_DEFINITIONS,
} from '../dashboard/widgetRegistry'
import {
  ADMIN_BANK_REGISTRATIONS,
  MEMBER_BANK_REGISTRATIONS,
} from '../../domain/workspaces/registry'
import type {
  WorkspaceScope,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetRegistration,
} from '../../domain/workspaces/types'
import { Check, Eye, EyeOff, LayoutDashboard, UsersRound } from 'lucide-react'

/**
 * WidgetBank — admin Settings tab that lists every widget in the system
 * (Member Overview + Admin Hub) and lets the admin toggle each one on
 * or off for themselves. Also renders a miniature layout preview so
 * admins can see at a glance what each page will look like with their
 * current selections.
 *
 * Scope isolation is enforced upstream: widgets are drawn from the
 * typed MEMBER_WIDGET_DEFINITIONS + ADMIN_WIDGET_DEFINITIONS arrays,
 * which can never cross-pollinate (see domain/workspaces/types.ts).
 */
export default function WidgetBank() {
  const { appRole, profile } = useAuth()
  const userId = profile?.id ?? 'guest'

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-lg font-bold">Widgets</h2>
        <p className="text-[13px] text-text-muted mt-1">
          Toggle widgets on or off for each surface. Drag widgets around on the page itself to reorder them.
        </p>
      </header>

      <ScopeSection
        scope="member_overview"
        title="Member Overview"
        subtitle="The / route every team member lands on."
        icon={LayoutDashboard}
        enabled={MEMBER_WIDGET_DEFINITIONS}
        bank={MEMBER_BANK_REGISTRATIONS}
        role={appRole}
        userId={userId}
      />

      <ScopeSection
        scope="admin_overview"
        title="Admin Hub"
        subtitle="The /admin landing page for owners + admins."
        icon={UsersRound}
        enabled={ADMIN_WIDGET_DEFINITIONS}
        bank={ADMIN_BANK_REGISTRATIONS}
        role={appRole}
        userId={userId}
      />
    </div>
  )
}

function ScopeSection({
  scope,
  title,
  subtitle,
  icon: Icon,
  enabled,
  bank,
  role,
  userId,
}: {
  scope: WorkspaceScope
  title: string
  subtitle: string
  icon: typeof LayoutDashboard
  enabled: WorkspaceWidgetDefinition[]
  // Accept either registration union — this component only reads the
  // generic `id / title / description` fields, so the specific flavor
  // doesn't matter here.
  bank: WorkspaceWidgetRegistration[]
  role: 'owner' | 'admin' | 'member'
  userId: string
}) {
  // Use the same hook the page uses so toggling a widget here reflects
  // instantly when the user navigates to that page.
  const {
    layout,
    toggleWidgetVisibility,
    resetLayout,
  } = useWorkspaceLayout({
    scope,
    role,
    userId,
    definitions: enabled,
  })

  const stateById = useMemo(
    () => new Map(layout.widgets.map((w) => [w.id, w])),
    [layout.widgets],
  )

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/30 flex items-center justify-center text-gold">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text">{title}</h3>
            <p className="text-[12px] text-text-muted mt-0.5">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetLayout}
          className="text-[12px] text-text-light hover:text-gold transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Miniature layout preview — visual sketch of which widgets are on
          the page right now, laid out in the same mixed-span grid. */}
      <LayoutPreview layout={layout} definitions={enabled} />

      {/* On-page widgets */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-text-light font-semibold mb-2">
          On the page
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {enabled.map((def) => {
            const state = stateById.get(def.id)
            const visible = state?.visible ?? true
            return (
              <WidgetRow
                key={def.id}
                title={def.title}
                description={def.description}
                visible={visible}
                onToggle={() => toggleWidgetVisibility(def.id)}
                scope={scope}
              />
            )
          })}
        </div>
      </div>

      {/* Bank — registered widgets NOT on the page today. Listed so
          admins can see what's available without a code change. */}
      {bank.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-text-light font-semibold mb-2">
            Available (not on page)
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {bank.map((reg) => (
              <WidgetRow
                key={reg.id}
                title={reg.title}
                description={reg.description}
                visible={false}
                disabled
                onToggle={() => undefined}
                scope={scope}
              />
            ))}
          </div>
          <p className="text-[10px] text-text-light italic mt-2">
            Available widgets can be enabled by adding them to {scope === 'admin_overview' ? 'ADMIN_WIDGET_REGISTRATIONS' : 'MEMBER_WIDGET_REGISTRATIONS'} in code.
          </p>
        </div>
      )}

      {/* Hidden catch — enabled widgets the user has toggled off that
          aren't in the main list view by visibility */}
      {enabled.some((d) => stateById.get(d.id)?.visible === false) && (
        <p className="text-[10px] text-text-light italic">
          Hidden widgets stay registered — use the Show toggle above to bring any back.
        </p>
      )}

    </section>
  )
}

function WidgetRow({
  title,
  description,
  visible,
  disabled,
  onToggle,
  scope,
}: {
  title: string
  description: string
  visible: boolean
  disabled?: boolean
  onToggle: () => void
  scope: WorkspaceScope
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left border transition-all ${
        disabled
          ? 'bg-surface-alt/40 border-border/60 opacity-60 cursor-default'
          : visible
            ? 'bg-gold/5 border-gold/30 hover:bg-gold/10'
            : 'bg-surface-alt/60 border-border hover:border-border-light'
      }`}
    >
      <div
        className={`shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center ${
          visible && !disabled
            ? 'bg-gold/15 text-gold ring-1 ring-gold/40'
            : 'bg-surface text-text-light ring-1 ring-border'
        }`}
      >
        {visible && !disabled ? <Check size={13} /> : <EyeOff size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text truncate">{title}</p>
        <p className="text-[11px] text-text-light leading-snug truncate">{description}</p>
      </div>
      {!disabled && (
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${
          visible ? 'text-gold' : 'text-text-light'
        }`}>
          {visible ? 'On' : 'Off'}
        </span>
      )}
      {disabled && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-light">
          Bank
        </span>
      )}
      {/* Keep scope in the DOM for debug/a11y but hidden */}
      <span aria-hidden="true" className="sr-only">{scope}</span>
    </button>
  )
}

// ─── Mini preview ───────────────────────────────────────────────────
//
// A scaled-down sketch of the widget grid so the admin can see the
// shape of each page from Settings. Uses the same span/rowSpan data as
// the real grid, drawn as colored rectangles with titles inside.

function LayoutPreview({
  layout,
  definitions,
}: {
  layout: { widgets: Array<{ id: string; order: number; visible: boolean; span: number; rowSpan?: number }> }
  definitions: WorkspaceWidgetDefinition[]
}) {
  const defById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions])
  const visible = layout.widgets
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((w) => w.visible)

  if (visible.length === 0) {
    return (
      <div className="rounded-lg bg-surface-alt/40 border border-dashed border-border p-6 text-center">
        <p className="text-[12px] text-text-light italic">No widgets enabled — the page will be empty.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-surface-alt/30 border border-border p-3">
      <div
        className="grid grid-cols-3 gap-1.5 auto-rows-min"
        aria-label="Layout preview"
      >
        {visible.map((w) => {
          const def = defById.get(w.id as never)
          const style: CSSProperties = {
            gridColumn: `span ${w.span}`,
            gridRow: (w.rowSpan ?? 1) > 1 ? `span ${w.rowSpan}` : undefined,
            minHeight: `${30 * (w.rowSpan ?? 1)}px`,
          }
          return (
            <div
              key={w.id}
              style={style}
              className="rounded-md bg-gold/10 ring-1 ring-gold/30 flex items-center justify-center px-2 py-1"
            >
              <p className="text-[10px] font-semibold text-gold truncate">{def?.title ?? w.id}</p>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-text-light">
        <Eye size={10} />
        <span>Preview reflects your current show/hide choices. Drag on the page to reorder.</span>
      </div>
    </div>
  )
}
