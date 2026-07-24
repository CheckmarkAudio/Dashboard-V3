/** Numeric half-open interval [start, end). */
export interface Interval {
  start: number
  end: number
}

/** Clip an interval to [lo, hi); returns null if empty or inverted. */
export function clipInterval(iv: Interval, lo: number, hi: number): Interval | null {
  const start = Math.max(iv.start, lo)
  const end = Math.min(iv.end, hi)
  return end > start ? { start, end } : null
}

/** Merge overlapping or touching intervals into a sorted minimal set. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((iv) => iv.end > iv.start)
    .slice()
    .sort((a, b) => a.start - b.start)
  const merged: Interval[] = []

  for (const current of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || current.start > previous.end) {
      merged.push({ ...current })
      continue
    }
    previous.end = Math.max(previous.end, current.end)
  }

  return merged
}

/** Subtract every exclusion interval from the source intervals. */
export function subtractIntervals(
  sources: Interval[],
  exclusions: Interval[],
): Interval[] {
  const remaining: Interval[] = []
  const mergedExclusions = mergeIntervals(exclusions)

  for (const source of mergeIntervals(sources)) {
    let cursor = source.start
    for (const exclusion of mergedExclusions) {
      if (exclusion.end <= cursor) continue
      if (exclusion.start >= source.end) break

      if (exclusion.start > cursor) {
        remaining.push({
          start: cursor,
          end: Math.min(exclusion.start, source.end),
        })
      }
      cursor = Math.max(cursor, exclusion.end)
      if (cursor >= source.end) break
    }

    if (cursor < source.end) {
      remaining.push({ start: cursor, end: source.end })
    }
  }

  return remaining
}

/** Total covered minutes after overlap removal, rounded to the nearest minute. */
export function totalMinutes(intervals: Interval[]): number {
  const milliseconds = mergeIntervals(intervals)
    .reduce((sum, interval) => sum + interval.end - interval.start, 0)
  return Math.round(milliseconds / 60_000)
}
