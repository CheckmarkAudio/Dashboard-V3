import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drops the default padding so the caller can lay out header/body/footer explicitly. */
  flush?: boolean
  /** Removes the hover shadow effect. Default: hover lift is enabled. */
  flat?: boolean
}

/**
 * Surface card primitive. Wraps content in the dashboard's signature
 * `bg-surface rounded-2xl border border-border` treatment + a subtle hover
 * lift. Use `flush` when a caller wants to control padding itself (e.g. a
 * card split into a header strip and body with different padding). Use
 * `flat` when the hover lift would compete with other interactions on the
 * same row (e.g. a card that has interactive buttons inside it).
 *
 *   <Card>
 *     <p>Plain content with default p-5 padding</p>
 *   </Card>
 *
 *   <Card flush>
 *     <CardHeader>…</CardHeader>
 *     <CardBody>…</CardBody>
 *   </Card>
 */
export function Card({
  flush = false,
  flat = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        'bg-surface border border-border rounded-2xl shadow-sm transition-all duration-200',
        flat ? '' : 'hover:shadow-md hover:border-border-light',
        flush ? '' : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CardPartProps {
  children: ReactNode
  className?: string
}

/** Slot header for a `<Card flush>` — adds standard padding + a bottom border. */
export function CardHeader({ children, className = '' }: CardPartProps) {
  return (
    <div
      className={['px-5 py-4 border-b border-border flex items-center justify-between gap-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

/** Slot body for a `<Card flush>` — standard padding, no border. */
export function CardBody({ children, className = '' }: CardPartProps) {
  return <div className={['p-5', className].filter(Boolean).join(' ')}>{children}</div>
}

/** Slot footer for a `<Card flush>` — top border, right-aligned actions. */
export function CardFooter({ children, className = '' }: CardPartProps) {
  return (
    <div
      className={['px-5 py-3 border-t border-border flex items-center justify-end gap-2', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export default Card
