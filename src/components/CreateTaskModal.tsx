import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTasks, STAGE_COLORS, type TaskCategory } from '../contexts/TaskContext'
import { X } from 'lucide-react'

const KPI_STAGES: { key: TaskCategory; label: string; color: string }[] = [
  { key: 'Deliver', label: 'Deliver', color: STAGE_COLORS.Deliver ?? '#34d399' },
  { key: 'Capture', label: 'Capture', color: STAGE_COLORS.Capture ?? '#38bdf8' },
  { key: 'Share', label: 'Share', color: STAGE_COLORS.Share ?? '#a78bfa' },
  { key: 'Attract', label: 'Attract', color: STAGE_COLORS.Attract ?? '#fbbf24' },
]

const OTHER_CATEGORIES: { key: TaskCategory; label: string }[] = [
  { key: 'Administrative', label: 'Administrative' },
  { key: 'Coding', label: 'Coding' },
  { key: 'Maintenance', label: 'Maintenance' },
]

const today = () => new Date().toISOString().split('T')[0] ?? ''

export default function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const { addTask } = useTasks()
  const { profile } = useAuth()

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [assignee, setAssignee] = useState(profile?.display_name ?? 'You')
  const [recurring, setRecurring] = useState<false | 'daily' | 'weekly' | 'monthly'>(false)
  const [highPriority, setHighPriority] = useState(false)
  const [category, setCategory] = useState<TaskCategory>('Deliver')

  const canSubmit = title.trim() && dueDate

  const handleSubmit = () => {
    if (!canSubmit) return
    const isKpi = ['Deliver', 'Capture', 'Share', 'Attract'].includes(category)
    addTask({
      title: title.trim(),
      priority: highPriority,
      due: dueDate,
      startDate,
      assignee,
      stage: isKpi ? category : category,
      category,
      recurring,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text">Create Task</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Task description */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Task Description</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold"
            />
          </div>

          {/* Due date + Start date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold" />
            </div>
          </div>

          {/* Assigned to */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Assigned To</label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold"
            />
          </div>

          {/* Recurring toggle */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Recurring</label>
            <div className="flex gap-1.5">
              {([false, 'daily', 'weekly', 'monthly'] as const).map(opt => (
                <button
                  key={String(opt)}
                  onClick={() => setRecurring(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    recurring === opt ? 'bg-gold/10 text-gold border-gold/30' : 'bg-surface-alt text-text-muted border-border hover:text-text'
                  }`}
                >
                  {opt === false ? 'Off' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* High priority toggle */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">High Priority</label>
            <button
              onClick={() => setHighPriority(!highPriority)}
              className={`w-10 h-5 rounded-full transition-all relative ${highPriority ? 'bg-red-500/30' : 'bg-surface-alt border border-border'}`}
            >
              <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-all ${highPriority ? 'left-5.5 bg-red-400' : 'left-0.5 bg-text-light'}`} style={highPriority ? { left: 22 } : { left: 2 }} />
            </button>
            {highPriority && <span className="text-[10px] font-bold text-red-400 uppercase">High</span>}
          </div>

          {/* KPI Assignment */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">KPI Assignment</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KPI_STAGES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setCategory(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    category === s.key ? 'shadow-sm' : 'bg-surface-alt text-text-muted border-border hover:text-text'
                  }`}
                  style={category === s.key ? { color: s.color, backgroundColor: s.color + '18', borderColor: s.color + '50' } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OTHER_CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    category === c.key ? 'bg-gold/10 text-gold border-gold/30' : 'bg-surface-alt text-text-muted border-border hover:text-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`mt-5 w-full py-3 rounded-xl text-sm font-bold transition-all ${
            canSubmit ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light cursor-not-allowed border border-border'
          }`}
        >
          Create Task
        </button>
      </div>
    </div>
  )
}
