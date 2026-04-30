import { useState } from 'react'
import { LayoutDashboard, Plus } from 'lucide-react'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'
import MemberHighlights from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'

const MEMBER_SCOPE = 'member_overview' as const

/**
 * Book-a-Session CTA — gold gradient pill matching the Sessions page
 * "Book a Session" button (PR #65 unifies them) so the action looks
 * the same wherever it appears. Shadow is the standardized
 * `shadow-[0_6px_14px_rgba(214,170,55,0.18)]` — ~60% lighter than the
 * earlier `0_14px_28px` feathering. h-10 / px-4 / rounded-2xl /
 * font-extrabold matches the top-nav active-pill rhythm.
 */
function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold tracking-tight hover:brightness-105 transition-all shadow-[0_6px_14px_rgba(214,170,55,0.18)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        Book a Session
      </button>
      {showBooking && (
        <CreateBookingModal
          onClose={() => {
            setShowBooking(false)
            void refetch()
          }}
        />
      )}
    </>
  )
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-6">
      <MemberOverviewProvider>
        <PageHeader
          icon={LayoutDashboard}
          title="Overview"
          actions={<BookButton />}
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
