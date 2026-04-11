import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, disables the button, and preserves its width. */
  loading?: boolean
  /** Icon rendered before the label. Optional. */
  iconLeft?: ReactNode
  /** Icon rendered after the label. Optional. */
  iconRight?: ReactNode
  /** Full-width button (stretch to parent). */
  block?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-black hover:bg-gold-muted disabled:hover:bg-gold',
  secondary:
    'bg-surface-alt text-text border border-border hover:bg-surface-hover disabled:hover:bg-surface-alt',
  ghost:
    'bg-transparent text-text-muted hover:bg-surface-hover hover:text-text disabled:hover:bg-transparent',
  danger:
    'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:hover:bg-red-500/10',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-sm rounded-xl gap-2',
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 16, lg: 18 }

/**
 * Primary button primitive. Consume with:
 *   <Button variant="primary" onClick={save}>Save</Button>
 *   <Button variant="danger" loading={deleting} iconLeft={<Trash2 size={14} />}>Delete</Button>
 *
 * - `loading` disables the button and renders a spinner next to the label.
 * - `iconLeft` / `iconRight` are any ReactNode (usually a lucide icon).
 * - `block` stretches to fill the parent (useful in forms / action rows).
 *
 * The button always gets `focus-ring` for keyboard visibility; pages should
 * never need to add their own focus styling.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    iconLeft,
    iconRight,
    block = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-semibold transition-colors focus-ring',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        block ? 'w-full' : '',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 size={ICON_SIZE[size]} className="animate-spin" aria-hidden="true" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  )
})

export default Button
