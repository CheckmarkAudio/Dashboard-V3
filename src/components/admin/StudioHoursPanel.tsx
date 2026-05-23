import { useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, Save } from 'lucide-react'
import { Input, Button } from '../ui'
import { useToast } from '../Toast'
import { useStudioHours } from '../../lib/schedule/useStudioHours'
import { updateStudioHour } from '../../lib/schedule/studioHoursMutations'
import { weekdayLabel } from '../../lib/schedule/expand'
import type { StudioHours, Weekday } from '../../types'

/**
 * Settings → Studio Hours editor.
 *
 * One row per weekday (Sun→Sat) with:
 *   - active checkbox  (closed days = whole-day grey on /calendar)
 *   - open/end time pickers
 *   - per-row Save button
 *
 * Edits flow to the calendar via useStudioHours's realtime sub on
 * the studio_hours_of_operation table — no manual refresh needed.
 *
 * The form keeps a local-state copy of each row so admins can stage
 * edits without an in-flight refetch overwriting their typing. The
 * row resets to the server value whenever the realtime sub fires +
 * the user isn't actively editing that row.
 */
interface StudioHoursPanelProps {
  adminId: string
}

interface RowDraft {
  weekday: Weekday
  active: boolean
  open_time: string  // HH:MM
  close_time: string
  dirty: boolean
}

// Order Mon→Sun (Sat is the last business day; Sun closed-by-default
// trails the open week). Same pattern as the Profile schedule strip.
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export default function StudioHoursPanel({ adminId }: StudioHoursPanelProps) {
  const { toast } = useToast()
  const { byWeekday, loading, error } = useStudioHours()
  const [drafts, setDrafts] = useState<Record<Weekday, RowDraft>>({} as Record<Weekday, RowDraft>)
  const [savingWeekday, setSavingWeekday] = useState<Weekday | null>(null)

  // Initialize / sync drafts from server data. Dirty rows are
  // preserved so a realtime tick from another admin's edit doesn't
  // clobber an in-progress save.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<Weekday, RowDraft> = { ...prev }
      for (const w of WEEKDAY_ORDER) {
        const server = byWeekday[w]
        const draft = prev[w]
        if (!server) {
          if (!draft) {
            next[w] = {
              weekday: w,
              active: false,
              open_time: '10:00',
              close_time: '20:00',
              dirty: false,
            }
          }
          continue
        }
        if (!draft || !draft.dirty) {
          next[w] = {
            weekday: w,
            active: server.active,
            open_time: server.open_time.slice(0, 5),
            close_time: server.close_time.slice(0, 5),
            dirty: false,
          }
        }
      }
      return next
    })
  }, [byWeekday])

  function patchRow(weekday: Weekday, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [weekday]: { ...prev[weekday]!, ...patch, dirty: true },
    }))
  }

  async function saveRow(weekday: Weekday) {
    const draft = drafts[weekday]
    if (!draft) return
    if (draft.close_time <= draft.open_time) {
      toast('Close time must be after open time', 'error')
      return
    }
    setSavingWeekday(weekday)
    try {
      await updateStudioHour({
        weekday,
        open_time: draft.open_time,
        close_time: draft.close_time,
        active: draft.active,
        updatedBy: adminId,
      })
      toast(`${weekdayLabel(weekday, 'long')} hours saved`, 'success')
      setDrafts((prev) => ({ ...prev, [weekday]: { ...prev[weekday]!, dirty: false } }))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSavingWeekday(null)
    }
  }

  const summary = useMemo(() => {
    const open = WEEKDAY_ORDER.filter((w) => byWeekday[w]?.active)
    if (open.length === 0) return 'Closed every day'
    const sample = byWeekday[open[0] as Weekday]!
    const sameHours = open.every(
      (w) => byWeekday[w]?.open_time === sample.open_time && byWeekday[w]?.close_time === sample.close_time,
    )
    const days = open.map((w) => weekdayLabel(w)).join(' · ')
    if (sameHours) {
      return `${days} · ${sample.open_time.slice(0, 5)}–${sample.close_time.slice(0, 5)}`
    }
    return `${days} · varied hours`
  }, [byWeekday])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clock size={18} className="text-gold" aria-hidden="true" />
          Studio hours of operation
        </h2>
        <p className="text-text-muted text-[12px] mt-0.5">
          Drives the gold band on <span className="font-semibold text-text">/calendar</span>. {summary}.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      {loading && Object.keys(drafts).length === 0 ? (
        <div className="flex items-center justify-center py-6 text-text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <table className="w-full text-left">
            <thead className="bg-surface-alt text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="py-2 px-3 font-semibold w-32">Day</th>
                <th className="py-2 px-3 font-semibold w-20">Open?</th>
                <th className="py-2 px-3 font-semibold">Open</th>
                <th className="py-2 px-3 font-semibold">Close</th>
                <th className="py-2 px-3 font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_ORDER.map((w) => {
                const draft = drafts[w]
                if (!draft) return null
                const server: StudioHours | undefined = byWeekday[w]
                const saving = savingWeekday === w
                return (
                  <tr
                    key={w}
                    className={`border-t border-border ${draft.active ? '' : 'opacity-60'}`}
                  >
                    <td className="py-2 px-3 text-[13px] font-semibold text-text">
                      {weekdayLabel(w, 'long')}
                    </td>
                    <td className="py-2 px-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) => patchRow(w, { active: e.target.checked })}
                          className="w-4 h-4 accent-gold"
                        />
                        <span className="text-[12px] text-text-muted">
                          {draft.active ? 'Open' : 'Closed'}
                        </span>
                      </label>
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="time"
                        value={draft.open_time}
                        onChange={(e) => patchRow(w, { open_time: e.target.value })}
                        disabled={!draft.active}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="time"
                        value={draft.close_time}
                        onChange={(e) => patchRow(w, { close_time: e.target.value })}
                        disabled={!draft.active}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Button
                        variant={draft.dirty ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => saveRow(w)}
                        disabled={!draft.dirty || saving}
                        title={server ? `Last saved ${new Date(server.updated_at).toLocaleString()}` : undefined}
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span className="ml-1">{draft.dirty ? 'Save' : 'Saved'}</span>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-text-light italic">
        Closed days dim the whole column on the calendar; open hours render with a
        soft gold wash. Member schedule chips + client bookings still appear on
        top of the wash.
      </p>
    </div>
  )
}
