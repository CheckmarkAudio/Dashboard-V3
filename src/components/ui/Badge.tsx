import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'gold'
  | 'stage-deliver'
  | 'stage-capture'
  | 'stage-share'
  | 'stage-attract'
  | 'stage-book'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** Optional icon (typically a lucide icon) rendered to the left of the label. */
  icon?: ReactNode
  /** Small pill variant used in dense table rows. */
  size?: 'sm' | 'md'
}

/**
 * Status / stage chip. Uses semantic color tokens so pages never hand-roll
 * status colors. The `stage-*` variants map to the flywheel palette used
 * in KPIDashboard and Pipeline.
 *
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="stage-deliver" icon={<Package size={12} />}>Deliver</Badge>
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral:         'bg-surface-alt text-text-muted',
  success:         'bg-[--color-status-success-bg] text-[--color-status-success-text]',
  warning:         'bg-[--color-status-warning-bg] text-[--color-status-warning-text]',
  danger:          'bg-[--color-status-danger-bg]  text-[--color-status-danger-text]',
  info:            'bg-[--color-status-info-bg]    text-[--color-status-info-text]',
  gold:            'bg-gold/10 text-gold',
  'stage-deliver': 'bg-[--color-stage-deliver-bg] text-[--color-stage-deliver-text]',
  'stage-capture': 'bg-[--color-stage-capture-bg] text-[--color-stage-capture-text]',
  'stage-share':   'bg-[--color-stage-share-bg]   text-[--color-stage-share-text]',
  'stage-attract': 'bg-[--color-stage-attract-bg] text-[--color-stage-attract-text]',
  'stage-book':    'bg-[--color-stage-book-bg]    text-[--color-stage-book-text]',
}

const SIZE_CLASSES: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-medium',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </span>
  )
}

export default Badge
