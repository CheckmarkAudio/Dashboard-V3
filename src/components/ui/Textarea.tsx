import { forwardRef, useId, type TextareaHTMLAttributes, type ReactNode } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  wrapperClassName?: string
}

/**
 * Multi-line text input with the same label/hint/error scaffolding as `<Input>`.
 * Use for notes, descriptions, and anything longer than a single line.
 *
 *   <Textarea
 *     label="Notes"
 *     rows={4}
 *     value={notes}
 *     onChange={e => setNotes(e.target.value)}
 *   />
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    required,
    wrapperClassName = '',
    className = '',
    id,
    rows = 3,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const fieldId = id ?? `textarea-${reactId}`
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
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'w-full px-3 py-2.5 rounded-xl border text-sm resize-none bg-surface',
          error ? 'border-red-500/60 focus:border-red-500' : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
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

export default Textarea
