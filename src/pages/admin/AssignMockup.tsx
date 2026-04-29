import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, ChevronRight, ClipboardList, Edit2, Layers, Loader2, Plus,
  Save, Settings, Sparkles, Users,
} from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { Button } from '../../components/ui'
import type { TeamMember } from '../../types'

/**
 * AssignMockup (PR #52, draft) — visual mock-up of the new Assign
 * page based on the boss's sketch (2026-04-29). NOT WIRED to real
 * task data yet. Goal: show the layout + interaction model so the
 * user can react before we commit to the full rebuild.
 *
 * Layout per the sketch:
 *   - Left sidebar (260px): Members list · Templates link · "Other"
 *   - Main content: Settings | Save as template | Templates ▾
 *                   "All Tasks for Selected Member"
 *                   Two-column task list with Edit button per row
 *
 * Real data:
 *   - Members come from `team_members` (real fetch via useQuery)
 *   - Tasks are PLACEHOLDER for now — when the real rebuild starts
 *     we'll wire `get_team_assigned_tasks` filtered by `assigned_to`
 *
 * The existing /admin/templates page is left intact during this
 * visual pass. This mockup lives at /admin/assign-mockup so both
 * are visitable side-by-side.
 */

interface MockTask {
  id: string
  title: string
  done: boolean
}

// Placeholder tasks per member — replaced with real `assigned_tasks`
// fetched by `assigned_to` in the production rebuild.
const MOCK_TASKS_BY_MEMBER: Record<string, MockTask[]> = {
  default: [
    { id: 'm1', title: 'Set up profile photo',         done: true  },
    { id: 'm2', title: 'Read the brand guide',         done: true  },
    { id: 'm3', title: 'Connect to content calendar',  done: false },
    { id: 'm4', title: 'Shadow two client sessions',   done: false },
    { id: 'm5', title: 'Submit first weekly report',   done: false },
    { id: 'm6', title: 'Review last quarter KPIs',     done: false },
    { id: 'm7', title: 'Prep onboarding checklist',    done: false },
    { id: 'm8', title: 'Sync with manager',            done: false },
  ],
}

// Placeholder templates — real ones come from `task_templates`.
const MOCK_TEMPLATES = [
  { id: 't1', name: 'Engineer Onboarding',  itemCount: 6 },
  { id: 't2', name: 'Marketing Onboarding', itemCount: 4 },
  { id: 't3', name: 'Studio Maintenance',   itemCount: 3 },
  { id: 't4', name: 'Weekly Review Cycle',  itemCount: 5 },
]

export default function AssignMockup() {
  useDocumentTitle('Assign (mockup) - Checkmark Workspace')

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  const activeMembers = useMemo(
    () => members.filter((m) => m.status?.toLowerCase() !== 'inactive'),
    [members],
  )

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const selectedMember = activeMembers.find((m) => m.id === selectedMemberId)
    ?? activeMembers[0]
  const tasks: MockTask[] = MOCK_TASKS_BY_MEMBER.default ?? []

  const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState(false)

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in">
      {/* Mockup banner — clearly marks this as a draft surface. */}
      <div className="mb-4 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-[12px] text-gold flex items-center gap-2">
        <Sparkles size={14} aria-hidden="true" />
        <span className="font-semibold">Visual mock-up</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">
          Per boss's sketch (2026-04-29). Tasks are placeholder data — react to the layout, then we'll wire it up for real.
        </span>
      </div>

      {/* Two-column shell: Sidebar | Main content */}
      <div className="grid grid-cols-[260px_1fr] gap-4">
        {/* ─── Sidebar ───────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-border bg-surface p-3 h-fit sticky top-4">
          {/* Members */}
          <div>
            <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b border-border/60">
              <Users size={14} className="text-gold" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text">Members</h2>
              {activeMembers.length > 0 && (
                <span className="ml-auto text-[11px] text-text-light tabular-nums">
                  {activeMembers.length}
                </span>
              )}
            </div>
            {teamQuery.isLoading ? (
              <div className="px-3 py-4 text-text-light flex items-center gap-2 text-[12px]">
                <Loader2 size={14} className="animate-spin" />
                Loading…
              </div>
            ) : (
              <ul className="space-y-1">
                {activeMembers.map((m) => {
                  const isSelected = (selectedMember?.id ?? activeMembers[0]?.id) === m.id
                  const initial = m.display_name?.charAt(0)?.toUpperCase() ?? '?'
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-left ${
                          isSelected
                            ? 'bg-gold/12 ring-1 ring-gold/30'
                            : 'hover:bg-surface-hover'
                        }`}
                      >
                        <div
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            isSelected
                              ? 'bg-gold/25 ring-1 ring-gold/40 text-gold'
                              : 'bg-surface-alt border border-border-light text-text-muted'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] truncate ${
                              isSelected ? 'font-bold text-text' : 'font-semibold text-text-muted'
                            }`}
                          >
                            {m.display_name}
                          </p>
                          {m.position && (
                            <p className="text-[10px] text-text-light truncate">
                              {m.position.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <ChevronRight size={12} className="text-gold shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Templates link */}
          <div className="mt-4 pt-3 border-t border-border/60">
            <a
              href="/admin/templates"
              className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-hover transition-colors group"
            >
              <Layers size={14} className="text-gold/70 group-hover:text-gold" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text">Templates</p>
                <p className="text-[10px] text-text-light">Manage on Templates page</p>
              </div>
              <ChevronRight size={12} className="text-text-light shrink-0" aria-hidden="true" />
            </a>
          </div>

          {/* Other assign pages — placeholder per sketch */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="px-2 text-[10px] uppercase tracking-wider text-text-light/70 font-semibold">
              Other
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <span className="block px-2 py-1.5 text-[11px] text-text-light italic">
                  (Reserved for future assign pages)
                </span>
              </li>
            </ul>
          </div>
        </aside>

        {/* ─── Main content ──────────────────────────────────────── */}
        <main>
          {/* Top action bar — Settings · Save as template · Templates ▾ */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Settings size={14} aria-hidden="true" />}
              disabled
              title="Coming soon"
            >
              Settings for Tasks
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Save size={14} aria-hidden="true" />}
              disabled
              title="Coming soon"
            >
              Save as Template
            </Button>

            <div className="ml-auto relative">
              <Button
                variant="primary"
                size="sm"
                iconLeft={<ClipboardList size={14} aria-hidden="true" />}
                onClick={() => setTemplatesDropdownOpen((v) => !v)}
              >
                Templates
                <ChevronDown
                  size={14}
                  className={`ml-1 transition-transform ${templatesDropdownOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Button>
              {templatesDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                  <p className="px-3 py-2 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    Add a template's tasks
                  </p>
                  <ul>
                    {MOCK_TEMPLATES.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setTemplatesDropdownOpen(false)}
                          className="w-full text-left px-3 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-2"
                        >
                          <Layers size={12} className="text-gold/70" aria-hidden="true" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold text-text truncate">
                              {t.name}
                            </span>
                            <span className="block text-[10px] text-text-light">
                              {t.itemCount} tasks · adds to {selectedMember?.display_name ?? 'selected member'}
                            </span>
                          </span>
                          <Plus size={12} className="text-gold shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Title row */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-text">
                  All Tasks for {selectedMember?.display_name ?? 'Selected Member'}
                </h1>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {tasks.length} tasks · {tasks.filter((t) => t.done).length} complete
                </p>
              </div>
              <Button variant="secondary" size="sm" iconLeft={<Plus size={14} aria-hidden="true" />}>
                Add Task
              </Button>
            </div>

            {/* Two-column task list */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 relative">
              {/* Vertical divider — matches the sketch */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-px bg-border/60 -translate-x-1/2"
                aria-hidden="true"
              />
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>

          {/* Footer note — clarifies what's mock + what comes next */}
          <p className="mt-4 px-1 text-[11px] text-text-light italic">
            Placeholder tasks. The real version will fetch <code className="px-1 py-0.5 rounded bg-surface-alt text-[10px]">assigned_tasks</code> filtered by <code className="px-1 py-0.5 rounded bg-surface-alt text-[10px]">assigned_to = selectedMember.id</code> and wire the Edit button to the existing AdminEditTasksModal.
          </p>
        </main>
      </div>
    </div>
  )
}

// ─── Task row atom ──────────────────────────────────────────────────

function TaskRow({ task }: { task: MockTask }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors group">
      <input
        type="checkbox"
        checked={task.done}
        readOnly
        className="w-4 h-4 rounded border-border accent-gold cursor-not-allowed"
        aria-label={`${task.done ? 'Completed' : 'Open'} — ${task.title}`}
      />
      <span
        className={`flex-1 min-w-0 text-[13px] truncate ${
          task.done ? 'line-through text-text-light' : 'text-text'
        }`}
      >
        {task.title}
      </span>
      <button
        type="button"
        title="Edit task (mockup — not wired)"
        className="p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-gold transition-all focus-ring"
      >
        <Edit2 size={12} aria-hidden="true" />
      </button>
    </div>
  )
}
