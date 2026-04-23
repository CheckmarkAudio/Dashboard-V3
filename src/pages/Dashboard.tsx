import type { ReactNode } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PageHeader } from '../components/ui'
import MyTasksCard from '../components/tasks/MyTasksCard'
import CalendarDayCard from '../components/calendar/CalendarDayCard'
import {
  BookingSnapshotWidget,
  ForumNotificationsWidget,
} from '../components/dashboard/memberOverviewWidgets'

/**
 * Member Overview — `/`
 *
 * PR #22 reorg: Trello-style 3-column layout matching the Assign
 * page's grammar. Replaces the old `WorkspacePanel`-driven widget
 * grid. Each column is a subtle card with its own header + scrollable
 * interior.
 *
 *   Column 1: Tasks (top) + Booking (below)
 *   Column 2: Calendar (today view · toggleable day change)
 *   Column 3: Notifications
 *
 * Calendar uses the shared `CalendarDayCard` — the exact component
 * that renders on `/calendar`'s left column. Notes added on either
 * surface sync through a shared localStorage key.
 *
 * `MemberOverviewProvider` stays at the root so `BookingSnapshotWidget`
 * (and any future widget that shares the snapshot context) still
 * reads from the same preloaded data wave the old WorkspacePanel
 * wrapped around.
 */

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Your day at a glance: what needs attention, what is booked, and what still needs to be finished today."
      />
      <MemberOverviewProvider>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* ─── Column 1 · Tasks + Booking ──────────────────────── */}
          <Column title="Tasks & Booking" subtitle="Your personal queue + what's scheduled">
            <div className="space-y-4">
              <MyTasksCard embedded />
              <div className="pt-3 border-t border-border/40">
                <BookingSnapshotWidget />
              </div>
            </div>
          </Column>

          {/* ─── Column 2 · Calendar (day view) ──────────────────── */}
          <Column title="Calendar" subtitle="Today's sessions · toggle days with arrows">
            {/* CalendarDayCard owns its own chrome (bg-surface
                rounded-2xl); disable Column's own chrome by passing
                `bare` so we don't end up with nested cards. */}
            <CalendarDayCard className="border-0 bg-transparent" />
          </Column>

          {/* ─── Column 3 · Notifications ────────────────────────── */}
          <Column title="Notifications" subtitle="Channels, assignments, and approvals">
            <ForumNotificationsWidget />
          </Column>
        </div>
      </MemberOverviewProvider>
    </div>
  )
}

// Local Column wrapper — mirrors the pattern from the Assign page.
// Independent scroll per column so a busy notifications feed doesn't
// push the Calendar column off the screen.
function Column({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-alt/30 flex flex-col max-h-[calc(100vh-240px)] min-h-[480px]">
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold tracking-tight text-text">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-text-light mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">{children}</div>
    </section>
  )
}
