import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../components/ui'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { ADMIN_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import MemberHighlights, { SocialStatsBar } from '../../components/members/MemberHighlights'
import QuickAssignModal from '../../components/admin/QuickAssignModal'
import { UsersRound, Shield, Zap } from 'lucide-react'

/**
 * QuickAssignButton — gold pill bubble in the Dashboard's PageHeader
 * actions slot. Mirrors the BookButton pattern on the Overview page
 * (same chrome, same spot) so the two surfaces feel like siblings.
 *
 * Hover/focus shakes the lightning bolt (`.icon-shake-on-hover` →
 * `.icon-shake-target` keyframe in index.css) — the only ornamental
 * detail; the rest of the bubble matches Book a Session exactly.
 */
function QuickAssignButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="icon-shake-on-hover inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Zap
          size={14}
          strokeWidth={2.4}
          className="icon-shake-target fill-black"
          aria-hidden="true"
        />
        Quick Assign
      </button>
      {open && <QuickAssignModal onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Admin Hub — `/admin`
 *
 * PR #29 — back on `WorkspacePanel` with the 3-column equal-width
 * grid. Every admin widget is span: 1 so drag-reorder keeps columns
 * uniform. Default widgets: Quick Assign · Notifications · Flywheel ·
 * Team · Task Requests (all draggable, all expandable).
 *
 * `isAdmin` gate still hardcoded here — member widgets cannot leak
 * onto this page via a registry mistake.
 */
const ADMIN_SCOPE = 'admin_overview' as const

export default function AdminHub() {
  useDocumentTitle('Dashboard - Checkmark Workspace')
  const { isAdmin, appRole, profile } = useAuth()

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
      <div className="max-w-[1440px] mx-auto space-y-3 animate-fade-in">
        {/* Skin pass 2026-05-06 — SocialStatsBar moved DOWN to the
            member-row actions slot (mirrors the Overview swap).
            QuickAssign bubble (2026-05-06) sits in the PageHeader's
            top-right actions slot, mirroring the Overview's
            "+Book a Session" affordance. */}
        <PageHeader
          icon={UsersRound}
          title="Dashboard"
          actions={<QuickAssignButton />}
        />
        {/* Lean 7 (PR #78) — instagram-story-style member bubbles
            above the widget grid, mirroring the member Overview
            pattern from PR #61. Same component, same query cache. */}
        <MemberHighlights actions={<SocialStatsBar />} />
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={ADMIN_SCOPE}
          definitions={ADMIN_WIDGET_DEFINITIONS}
          // PR #31 — controls bar hidden; drag-reorder + expand-to-modal
          // still work via each widget's frame.
          controlsDescription=""
          showControls={false}
        />
      </div>
    </AdminOverviewProvider>
  )
}
