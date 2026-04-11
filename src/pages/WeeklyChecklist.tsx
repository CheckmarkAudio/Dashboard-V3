import { useState } from 'react'
import { useChecklist, type GroupedItems } from '../hooks/useChecklist'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  Check, ChevronLeft, ChevronRight, ListChecks,
} from 'lucide-react'

const CATEGORY_META: Record<string, string> = {
  'Content & Marketing': '📱',
  'Lead Generation & Follow-Up': '🎯',
  'Studio Operations': '🔧',
  'Systems & Documentation': '📝',
  'Artist & Project Support': '🎨',
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export default function WeeklyChecklist() {
  useDocumentTitle('Weekly Review - Checkmark Audio')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const { grouped, loading, toggleItem, completedCount, totalCount, percentage } =
    useChecklist('weekly', weekStart)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 4)

  const shiftWeek = (dir: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  const categories = Object.keys(grouped)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Weekly Review</h1>
          <p className="text-text-muted text-sm mt-1">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' — '}
            {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted" aria-label="Previous week">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-1.5 text-sm font-medium bg-surface-alt hover:bg-surface-hover rounded-lg transition-colors text-text-muted"
          >
            This Week
          </button>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted" aria-label="Next week">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-2 text-text-muted">
            <ListChecks size={16} className="text-gold" aria-hidden="true" />
            Weekly Progress
          </span>
          <span className="text-sm font-bold text-text">{completedCount}/{totalCount}</span>
        </div>
        <div
          className="h-3 bg-surface-alt rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Weekly progress: ${percentage}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: percentage === 100 ? '#10b981' : percentage > 50 ? '#C9A84C' : '#f59e0b',
            }}
          />
        </div>
        {percentage === 100 && totalCount > 0 && (
          <p className="text-sm text-emerald-400 font-medium mt-2" aria-live="polite">All tasks completed!</p>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <ListChecks size={40} className="mx-auto mb-3 text-text-light opacity-40" />
          <p className="text-text-muted font-medium">No weekly checklist items</p>
          <p className="text-sm text-text-light mt-1">Tasks are auto-generated each week.</p>
        </div>
      ) : (
        <CategoryList grouped={grouped} toggleItem={toggleItem} />
      )}
    </div>
  )
}

function CategoryList({
  grouped,
  toggleItem,
}: {
  grouped: GroupedItems
  toggleItem: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (cat: string) =>
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, items], catIdx) => {
        const done = items.filter(i => i.is_completed).length
        const emoji = CATEGORY_META[category] ?? '📌'
        const isCollapsed = collapsed[category]

        return (
          <div
            key={category}
            className="bg-surface rounded-2xl border border-border overflow-hidden animate-slide-up"
            style={{ animationDelay: `${catIdx * 60}ms` }}
          >
            <button
              onClick={() => toggle(category)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-alt/50 transition-colors"
              aria-expanded={!isCollapsed}
              aria-controls={`weekly-cat-${catIdx}`}
            >
              <span className="text-lg" aria-hidden="true">{emoji}</span>
              <span className="font-semibold text-sm flex-1 text-left text-text">{category}</span>
              <span className="text-xs text-text-muted font-medium">
                {done}/{items.length}
              </span>
              <ChevronLeft
                size={16}
                aria-hidden="true"
                className={`text-text-light transition-transform duration-200 ${isCollapsed ? '' : '-rotate-90'}`}
              />
            </button>

            {!isCollapsed && (
              <div id={`weekly-cat-${catIdx}`} className="border-t border-border divide-y divide-border/50">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    aria-pressed={item.is_completed}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-alt/50 transition-colors group text-left"
                  >
                    <div
                      aria-hidden="true"
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        item.is_completed
                          ? 'bg-gold border-gold'
                          : 'border-text-light group-hover:border-gold'
                      }`}
                    >
                      {item.is_completed && <Check size={14} className="text-black" />}
                    </div>
                    <span
                      className={`text-sm transition-all ${
                        item.is_completed ? 'text-text-light line-through' : 'text-text'
                      }`}
                    >
                      {item.item_text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
