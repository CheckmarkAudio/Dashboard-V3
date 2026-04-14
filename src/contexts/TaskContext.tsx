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
  status: 'Confirmed' | 'Pending' | 'Cancelled'
}

export const EXISTING_CLIENTS = [
  'The Podcast Hub',
  'Stanford Music',
  'Aprt Media',
  'James Wilson',
  'Maya Thompson',
  'Project Alpha',
]

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

const INITIAL_TASKS: TaskItem[] = [
  // Deliver
  { id: 'd1', title: 'Send final mixes to 3 clients', priority: true, due: 'Today, 3:00 PM', startDate: 'Apr 10', assignee: 'You', stage: 'Deliver', stageColor: '#34d399', completed: true, category: 'Deliver', recurring: false },
  { id: 'd2', title: 'Upload mastered revisions', priority: true, due: 'Today, 5:00 PM', startDate: 'Apr 10', assignee: 'You', stage: 'Deliver', stageColor: '#34d399', completed: true, category: 'Deliver', recurring: false },
  { id: 'd3', title: 'Confirm delivery satisfaction', priority: false, due: 'Tomorrow, 10:00 AM', startDate: 'Apr 11', assignee: 'You', stage: 'Deliver', stageColor: '#34d399', completed: false, category: 'Deliver', recurring: false },
  { id: 'd4', title: 'Request testimonial from latest session', priority: false, due: 'Wed, Apr 15', startDate: 'Apr 9', assignee: 'You', stage: 'Deliver', stageColor: '#34d399', completed: true, category: 'Deliver', recurring: false },
  { id: 'd5', title: 'Submit podcast intro script', priority: true, due: 'Today, 6:00 PM', startDate: 'Apr 12', assignee: 'You', stage: 'Deliver', stageColor: '#34d399', completed: true, category: 'Deliver', recurring: false },
  { id: 'd6', title: 'Archive completed project files', priority: false, due: 'Fri, Apr 17', startDate: 'Apr 9', assignee: 'Taylor Morgan', stage: 'Deliver', stageColor: '#34d399', completed: true, category: 'Deliver', recurring: false },
  // Capture
  { id: 'c1', title: "Edit Jordan Lee's session block", priority: true, due: 'Today, 5:00 PM', startDate: 'Apr 11', assignee: 'You', stage: 'Capture', stageColor: '#38bdf8', completed: true, category: 'Capture', recurring: false },
  { id: 'c2', title: 'Record B-roll for promo reel', priority: false, due: 'Tomorrow, 2:00 PM', startDate: 'Apr 10', assignee: 'Sam Rivera', stage: 'Capture', stageColor: '#38bdf8', completed: false, category: 'Capture', recurring: false },
  { id: 'c3', title: 'Capture client testimonial audio', priority: true, due: 'Today, 4:00 PM', startDate: 'Apr 12', assignee: 'You', stage: 'Capture', stageColor: '#38bdf8', completed: true, category: 'Capture', recurring: false },
  { id: 'c4', title: 'Log new lead from website form', priority: false, due: 'Today, 6:00 PM', startDate: 'Apr 12', assignee: 'Alex Kim', stage: 'Capture', stageColor: '#38bdf8', completed: false, category: 'Capture', recurring: false },
  // Share
  { id: 's1', title: 'Platform analytics report', priority: false, due: 'Wed, Apr 15', startDate: 'Apr 9', assignee: 'Alex Kim', stage: 'Share', stageColor: '#a78bfa', completed: false, category: 'Share', recurring: false },
  { id: 's2', title: 'Update team weekly summary', priority: false, due: 'Fri, Apr 17', startDate: 'Apr 10', assignee: 'Taylor Morgan', stage: 'Share', stageColor: '#a78bfa', completed: true, category: 'Share', recurring: false },
  { id: 's3', title: 'Post session highlight to Instagram', priority: false, due: 'Today, 7:00 PM', startDate: 'Apr 12', assignee: 'Sam Rivera', stage: 'Share', stageColor: '#a78bfa', completed: false, category: 'Share', recurring: false },
  { id: 's4', title: 'Draft newsletter content', priority: false, due: 'Thu, Apr 16', startDate: 'Apr 11', assignee: 'Alex Kim', stage: 'Share', stageColor: '#a78bfa', completed: true, category: 'Share', recurring: false },
  // Attract
  { id: 'a1', title: 'Review client proposal draft', priority: false, due: 'Tomorrow, 10:00 AM', startDate: 'Apr 11', assignee: 'Sam Rivera', stage: 'Attract', stageColor: '#fbbf24', completed: false, category: 'Attract', recurring: false },
  { id: 'a2', title: 'Follow up on consultation inquiry', priority: true, due: 'Today, 2:00 PM', startDate: 'Apr 12', assignee: 'You', stage: 'Attract', stageColor: '#fbbf24', completed: true, category: 'Attract', recurring: false },
  { id: 'a3', title: 'Update portfolio page with new work', priority: false, due: 'Fri, Apr 17', startDate: 'Apr 9', assignee: 'Alex Kim', stage: 'Attract', stageColor: '#fbbf24', completed: false, category: 'Attract', recurring: false },
]

const INITIAL_BOOKINGS: BookingItem[] = [
  { id: 'bk1', description: 'Recording Session', client: 'The Podcast Hub', type: 'engineering', date: '2026-04-14', startTime: '10:00', endTime: '12:00', startDate: '2026-04-10', assignee: 'Sarah K.', studio: 'Studio A', recurring: false, status: 'Confirmed' },
  { id: 'bk2', description: 'Vocal Recording', client: 'James Wilson', type: 'engineering', date: '2026-04-14', startTime: '14:00', endTime: '16:00', startDate: '2026-04-11', assignee: 'Dave L.', studio: 'Studio B', recurring: false, status: 'Pending' },
  { id: 'bk3', description: 'Final Mix', client: 'Project Alpha', type: 'engineering', date: '2026-04-15', startTime: '09:00', endTime: '13:00', startDate: '2026-04-10', assignee: 'Ben J.', studio: 'Studio A', recurring: false, status: 'Confirmed' },
  { id: 'bk4', description: 'Consulting Session', client: 'Maya Thompson', type: 'consultation', date: '2026-04-16', startTime: '11:00', endTime: '12:00', startDate: '2026-04-12', assignee: 'Sarah K.', studio: 'Studio A', recurring: false, status: 'Confirmed' },
  { id: 'bk5', description: 'Training Session', client: 'New Intern', type: 'training', date: '2026-04-17', startTime: '09:00', endTime: '17:00', startDate: '2026-04-14', assignee: 'Dave L.', studio: 'Studio B', recurring: false, status: 'Pending' },
]

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
    setBookings(prev => [...prev, { ...booking, id: bookingId, status: 'Pending' }])
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
