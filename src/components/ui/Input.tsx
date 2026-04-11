import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode
  /** Helper text rendered below the field when there's no error. */
  hint?: ReactNode
  /** Error message. When present the field is marked aria-invalid and the hint is hidden. */
  error?: string | null
  /** Icon rendered on the left side of the input (inline with placeholder). */
  iconLeft?: ReactNode
  /** Optional action rendered on the right side (e.g. eye icon, clear button). */
  actionRight?: ReactNode
  /** Mark the label with a required asterisk. */
  required?: boolean
  /** Optional wrapper className for layout (e.g. grid cells). */
  wrapperClassName?: string
}

/**
 * Accessible text input with built-in label, hint, and error state. All
 * forms in the app should prefer this over raw `<input>` so we get
 * consistent focus, validation feedback, and aria-invalid handling for free.
 *
 *   <Input
 *     label="Email"
 *     type="email"
 *     required
 *     value={email}
 *     onChange={e => setEmail(e.target.value)}
 *     error={emailError}
 *     hint="We'll normalize to lowercase on save."
 *   />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    iconLeft,
    actionRight,
    required,
    wrapperClassName = '',
    className = '',
    id,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? `input-${reactId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5 text-text-muted"
        >
          {label}
          {required && <span className="text-gold ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light"
            aria-hidden="true"
          >
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full px-3 py-2.5 rounded-xl border text-sm bg-surface',
            iconLeft ? 'pl-9' : '',
            actionRight ? 'pr-10' : '',
            error
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-border',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {actionRight && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {actionRight}
          </span>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-text-light">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export default Input
