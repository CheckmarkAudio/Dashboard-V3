import { useState } from 'react'
import { useChecklist, type GroupedItems } from '../hooks/useChecklist'
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  const categories = Object.keys(grouped)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Checklist</h1>
          <p className="text-text-muted text-sm mt-1">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' - '}
            {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-1.5 text-sm font-medium bg-surface-alt hover:bg-surface-hover rounded-lg transition-colors"
          >
            This Week
          </button>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <ListChecks size={16} className="text-brand-500" />
            Weekly Progress
          </span>
          <span className="text-sm font-bold">{completedCount}/{totalCount}</span>
        </div>
        <div className="h-3 bg-surface-alt rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: percentage === 100 ? '#10b981' : percentage > 50 ? '#3b82f6' : '#f59e0b',
            }}
          />
        </div>
        {percentage === 100 && totalCount > 0 && (
          <p className="text-sm text-emerald-600 font-medium mt-2">All tasks completed!</p>
        )}
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center shadow-sm">
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
            className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden animate-slide-up"
            style={{ animationDelay: `${catIdx * 60}ms` }}
          >
            <button
              onClick={() => toggle(category)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-alt/50 transition-colors"
            >
              <span className="text-lg">{emoji}</span>
              <span className="font-semibold text-sm flex-1 text-left">{category}</span>
              <span className="text-xs text-text-muted font-medium">
                {done}/{items.length}
              </span>
              <ChevronLeft
                size={16}
                className={`text-text-light transition-transform duration-200 ${isCollapsed ? '' : '-rotate-90'}`}
              />
            </button>

            {!isCollapsed && (
              <div className="border-t border-border divide-y divide-border/50">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-alt/50 transition-colors group text-left"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        item.is_completed
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-slate-300 group-hover:border-brand-400'
                      }`}
                    >
                      {item.is_completed && <Check size={14} className="text-white" />}
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
