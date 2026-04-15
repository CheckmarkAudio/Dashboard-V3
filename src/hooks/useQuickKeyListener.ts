import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuickKeys } from './useQuickKeys'

/**
 * Global keydown listener that fires quick-key navigation. Mounted once at
 * the Layout level so every page inherits the shortcuts. The handler is
 * deliberately conservative:
 *   - ignores keys pressed inside text inputs, textareas, selects, and
 *     contenteditable regions (so typing "a" in a search box doesn't
 *     hijack to the Overview tab);
 *   - ignores any modifier-combo (Cmd/Ctrl/Alt) so browser + OS shortcuts
 *     keep working;
 *   - does a case-insensitive compare against the user's bindings.
 */
export function useQuickKeyListener() {
  const navigate = useNavigate()
  const { actions, bindings } = useQuickKeys()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is on an editable surface
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName?.toLowerCase()
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      // Never hijack Cmd/Ctrl/Alt combos — those belong to the browser/OS
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const pressed = e.key.toLowerCase()
      if (!pressed) return

      const match = actions.find(a => bindings[a.id] && bindings[a.id] === pressed)
      if (match) {
        e.preventDefault()
        navigate(match.path)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actions, bindings, navigate])
}
