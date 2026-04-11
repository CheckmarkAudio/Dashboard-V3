import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shape of the skeleton block. */
  shape?: 'text' | 'rect' | 'circle'
  /** Optional explicit width (use when a container doesn't already size it). */
  width?: string | number
  /** Optional explicit height. Defaults to `1rem` for text, `100%` for rect. */
  height?: string | number
}

/**
 * Low-level pulsing placeholder. Prefer the preset components
 * (`CardSkeleton`, `RowSkeleton`, `TableSkeleton`) in pages — use this
 * directly only for bespoke layouts.
 *
 *   <Skeleton shape="text" width="60%" />
 *   <Skeleton shape="circle" width={32} height={32} />
 */
export function Skeleton({
  shape = 'text',
  width,
  height,
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  const shapeClass =
    shape === 'circle' ? 'rounded-full' : shape === 'rect' ? 'rounded-xl' : 'rounded h-4'
  return (
    <div
      aria-hidden="true"
      className={[
        'bg-surface-alt/80 animate-pulse',
        shapeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width,
        height: height ?? (shape === 'rect' ? '100%' : undefined),
        ...style,
      }}
      {...rest}
    />
  )
}

/** Card-shaped skeleton. Use as a drop-in placeholder while a card's contents load. */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'bg-surface border border-border rounded-2xl p-5 space-y-3 animate-pulse',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-alt" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 rounded bg-surface-alt w-1/3" />
          <div className="h-2.5 rounded bg-surface-alt w-1/2" />
        </div>
      </div>
      <div className="h-3 rounded bg-surface-alt w-full" />
      <div className="h-3 rounded bg-surface-alt w-5/6" />
      <div className="h-3 rounded bg-surface-alt w-2/3" />
    </div>
  )
}

/** Row skeleton for list/table views. `columns` controls how many cells render. */
export function RowSkeleton({ columns = 4, className = '' }: { columns?: number; className?: string }) {
  return (
    <div
      className={['flex items-center gap-4 px-4 py-3 animate-pulse', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-surface-alt flex-1"
          style={{ maxWidth: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  )
}

/** Table skeleton — renders `rows` row skeletons inside a bordered container. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div
      className={['bg-surface border border-border rounded-2xl overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={i > 0 ? 'border-t border-border' : ''}>
          <RowSkeleton columns={columns} />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
