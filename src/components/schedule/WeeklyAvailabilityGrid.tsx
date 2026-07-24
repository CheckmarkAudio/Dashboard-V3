import { Input } from '../ui'
import { STUDIO_WORK_WEEK, type Weekday } from '../../types'
import { weekdayLabel } from '../../lib/schedule/expand'

/**
 * One day's availability within a weekly schedule. `enabled` toggles
 * whether this day is included at all; `start`/`end` are that day's
 * OWN hours — studio time is sporadic, so a member's Tuesday and
 * Thursday hours can be completely different, not one shared range
 * applied to every selected day.
 */
export interface DaySlot {
  enabled: boolean
  start: string
  end: string
}

export type WeekAvailability = Record<Weekday, DaySlot>

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/** Studio days (Tue–Sat) start enabled with the given default hours;
 *  Sun/Mon start disabled but keep the same default hours ready to
 *  go the moment someone flips them on. */
export function createDefaultWeekAvailability(
  defaultStart = '10:00',
  defaultEnd = '18:00',
): WeekAvailability {
  const out = {} as WeekAvailability
  for (const w of ALL_WEEKDAYS) {
    out[w] = {
      enabled: STUDIO_WORK_WEEK.includes(w),
      start: defaultStart,
      end: defaultEnd,
    }
  }
  return out
}

/** True if at least one day is enabled with a valid (end > start) range. */
export function hasValidAvailability(value: WeekAvailability): boolean {
  return ALL_WEEKDAYS.some((w) => {
    const slot = value[w]
    return slot.enabled && slot.end > slot.start
  })
}

/** Enabled days whose end time isn't after their start time. */
export function invalidDays(value: WeekAvailability): Weekday[] {
  return ALL_WEEKDAYS.filter((w) => {
    const slot = value[w]
    return slot.enabled && slot.end <= slot.start
  })
}

/**
 * Per-day weekly availability picker. Each day gets its own on/off
 * toggle and its own start/end time — the whole point is letting a
 * member's Tuesday hours differ from their Thursday hours in one
 * form, since studio shifts aren't the same length or window every
 * day. Weekday order follows the studio's natural reading order
 * (Mon → Sun) with Sun/Mon visually de-emphasized as non-default days.
 */
export default function WeeklyAvailabilityGrid({
  value,
  onChange,
}: {
  value: WeekAvailability
  onChange: (next: WeekAvailability) => void
}) {
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

  function toggleDay(w: Weekday) {
    onChange({ ...value, [w]: { ...value[w], enabled: !value[w].enabled } })
  }

  function setTime(w: Weekday, field: 'start' | 'end', time: string) {
    onChange({ ...value, [w]: { ...value[w], [field]: time } })
  }

  return (
    <div className="space-y-1.5">
      {order.map((w) => {
        const slot = value[w]
        const isStudioDay = STUDIO_WORK_WEEK.includes(w)
        return (
          <div
            key={w}
            className={[
              'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors',
              slot.enabled
                ? 'border-border bg-surface-alt/40'
                : 'border-border/50 bg-transparent',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => toggleDay(w)}
              aria-pressed={slot.enabled}
              className={[
                'shrink-0 w-16 py-1 rounded-md text-[11px] font-semibold transition-colors border',
                slot.enabled
                  ? 'bg-gold text-black border-gold'
                  : isStudioDay
                    ? 'bg-surface-alt text-text-muted border-border hover:text-text'
                    : 'bg-transparent text-text-light border-border/60 hover:text-text-muted',
              ].join(' ')}
            >
              {weekdayLabel(w)}
            </button>
            {slot.enabled ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  type="time"
                  aria-label={`${weekdayLabel(w, 'long')} start time`}
                  value={slot.start}
                  onChange={(e) => setTime(w, 'start', e.target.value)}
                  className="min-w-0"
                />
                <span className="text-text-light text-[11px] shrink-0">–</span>
                <Input
                  type="time"
                  aria-label={`${weekdayLabel(w, 'long')} end time`}
                  value={slot.end}
                  onChange={(e) => setTime(w, 'end', e.target.value)}
                  className="min-w-0"
                />
                {slot.end <= slot.start && (
                  <span className="text-[10px] text-rose-300 shrink-0">End after start</span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-text-light italic">Off</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
