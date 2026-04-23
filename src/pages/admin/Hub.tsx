import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import { UsersRound, Shield } from 'lucide-react'
import AdminQuickAssignWidget from '../../components/admin/assign/AdminQuickAssignWidget'
import PendingTaskRequestsWidget from '../../components/admin/assign/PendingTaskRequestsWidget'
import {
  AdminFlywheelWidget,
  AdminNotificationsWidget,
  AdminTeamWidget,
} from '../../components/dashboard/adminHubWidgets'

/**
 * Admin Hub — the landing surface for owners/admins at /admin.
 *
 * PR #24 — hand-coded 3-column layout matching the member Overview
 * (PR #22/#23) and the Assign page (PR #20). Each widget lives in
 * its own card; columns 1 and 3 stack two cards each with a gap.
 *
 *   Column 1: Quick Assign (top) + Approvals (below)
 *   Column 2: Flywheel Snapshot
 *   Column 3: Notifications (top) + Team Snapshot (below)
 *
 * Separate cards, separate scroll regions — never one shared
 * scroller that could bury a widget. The same `Column` wrapper from
 * Dashboard.tsx is cloned here so the grammar stays consistent across
 * all three surfaces (Overview · Hub · Assign).
 *
 * Hub still hardcodes the role check so member widgets can never
 * leak in via a registry mistake.
 */

export default function AdminHub() {
  useDocumentTitle('Dashboard - Checkmark Workspace')
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Admins only"
        description="This workspace is reserved for team admins and owners."
      />
    )
  }

  return (
    <AdminOverviewProvider>
      <div className="max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        <PageHeader
          icon={UsersRound}
          title="Dashboard"
          subtitle="Assign work, clear approvals, and keep tabs on the studio at a glance."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* ─── Column 1 · Quick Assign + Approvals ──────────────── */}
          <div className="flex flex-col gap-4">
            <Column title="Quick Assign" subtitle="Send a one-off task fast" autoHeight>
              <AdminQuickAssignWidget />
            </Column>
            <Column
              title="Approvals"
              subtitle="Pending task requests from the team"
              autoHeight
            >
              <PendingTaskRequestsWidget />
            </Column>
          </div>

          {/* ─── Column 2 · Flywheel Snapshot ─────────────────────── */}
          <Column title="Flywheel" subtitle="KPI health across the five stages">
            <AdminFlywheelWidget />
          </Column>

          {/* ─── Column 3 · Notifications + Team Snapshot ─────────── */}
          <div className="flex flex-col gap-4">
            <Column
              title="Notifications"
              subtitle="Channels + assignment alerts"
              autoHeight
            >
              <AdminNotificationsWidget />
            </Column>
            <Column title="Team" subtitle="Your crew at a glance" autoHeight>
              <AdminTeamWidget />
            </Column>
          </div>
        </div>
      </div>
    </AdminOverviewProvider>
  )
}

// ─── Local Column wrapper ────────────────────────────────────────
// Identical to the one on the member Overview. Single-widget columns
// cap their height + get an internal scroll; stacked-card columns
// pass `autoHeight` so the cards render content-sized and the page
// itself scrolls if the stack is tall.
function Column({
  title,
  subtitle,
  autoHeight = false,
  children,
}: {
  title: string
  subtitle?: string
  autoHeight?: boolean
  children: ReactNode
}) {
  const sizing = autoHeight ? '' : 'max-h-[calc(100vh-240px)] min-h-[480px]'
  return (
    <section
      className={`rounded-2xl border border-border bg-surface-alt/30 flex flex-col ${sizing}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold tracking-tight text-text">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-text-light mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </header>
      <div
        className={`flex-1 min-h-0 px-4 py-3 ${
          autoHeight ? '' : 'overflow-y-auto'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
