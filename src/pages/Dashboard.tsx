import { useState } from 'react'
import { LayoutDashboard, Plus } from 'lucide-react'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader, Button } from '../components/ui'
import MemberHighlights from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'

const MEMBER_SCOPE = 'member_overview' as const

function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowBooking(true)}
        iconLeft={<Plus size={14} aria-hidden="true" />}
      >
        Book a Session
      </Button>
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
