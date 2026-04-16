import type { BookingItem, TaskItem } from '../../contexts/TaskContext'

export interface FlywheelChartDatum {
  name: 'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'
  pct: number
}

export function getTodayBookings(bookings: BookingItem[], todayKey: string): BookingItem[] {
  return bookings
    .filter((booking) => booking.date === todayKey && booking.status !== 'Cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function stageCompletion(tasks: TaskItem[], stage: FlywheelChartDatum['name']): number {
  const stageTasks = tasks.filter((task) => task.stage === stage)
  if (stageTasks.length === 0) return 0
  const completed = stageTasks.filter((task) => task.completed).length
  return Math.round((completed / stageTasks.length) * 100)
}

export function getFlywheelChartData(
  tasks: TaskItem[],
  bookings: BookingItem[],
): FlywheelChartDatum[] {
  return [
    { name: 'Deliver', pct: stageCompletion(tasks, 'Deliver') },
    { name: 'Capture', pct: stageCompletion(tasks, 'Capture') },
    { name: 'Share', pct: stageCompletion(tasks, 'Share') },
    { name: 'Attract', pct: stageCompletion(tasks, 'Attract') },
    {
      name: 'Book',
      pct: bookings.length
        ? Math.round((bookings.filter((booking) => booking.status === 'Confirmed').length / bookings.length) * 100)
        : 0,
    },
  ]
}

export function getFlywheelCompletionSummary(tasks: TaskItem[], bookings: BookingItem[]) {
  const completedCount =
    tasks.filter((task) => task.completed).length +
    bookings.filter((booking) => booking.status === 'Confirmed').length

  return {
    completedCount,
    totalCount: tasks.length + bookings.length,
  }
}
