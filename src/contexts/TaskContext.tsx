import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/* ── Stage color map (shared across app) ── */
export const STAGE_COLORS: Record<string, string> = {
  Deliver: '#34d399',
  Capture: '#38bdf8',
  Share: '#a78bfa',
  Attract: '#fbbf24',
  Book: '#fb7185',
  Administrative: '#94a3b8',
  Coding: '#60a5fa',
  Maintenance: '#a78bfa',
}

export type KpiStage = 'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'
export type MaintenanceCategory = 'Administrative' | 'Coding' | 'Maintenance'
export type TaskCategory = KpiStage | MaintenanceCategory

export type TaskItem = {
  id: string
  title: string
  priority: boolean
  due: string
  startDate: string
  assignee: string
  stage: string
  stageColor: string
  completed: boolean
  category: TaskCategory
  recurring: false | 'daily' | 'weekly' | 'monthly'
}

export type BookingType = 'engineering' | 'training' | 'education' | 'music_lesson' | 'consultation'

export type StudioSpace = 'Studio A' | 'Studio B' | 'Home Visit' | 'Venue'

export type BookingItem = {
  id: string
  description: string
  client: string
  type: BookingType
  date: string
  startTime: string
  endTime: string
  startDate: string
  assignee: string
  studio: StudioSpace
  recurring: false | 'daily' | 'weekly' | 'monthly'
  status: 'Confirmed' | 'Placed' | 'Cancelled'
}

// Past / known clients. Starts empty; populated from real booking
// history once the app switches `CreateBookingModal` to persisted
// sessions. Previously this was 6 hardcoded demo clients (The Podcast
// Hub, Stanford Music, etc.) that surfaced as "suggested clients"
// everywhere — pre-onboarding cleanup removed them.
export const EXISTING_CLIENTS: string[] = []

interface TaskContextType {
  tasks: TaskItem[]
  bookings: BookingItem[]
  togglePending: (id: string) => void
  pendingIds: Set<string>
  submitPending: () => void
  hasPending: boolean
  addTask: (task: Omit<TaskItem, 'id' | 'completed' | 'stageColor'>) => void
  addBooking: (booking: Omit<BookingItem, 'id' | 'status'>) => { conflict: boolean; conflictWith?: BookingItem }
  checkConflict: (date: string, startTime: string, endTime: string, studio: StudioSpace) => BookingItem | null
}

const TaskContext = createContext<TaskContextType | null>(null)

let nextId = 100

function stageColorFor(stage: string): string {
  return STAGE_COLORS[stage] ?? '#C9A84C'
}

// Pre-onboarding cleanup: TaskContext no longer seeds the app with
// demo tasks or bookings. Anything the UI displays now reflects real,
// user-created state. The full in-memory TaskContext will eventually
// be retired in favor of Supabase-backed queries (see
// CreateBookingModal migration on the todo list) — until then, this
// context starts empty and is only populated by user actions during
// the session.
const INITIAL_TASKS: TaskItem[] = []
const INITIAL_BOOKINGS: BookingItem[] = []

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS)
  const [bookings, setBookings] = useState<BookingItem[]>(INITIAL_BOOKINGS)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const togglePending = useCallback((id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const submitPending = useCallback(() => {
    setTasks(prev =>
      prev.map(t => pendingIds.has(t.id) ? { ...t, completed: true } : t)
    )
    setPendingIds(new Set())
  }, [pendingIds])

  const hasPending = pendingIds.size > 0

  const addTask = useCallback((task: Omit<TaskItem, 'id' | 'completed' | 'stageColor'>) => {
    const id = `task-${nextId++}`
    const stageColor = stageColorFor(task.stage)
    setTasks(prev => [...prev, { ...task, id, completed: false, stageColor }])
  }, [])

  const checkConflict = useCallback((date: string, startTime: string, endTime: string, studio: StudioSpace): BookingItem | null => {
    return bookings.find(b => {
      if (b.date !== date || b.studio !== studio) return false
      // Check time overlap
      const s1 = parseInt(startTime.replace(':', ''))
      const e1 = parseInt(endTime.replace(':', ''))
      const s2 = parseInt(b.startTime.replace(':', ''))
      const e2 = parseInt(b.endTime.replace(':', ''))
      return s1 < e2 && e1 > s2
    }) ?? null
  }, [bookings])

  const addBooking = useCallback((booking: Omit<BookingItem, 'id' | 'status'>) => {
    const conflict = checkConflict(booking.date, booking.startTime, booking.endTime, booking.studio)
    const bookingId = `bk-${nextId++}`
    setBookings(prev => [...prev, { ...booking, id: bookingId, status: 'Placed' }])
    // Bookings stay in the bookings list only — not added to tasks
    return { conflict: !!conflict, conflictWith: conflict ?? undefined }
  }, [checkConflict])

  const value = useMemo(() => ({
    tasks,
    bookings,
    togglePending,
    pendingIds,
    submitPending,
    hasPending,
    addTask,
    addBooking,
    checkConflict,
  }), [tasks, bookings, togglePending, pendingIds, submitPending, hasPending, addTask, addBooking, checkConflict])

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used within TaskProvider')
  return ctx
}
