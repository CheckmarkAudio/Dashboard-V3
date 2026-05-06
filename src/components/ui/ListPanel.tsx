import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The "nested inset list panel" pattern from the UI skin direction
 * mockup (docs/mockups/checkmark-ui-skin-direction.html). A single
 * bordered card holding a header row and a stack of list rows
 * separated by needle-thin dividers — NOT cards inside cards.
 *
 * Three pieces:
 *
 *   <ListPanel title="Operational queue" subtitle="Focused rows…">
 *     <ListRow
 *       icon={<span className="icon-tile-gold w-8 h-8"><Music size={14} className="text-gold" /></span>}
 *       title="Mix prep for Luna session"
 *       meta="Deliver · due today"
 *       right={<Badge variant="neutral" size="sm">High</Badge>}
 *     />
 *     <ListRow … />
 *   </ListPanel>
 *
 * Inside a `DashboardWidgetFrame` the outer card is already provided,
 * so the widget body should use `<ListRows>` directly (skip the outer
 * `.list-panel` to avoid card-in-card):
 *
 *   <ListRows>
 *     <ListRow … />
 *     <ListRow … />
 *   </ListRows>
 *
 * All visual styling lives in `src/index.css` under `.list-panel*` so
 * any page or one-off can hand-roll the markup if it needs custom
 * row content while still matching site-wide rhythm.
 */

interface ListPanelProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned slot in the header (e.g., a status pill). */
  rightHeader?: ReactNode
  /** Row children. Use `<ListRow>` for the standard layout. */
  children: ReactNode
  className?: string
}

export function ListPanel({
  title,
  // `subtitle` intentionally omitted from destructure — sitewide
  // subtitle suppression (skin pass 2026-05-06). Prop stays on the
  // type so existing callsites (and the converted retrofits) keep
  // type-checking even though the rendered output skips it.
  rightHeader,
  children,
  className,
}: ListPanelProps) {
  return (
    <section className={['list-panel', className].filter(Boolean).join(' ')}>
      <header className="list-panel__head">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight text-text leading-tight">
            {title}
          </h3>
          {/* Skin pass 2026-05-06 — subtitle suppressed sitewide.
              List panels carry a single bold title and no decorative
              explanatory copy underneath. Prop kept on the type so a
              specific panel can opt back in later (will need a
              `forceSubtitle` flag here when that happens). */}
        </div>
        {rightHeader && <div className="shrink-0">{rightHeader}</div>}
      </header>
      <div className="list-panel__rows">{children}</div>
    </section>
  )
}

/**
 * Bare row container — use inside a `DashboardWidgetFrame` (or any
 * surface that already provides the outer card) so the dividers
 * apply without doubling the chrome.
 */
export function ListRows({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={['list-panel__rows', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

interface ListRowProps {
  /** Pre-built icon (typically `<span className="icon-tile-gold w-8 h-8">…</span>`). */
  icon?: ReactNode
  title: ReactNode
  /** Secondary metadata under the title (one line, will truncate). */
  meta?: ReactNode
  /** Right-aligned slot — usually a `<Badge>` status pill. */
  right?: ReactNode
  /**
   * If provided, the row becomes a real `<button>` (or `<Link>` if
   * `to` is set) with hover + focus state. Otherwise renders as a
   * plain `<div>`.
   */
  onClick?: () => void
  /** If provided, the row renders as a router `<Link to={to}>`. */
  to?: string
  /** Extra class on the row itself. */
  className?: string
  /** Optional accessible label for icon-only / sparse rows. */
  ariaLabel?: string
}

export function ListRow({
  icon,
  title,
  meta,
  right,
  onClick,
  to,
  className,
  ariaLabel,
}: ListRowProps) {
  const interactive = !!(onClick || to)
  const classes = [
    'list-row',
    interactive && 'list-row--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      {icon && <div>{icon}</div>}
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-text leading-tight truncate">
          {title}
        </p>
        {meta && (
          <p className="mt-0.5 text-[11px] text-text-muted leading-snug truncate">
            {meta}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        {inner}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classes}
        aria-label={ariaLabel}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={classes} aria-label={ariaLabel}>
      {inner}
    </div>
  )
}

export default ListPanel
