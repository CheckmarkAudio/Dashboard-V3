/**
 * Pack a list of widgets into pages where each widget consumes one or
 * more "slot units" within a fixed page size. Powers the inline-expand
 * carousel pattern used by `MemberActivitySection` (Activity widgets
 * page) and `WorkspacePanel` (Overview / Hub).
 *
 * The hard problem this solves: in a page-snapping carousel with
 * `translateX` translation, if any widget is wider than one slot, a
 * straightforward flex layout can leave that widget visually straddling
 * a page boundary — half visible on page N, half on page N+1. That
 * makes the page-snap math break and the UX feel broken ("clicking
 * the right arrow cuts off the widget I was looking at").
 *
 * Fix: pack widgets into pages explicitly. When a wide widget would
 * cross a page boundary, fill the remaining slots in the current page
 * with invisible `spacer` placeholders, then start the wide widget on
 * slot 0 of the next page. The carousel's page boundaries stay clean,
 * the page snap behaves normally, and the only cost is one or more
 * invisible spacer divs (sized like a normal widget so the flex row's
 * gap rhythm is preserved).
 *
 * Generic over the widget identifier type so callers can use string
 * keys, branded enums, or anything else.
 *
 * @param order      Ordered widget IDs.
 * @param weightFn   Returns the slot weight for a widget (typically 1
 *                   for normal, 2 for "expanded"). Should always
 *                   return a positive integer.
 * @param pageSize   Slots per page (e.g. 2 for tablet, 3 for desktop).
 *                   The maximum a single widget can consume is
 *                   `pageSize` (the function clamps weight to this
 *                   ceiling — a widget can never span pages).
 *
 * @returns A flat layout array in render order. Each item is either a
 *          `widget` (carries its `id`, `weight`, and the `page` it
 *          lands on) or a `spacer` (carries a stable `key` for React
 *          reconciliation and the `page` it occupies). Render the
 *          array in order; spacers should be a non-interactive
 *          placeholder div sized like a normal slot.
 */
export type PackedItem<TId> =
  | { type: 'widget'; id: TId; weight: number; page: number }
  | { type: 'spacer'; key: string; page: number }

export function packPagedWidgets<TId>(
  order: TId[],
  weightFn: (id: TId) => number,
  pageSize: number,
): PackedItem<TId>[] {
  if (pageSize < 1) return []

  const out: PackedItem<TId>[] = []
  let page = 0
  let posInPage = 0

  for (const id of order) {
    // Clamp the weight to the page size so a single widget can never
    // span pages, no matter what the caller hands us.
    const weight = Math.max(1, Math.min(weightFn(id), pageSize))

    // If placing this widget on the current page would overflow the
    // page, pad the remaining slots with spacers and bump to the
    // next page.
    if (posInPage + weight > pageSize) {
      let spacerIdx = 0
      while (posInPage < pageSize) {
        out.push({
          type: 'spacer',
          key: `spacer-${page}-${posInPage}-${spacerIdx}`,
          page,
        })
        posInPage += 1
        spacerIdx += 1
      }
      page += 1
      posInPage = 0
    }

    out.push({ type: 'widget', id, weight, page })
    posInPage += weight

    if (posInPage >= pageSize) {
      page += 1
      posInPage = 0
    }
  }

  return out
}

/** Convenience: the total number of pages produced by `packPagedWidgets`. */
export function packedTotalPages<TId>(items: PackedItem<TId>[]): number {
  if (items.length === 0) return 1
  let max = 0
  for (const item of items) {
    if (item.page > max) max = item.page
  }
  return max + 1
}

/** Convenience: find the page a given widget id lands on, or null if missing. */
export function packedPageForWidget<TId>(
  items: PackedItem<TId>[],
  id: TId,
): number | null {
  for (const item of items) {
    if (item.type === 'widget' && item.id === id) return item.page
  }
  return null
}
