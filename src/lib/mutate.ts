import type { PostgrestError } from '@supabase/supabase-js'

type ToastFn = (message: string, type?: 'success' | 'error') => void

type MutationResult<T> = { data: T | null; error: PostgrestError | Error | null }

/**
 * Wrap a Supabase mutation so that every call-site gets consistent error
 * handling: on failure, a user-facing toast is fired and the error is
 * surfaced to the caller so it can roll back optimistic state.
 *
 * Usage:
 *   const { error } = await runMutation(toast, 'Failed to save item', () =>
 *     supabase.from('foo').update(...).eq('id', id)
 *   )
 *   if (error) { rollback(); return }
 *
 * The callback must return a Supabase builder or a Promise resolving to
 * `{ data, error }` — i.e. the normal supabase-js response shape.
 */
export async function runMutation<T>(
  toast: ToastFn,
  errorMessage: string,
  fn: () => PromiseLike<MutationResult<T>>,
): Promise<MutationResult<T>> {
  try {
    const result = await fn()
    if (result.error) {
      console.error(`[mutate] ${errorMessage}:`, result.error)
      toast(errorMessage, 'error')
    }
    return result
  } catch (err) {
    console.error(`[mutate] ${errorMessage}:`, err)
    toast(errorMessage, 'error')
    return { data: null, error: err as Error }
  }
}
