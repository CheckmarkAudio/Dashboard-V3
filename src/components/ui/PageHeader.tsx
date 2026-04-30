import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

interface PageHeaderProps {
  /** Main title (h1). Keep it short — this renders as text-title. */
  title: ReactNode
  /** Optional subtitle. One-line explanation of what the page is for. */
  subtitle?: ReactNode
  /** Optional leading icon, rendered as a gold-framed square chip. */
  icon?: ComponentType<LucideProps>
  /** Right-aligned actions (usually one or two Buttons). */
  actions?: ReactNode
  /** Extra content below the title row (filters, tabs, etc.). */
  children?: ReactNode
  /** Optional extra wrapper className. */
  className?: string
}

/**
 * Standard page-level header. Gives every screen the same rhythm — icon,
 * title, subtitle, actions — without copy-pasting layout per page.
 *
 *   <PageHeader
 *     icon={Users}
 *     title="Team Manager"
 *     subtitle="Add, edit, and organize your team."
 *     actions={<Button variant="primary" iconLeft={<UserPlus size={14} />}>Add member</Button>}
 *   />
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      {/* PR #72 — outer flex switched to `items-center` so the action
          button vertically centers with the title block. Was
          `items-start` which top-aligned the action with the icon
          chip and the action visually drifted up-right ("floating
          away" per user). */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-alt border border-border shrink-0"
              aria-hidden="true"
            >
              <Icon className="h-5 w-5 text-gold" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-title truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export default PageHeader
