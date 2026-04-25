import { useState } from 'react'
import { Calendar, Pencil } from 'lucide-react'
import AdminEditTasksModal from './AdminEditTasksModal'
import AdminEditSessionsModal from '../sessions/AdminEditSessionsModal'

/**
 * AdminEditWidget (widget id `admin_edit_tasks`) — PR #43.
 *
 * Compact "Edit" surface on the Assign page. Two buttons side by
 * side: Edit Task (PR #40 modal) and Edit Session (PR #43 modal).
 * Widget id kept stable so saved layouts keep resolving; the
 * display title in the registry is just "Edit" now.
 *
 * PR #40 shipped this as a single-button count-widget; PR #43
 * upgrades it to a twin-button chip per the user sketch.
 */
export default function AdminEditTasksWidget() {
  const [mode, setMode] = useState<'tasks' | 'sessions' | null>(null)

  return (
    <div className="flex flex-col h-full justify-center">
      <div className="grid grid-cols-2 gap-2">
        <EditButton
          icon={<Pencil size={14} strokeWidth={2.5} />}
          label="Edit Task"
          onClick={() => setMode('tasks')}
        />
        <EditButton
          icon={<Calendar size={14} strokeWidth={2.5} />}
          label="Edit Booking"
          onClick={() => setMode('sessions')}
        />
      </div>

      {mode === 'tasks' && <AdminEditTasksModal onClose={() => setMode(null)} />}
      {mode === 'sessions' && <AdminEditSessionsModal onClose={() => setMode(null)} />}
    </div>
  )
}

function EditButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-b from-gold/15 to-gold/5 text-gold ring-1 ring-gold/30 hover:from-gold/20 hover:to-gold/10 transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}
