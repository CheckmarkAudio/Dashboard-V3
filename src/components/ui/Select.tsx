import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  wrapperClassName?: string
  /** Use `children` to pass `<option>` elements. */
  children: ReactNode
}

/**
 * Native `<select>` wrapped with the shared label/hint/error scaffolding.
 * We intentionally avoid a custom dropdown component — native selects are
 * accessible, work with screen readers, and respect platform conventions.
 *
 *   <Select
 *     label="Status"
 *     value={status}
 *     onChange={e => setStatus(e.target.value)}
 *   >
 *     <option value="active">Active</option>
 *     <option value="inactive">Inactive</option>
 *   </Select>
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    required,
    wrapperClassName = '',
    className = '',
    id,
    children,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const fieldId = id ?? `select-${reactId}`
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium mb-1.5 text-text-muted">
          {label}
          {required && <span className="text-gold ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full appearance-none pl-3 pr-9 py-2.5 rounded-xl border text-sm bg-surface',
            error ? 'border-red-500/60 focus:border-red-500' : 'border-border',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-light"
        />
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

export default Select
