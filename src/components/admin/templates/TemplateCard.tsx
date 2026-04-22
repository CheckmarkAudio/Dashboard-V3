import { FileText, GraduationCap, Tag } from 'lucide-react'
import type { TaskTemplateLibraryEntry } from '../../../types/assignments'

/**
 * TemplateCard — one tile in the Assign-page grid.
 *
 * Whole card is a click target that opens the preview modal.
 * Compact info: title (2-line clamp), role_tag pill, item count,
 * onboarding badge when set. Archived templates get a muted tint.
 */

interface TemplateCardProps {
  template: TaskTemplateLibraryEntry
  onClick: () => void
}

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  const { name, description, role_tag, item_count, is_onboarding, is_active } = template
  const muted = !is_active

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[260px] text-left rounded-2xl border bg-gradient-to-b from-[rgba(23,26,33,0.92)] to-[rgba(19,22,28,0.92)] p-5 flex flex-col transition-all hover:-translate-y-[1px] hover:border-gold/40 focus-ring ${
        muted
          ? 'border-white/[0.05] opacity-60 hover:opacity-100'
          : 'border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.35)]'
      }`}
    >
      {/* Top: eyebrow with role tag + onboarding badge */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        {role_tag && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 ring-1 ring-gold/25 text-gold text-[10px] font-bold uppercase tracking-wider">
            <Tag size={10} aria-hidden="true" />
            {role_tag}
          </span>
        )}
        {is_onboarding && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/25 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
            <GraduationCap size={10} aria-hidden="true" />
            Onboarding
          </span>
        )}
        {!is_active && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.05] text-text-light text-[10px] font-bold uppercase tracking-wider">
            Archived
          </span>
        )}
      </div>

      {/* Title — 2-line clamp */}
      <h3 className="text-[17px] font-bold text-text leading-tight line-clamp-2">
        {name}
      </h3>

      {/* Description — optional, 2-line clamp */}
      {description && (
        <p className="mt-1.5 text-[12px] text-text-light leading-snug line-clamp-2">
          {description}
        </p>
      )}

      {/* Spacer pushes footer to the bottom */}
      <div className="flex-1" aria-hidden="true" />

      {/* Footer: item count + view affordance */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.05] shrink-0">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <FileText size={11} aria-hidden="true" />
          {item_count} {item_count === 1 ? 'task' : 'tasks'}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gold/80">
          View →
        </span>
      </div>
    </button>
  )
}
