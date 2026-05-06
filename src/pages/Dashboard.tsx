import { LayoutDashboard } from 'lucide-react'
import { MemberOverviewProvider } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'
import MemberHighlights, { SocialStatsBar } from '../components/members/MemberHighlights'

const MEMBER_SCOPE = 'member_overview' as const

// Skin pass 2026-05-06 — local BookButton + CreateBookingModal wiring
// removed. Book a Session now lives in the global Layout header so
// it's visible on every page. Page action slot kept for the social
// stats bar.

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-3">
      <MemberOverviewProvider>
        <PageHeader
          icon={LayoutDashboard}
          title="Overview"
          actions={<SocialStatsBar />}
        />
        <MemberHighlights />
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={MEMBER_SCOPE}
          definitions={MEMBER_WIDGET_DEFINITIONS}
          controlsDescription=""
          showControls={false}
        />
      </MemberOverviewProvider>
    </div>
  )
}
