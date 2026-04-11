import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

interface EmptyStateProps {
  /** Lucide icon component (not an element — we render it with our own size). */
  icon?: ComponentType<LucideProps>
  title: string
  description?: ReactNode
  /** Call-to-action rendered below the description. Usually a <Button>. */
  action?: ReactNode
  /** Optional extra class on the wrapper (e.g. `my-12`). */
  className?: string
}

/**
 * Consistent empty-state placeholder. Every list page should render one of
 * these when `items.length === 0`. Keeps tone on-brand and always guides
 * the user toward a next action.
 *
 *   <EmptyState
 *     icon={Users}
 *     title="No team members yet"
 *     description="Start by inviting your first teammate."
 *     action={<Button variant="primary" onClick={openAdd}>Add member</Button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'bg-surface rounded-2xl border border-border p-10 text-center animate-fade-in',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div
          className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4"
          aria-hidden="true"
        >
          <Icon size={24} className="text-gold" />
        </div>
      )}
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted mb-4 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="inline-flex items-center justify-center">{action}</div>}
    </div>
  )
}

export default EmptyState
