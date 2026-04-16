import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts'
import {
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  Flame,
  Instagram,
  Music2,
  Youtube,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useTasks } from '../../contexts/TaskContext'
import type { OverviewWidgetDefinition } from '../../domain/workspaces/types'

const platforms = [
  { name: 'Instagram', icon: Instagram, followers: '128.4K' },
  { name: 'TikTok', icon: Music2, followers: '128.4K' },
  { name: 'YouTube', icon: Youtube, followers: '128.4K' },
]

const teamMembers = [
  { id: 'jordan', name: 'Jordan Lee', role: 'Lead Engineer' },
  { id: 'sam', name: 'Sam Rivera', role: 'Audio Intern' },
  { id: 'alex', name: 'Alex Kim', role: 'Marketing' },
  { id: 'taylor', name: 'Taylor Morgan', role: 'Operations' },
  { id: 'taylor2', name: 'Taylor Morganson', role: 'Operations' },
]

const BOOKING_TYPE_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  training: 'Training',
  education: 'Education',
  music_lesson: 'Music Lesson',
  consultation: 'Consultation',
}

const POSITIONS_OV = ['Marketing', 'Media', 'Engineer', 'Intern', 'Admin'] as const
type PositionOV = typeof POSITIONS_OV[number]
const ROLE_TASKS_OV: Record<PositionOV, { id: string; title: string; due: string; priority: boolean; done: boolean }[]> = {
  Marketing: [
    { id: 'mk1', title: 'Draft Q2 social media calendar', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'mk2', title: 'Review Instagram analytics', due: 'Apr 15', priority: false, done: false },
    { id: 'mk3', title: 'Create podcast promo copy', due: 'Apr 16', priority: false, done: true },
    { id: 'mk4', title: 'Update brand guidelines', due: 'Apr 18', priority: false, done: false },
    { id: 'mk5', title: 'Schedule newsletter send', due: 'Today, 3:00 PM', priority: true, done: true },
  ],
  Media: [
    { id: 'md1', title: 'Edit podcast episode 14', due: 'Today, 6:00 PM', priority: true, done: false },
    { id: 'md2', title: 'Color grade promo video', due: 'Apr 15', priority: false, done: false },
    { id: 'md3', title: 'Export stems for client', due: 'Today, 4:00 PM', priority: true, done: true },
    { id: 'md4', title: 'Upload B-roll to drive', due: 'Apr 16', priority: false, done: false },
  ],
  Engineer: [
    { id: 'en1', title: 'Mix Stanford session', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'en2', title: 'Master album tracks', due: 'Apr 15', priority: true, done: false },
    { id: 'en3', title: 'Calibrate Studio A', due: 'Apr 16', priority: false, done: true },
    { id: 'en4', title: 'Backup session files', due: 'Apr 18', priority: false, done: false },
  ],
  Intern: [
    { id: 'in1', title: 'Shadow mixing session', due: 'Today, 3:00 PM', priority: true, done: false },
    { id: 'in2', title: 'Audio fundamentals mod 3', due: 'Apr 15', priority: false, done: false },
    { id: 'in3', title: 'Organize sample library', due: 'Apr 16', priority: false, done: true },
    { id: 'in4', title: 'Weekly reflection', due: 'Apr 18', priority: false, done: false },
  ],
  Admin: [
    { id: 'ad1', title: 'Process March invoices', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'ad2', title: 'Update availability cal', due: 'Apr 15', priority: false, done: false },
    { id: 'ad3', title: 'File equipment receipts', due: 'Apr 16', priority: false, done: true },
    { id: 'ad4', title: 'Renew software licenses', due: 'Apr 18', priority: true, done: false },
  ],
}

function splitClockParts(value: string): [string, string] {
  const [left = '0', right = '0'] = value.split(':')
  return [left, right]
}

function parseClock(value: string): [number, number] {
  const [hours, minutes] = splitClockParts(value)
  return [Number(hours), Number(minutes)]
}

function formatTime12(t: string): string {
  const [h, m] = parseClock(t)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = parseClock(start)
  const [eh, em] = parseClock(end)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ''}` : `${rm}m`
}

export function TeamSnapshotWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {platforms.map((platform) => (
          <div key={platform.name} className="flex items-center gap-1.5">
            <platform.icon size={13} className="text-gold" />
            <span className="text-[11px] font-semibold text-text-muted">{platform.followers}</span>
          </div>
        ))}
      </div>
      <div className="divide-y divide-border/20">
        {teamMembers.map((member) => (
          <Link
            key={member.id}
            to={`/profile/${member.id}`}
            className="flex items-center gap-3.5 py-3 first:pt-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
              {member.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-text tracking-tight truncate">{member.name}</p>
              <p className="text-[12px] text-text-light mt-0.5">{member.role}</p>
            </div>
            <ChevronRight size={12} className="text-text-light shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export function TodayCalendarWidget() {
  const { bookings } = useTasks()
  const todayKey = new Date().toISOString().split('T')[0] ?? ''
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const todayBookings = bookings
    .filter((booking) => booking.date === todayKey && booking.status !== 'Cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <CalendarIcon size={14} className="text-gold" />
        <p className="text-[11px] text-text-light">{dateLabel}</p>
      </div>
      {todayBookings.length > 0 ? (
        <div className="space-y-0">
          {todayBookings.map((booking) => (
            <div key={booking.id} className="py-3 border-b border-border/20 last:border-0 first:pt-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[14px] font-medium text-text tracking-tight">{booking.client}</p>
                <span className="text-[10px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                  {durationLabel(booking.startTime, booking.endTime)}
                </span>
              </div>
              <p className="text-[12px] text-text-muted">{booking.description}</p>
              <p className="text-[12px] text-text-light mt-0.5">
                {formatTime12(booking.startTime)} - {formatTime12(booking.endTime)}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-semibold text-gold/70 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">
                  {BOOKING_TYPE_LABELS[booking.type] ?? booking.type}
                </span>
                <span className="text-[10px] text-text-light">{booking.studio} · {booking.assignee}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-text-light italic py-6 text-center">No bookings today</p>
      )}
    </div>
  )
}

export function TeamTasksWidget() {
  const [position, setPosition] = useState<PositionOV>('Marketing')
  const [time, setTime] = useState('Day')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())

  const tasks = ROLE_TASKS_OV[position]
  const filtered = tasks.filter((task) => !task.done && !submitted.has(task.id))
  const sorted = [...filtered].sort((a, b) => {
    const aDone = a.done || submitted.has(a.id)
    const bDone = b.done || submitted.has(b.id)
    return aDone === bDone ? 0 : aDone ? 1 : -1
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex bg-surface-alt rounded-lg p-0.5 border border-border">
          {['Day', 'Week'].map((option) => (
            <button
              key={option}
              onClick={() => setTime(option)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium tracking-tight transition-all ${
                time === option ? 'bg-gold/12 text-gold' : 'text-text-light hover:text-text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-0.5 flex-wrap mb-3">
        {POSITIONS_OV.map((entry) => (
          <button
            key={entry}
            onClick={() => {
              setPosition(entry)
              setChecked(new Set())
              setSubmitted(new Set())
            }}
            className={`px-1.5 py-0.5 rounded text-[11px] tracking-tight transition-all ${
              position === entry ? 'text-gold font-medium' : 'text-text-light font-normal hover:text-text-muted'
            }`}
          >
            {entry}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-0">
        {sorted.map((task) => {
          const isDone = task.done || submitted.has(task.id)
          const isPending = checked.has(task.id)
          const dueLabel = time === 'Day' && task.due.toLowerCase().includes('today')
            ? (task.due.split(',')[1]?.trim() || '')
            : task.due.split(',')[0]
          return (
            <div key={task.id} className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 ${isDone ? 'opacity-25' : ''}`}>
              <button
                onClick={() => !isDone && setChecked((prev) => {
                  const next = new Set(prev)
                  if (next.has(task.id)) next.delete(task.id)
                  else next.add(task.id)
                  return next
                })}
                disabled={isDone}
                className="shrink-0"
              >
                <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
                  isDone ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'
                }`}>
                  {(isDone || isPending) && <Check size={11} className="text-gold" />}
                </div>
              </button>
              <span className={`flex-1 text-[14px] font-normal tracking-tight truncate min-w-0 ${isDone ? 'line-through text-text-light' : 'text-text-muted'}`}>
                {task.title}
              </span>
              {task.priority && <Flame size={13} className="text-gold shrink-0" />}
              <span className="text-[11px] shrink-0 tabular-nums text-text-light">{dueLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="pt-4 mt-auto">
        <button
          onClick={() => {
            setSubmitted((prev) => {
              const next = new Set(prev)
              checked.forEach((id) => next.add(id))
              return next
            })
            setChecked(new Set())
          }}
          disabled={checked.size === 0}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-tight transition-all ${
            checked.size > 0
              ? 'bg-gold text-black hover:bg-gold-muted shadow-md shadow-gold/20'
              : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
          }`}
        >
          <Check size={14} />
          {checked.size > 0 ? `Submit Completed (${checked.size})` : 'Submit Completed'}
        </button>
      </div>
    </div>
  )
}

export function FlywheelSummaryWidget() {
  const { tasks, bookings } = useTasks()

  const chartData = [
    { name: 'Deliver', pct: (() => { const stage = tasks.filter((task) => task.stage === 'Deliver'); return stage.length ? Math.round((stage.filter((task) => task.completed).length / stage.length) * 100) : 0 })() },
    { name: 'Capture', pct: (() => { const stage = tasks.filter((task) => task.stage === 'Capture'); return stage.length ? Math.round((stage.filter((task) => task.completed).length / stage.length) * 100) : 0 })() },
    { name: 'Share', pct: (() => { const stage = tasks.filter((task) => task.stage === 'Share'); return stage.length ? Math.round((stage.filter((task) => task.completed).length / stage.length) * 100) : 0 })() },
    { name: 'Attract', pct: (() => { const stage = tasks.filter((task) => task.stage === 'Attract'); return stage.length ? Math.round((stage.filter((task) => task.completed).length / stage.length) * 100) : 0 })() },
    { name: 'Book', pct: bookings.length ? Math.round((bookings.filter((booking) => booking.status === 'Confirmed').length / bookings.length) * 100) : 0 },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <Link to={APP_ROUTES.admin.analytics} className="flex items-center gap-1 group">
          <h3 className="text-[14px] font-bold text-text tracking-tight group-hover:text-gold transition-colors">KPI Performance</h3>
          <ChevronRight size={12} className="text-text-light group-hover:text-gold transition-colors" />
        </Link>
        <span className="text-[10px] text-text-light">
          {tasks.filter((task) => task.completed).length + bookings.filter((booking) => booking.status === 'Confirmed').length}
          {' / '}
          {tasks.length + bookings.length} completed
        </span>
      </div>
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} barSize={24}>
              {[0, 1, 2, 3, 4].map((index) => (
                <Cell key={index} fill="#C9A84C" fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between px-1 mt-1">
        {chartData.map((entry) => (
          <span key={entry.name} className="text-[9px] text-text-light">{entry.name}</span>
        ))}
      </div>
    </div>
  )
}

export const OVERVIEW_WIDGET_DEFINITIONS: OverviewWidgetDefinition[] = [
  {
    id: 'team_snapshot',
    title: 'Team Snapshot',
    description: 'Quick access to the current team and top channels.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    component: TeamSnapshotWidget,
  },
  {
    id: 'today_calendar',
    title: 'Today Calendar',
    description: 'Your current booking picture for today.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    component: TodayCalendarWidget,
  },
  {
    id: 'team_tasks',
    title: 'Team Tasks',
    description: 'Position-based team task snapshot.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    component: TeamTasksWidget,
  },
  {
    id: 'flywheel_summary',
    title: 'Flywheel Summary',
    description: 'Fast read on progress across the core business loop.',
    defaultSpan: 3,
    allowedRoles: ['member', 'admin', 'owner'],
    component: FlywheelSummaryWidget,
  },
]
