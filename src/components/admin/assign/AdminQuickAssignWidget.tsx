import { useState } from 'react'
import { Sparkles, ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdminTaskCreateModal from '../../tasks/requests/AdminTaskCreateModal'

/**
 * AdminQuickAssignWidget — compact Hub-side task compose (PR #19).
 *
 * The full Assign widget (three tiles + recently-assigned feed) lives
 * on `/admin/templates` per the latest reorg. The Hub keeps just a
 * quick-entry affordance: one big CTA that opens the unified
 * AdminTaskCreateModal. Anything more (booking a session, assigning
 * a template group) is one click away on the Assign page.
 *
 * Matches the "Hub = snapshot + quick actions" framing — admins glance
 * at status on the Hub and fire a single task without navigating.
 */

export default function AdminQuickAssignWidget() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold/15 ring-1 ring-gold/30 text-gold">
          <Sparkles size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
            QUICK ASSIGN
          </p>
          <h2 className="text-[15px] font-bold tracking-tight text-text">
            Send work fast
          </h2>
        </div>
      </div>

      <p className="text-[12px] text-text-light leading-snug mb-3">
        One-off task to a member or the whole studio. Same modal as every
        other task surface.
      </p>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring"
      >
        <Plus size={14} aria-hidden="true" />
        New task
      </button>

      {/* Soft link to the comprehensive surface — sessions, task groups,
          templates all live on the Assign page now. */}
      <Link
        to="/admin/templates"
        className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-light hover:text-gold transition-colors pt-3"
      >
        Session, task group, or template
        <ArrowRight size={11} aria-hidden="true" />
      </Link>

      {modalOpen && <AdminTaskCreateModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
