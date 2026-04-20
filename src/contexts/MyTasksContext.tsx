// ============================================================================
// MyTasksContext — single source of truth for the personal "My Tasks" list,
// shared between the /daily Tasks page and the Overview "My Tasks" widget.
//
// Why a context? The user expects the widget to be the SAME widget on two
// surfaces — checking a task on Overview should immediately show as pending
// on /daily, and submitting on either page should clear pending state on
// both. Local component state would diverge per instance.
//
// Currently the data is mock (MY_TODAY / MY_WEEK constants). When the
// schema gains a `personal_tasks` table, swap the seed arrays for a
// supabase query + realtime subscription — the context surface stays
// the same so callers don't change.
// ============================================================================

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Stage } from '../components/tasks/shared'

export type MyTask = {
  id: string
  title: string
  stage: Stage
  /** Time-of-day when in Day view (e.g. "5:00 PM"), date when in Week view (e.g. "Apr 15"). null = no due set. */
  due: string | null
  priority?: boolean
  done: boolean
}

// ─── Mock seed data ──────────────────────────────────────────────────
// Until `personal_tasks` lands, both surfaces read from these arrays.
// One has every common shape: a task with no due date, priority flame,
// already-done task, etc., so the dash placeholder + completed dim
// state are always visible somewhere on the list.

const MY_TODAY_SEED: MyTask[] = [
  { id: 'm1', title: 'Draft Q2 social media calendar',       stage: 'share',   due: '5:00 PM',  priority: true,  done: false },
  { id: 'm2', title: 'Schedule newsletter send',             stage: 'share',   due: '3:00 PM',  priority: true,  done: false },
  { id: 'm3', title: 'Post session highlight reel',          stage: 'share',   due: '6:00 PM',                    done: false } as MyTask,
  { id: 'm4', title: 'Follow up on three pending inquiries', stage: 'book',    due: 'Today',    priority: true,  done: false },
  { id: 'm5', title: 'Respond to influencer DMs',            stage: 'capture', due: '12:00 PM',                   done: true  } as MyTask,
  { id: 'm6', title: 'Review onboarding doc edits',          stage: 'deliver', due: null,                          done: false },
]

const MY_WEEK_SEED: MyTask[] = [
  { id: 'w1', title: 'Review Instagram analytics',  stage: 'capture', due: 'Apr 15',                     done: false },
  { id: 'w2', title: 'Create podcast promo copy',   stage: 'share',   due: 'Apr 16',                     done: false },
  { id: 'w3', title: 'Plan May content calendar',   stage: 'share',   due: 'Apr 21',                     done: false },
  { id: 'w4', title: 'Q2 campaign launch prep',     stage: 'attract', due: 'May 1',   priority: true,  done: false },
  { id: 'w5', title: 'Sync with engineer about masters', stage: 'deliver', due: null,                    done: false },
]

interface MyTasksContextValue {
  today: MyTask[]
  week: MyTask[]
  pendingIds: Set<string>
  submittedIds: Set<string>
  togglePending: (id: string) => void
  submitPending: () => void
  addTask: (input: { title: string; stage: Stage; due: string | null; priority?: boolean; range?: 'Day' | 'Week' }) => void
}

const MyTasksContext = createContext<MyTasksContextValue | null>(null)

let nextId = 100

export function MyTasksProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<MyTask[]>(MY_TODAY_SEED)
  const [week, setWeek] = useState<MyTask[]>(MY_WEEK_SEED)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const togglePending = useCallback((id: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const submitPending = useCallback(() => {
    setSubmittedIds((prev) => {
      const next = new Set(prev)
      pendingIds.forEach((id) => next.add(id))
      return next
    })
    setPendingIds(new Set())
  }, [pendingIds])

  const addTask = useCallback(
    (input: { title: string; stage: Stage; due: string | null; priority?: boolean; range?: 'Day' | 'Week' }) => {
      const id = `mt-${nextId++}`
      const next: MyTask = {
        id,
        title: input.title,
        stage: input.stage,
        due: input.due,
        priority: input.priority,
        done: false,
      }
      if (input.range === 'Week') setWeek((prev) => [...prev, next])
      else setToday((prev) => [...prev, next])
    },
    [],
  )

  const value = useMemo<MyTasksContextValue>(
    () => ({ today, week, pendingIds, submittedIds, togglePending, submitPending, addTask }),
    [today, week, pendingIds, submittedIds, togglePending, submitPending, addTask],
  )

  return <MyTasksContext.Provider value={value}>{children}</MyTasksContext.Provider>
}

export function useMyTasks(): MyTasksContextValue {
  const ctx = useContext(MyTasksContext)
  if (!ctx) throw new Error('useMyTasks must be used inside <MyTasksProvider>')
  return ctx
}
