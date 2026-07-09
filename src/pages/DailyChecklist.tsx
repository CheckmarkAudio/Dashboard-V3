import { useMemo, useState, type ReactNode } from 'react'
import {
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  type LucideIcon,
  MonitorCog,
  Users,
} from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PageHeader } from '../components/ui'
import MyTasksCard from '../components/tasks/MyTasksCard'
import {
  StudioAssignedTasksCard,
  TeamAssignedTasksCard,
} from '../components/tasks/AssignedTaskBoards'
import TeamChecklistWidget from '../components/checklist/TeamChecklistWidget'

/**
 * Tasks page — `/daily`
 *
 * Worker-obviousness pass — starts on My Tasks, then lets the user
 * switch into secondary contexts from a sidebar. The old WorkspacePanel
 * rendered every task widget as equal-weight columns; this page now
 * keeps the existing task bodies but shows only one context at a time.
 *
 * File name stays `DailyChecklist` for backward compat with route
 * mapping; the page title stays 'Tasks'.
 */
type TaskPaneId = 'my_tasks' | 'checklist' | 'team_tasks' | 'studio_tasks'

interface TaskPane {
  id: TaskPaneId
  title: string
  subtitle: string
  icon: LucideIcon
  render: () => ReactNode
}

const TASK_PANES: TaskPane[] = [
  {
    id: 'my_tasks',
    title: 'My Tasks',
    subtitle: 'Your personal queue',
    icon: ListChecks,
    render: () => <MyTasksCard embedded />,
  },
  {
    id: 'checklist',
    title: 'Checklist',
    subtitle: 'Team maintenance checks',
    icon: ClipboardCheck,
    render: () => <TeamChecklistWidget />,
  },
  {
    id: 'team_tasks',
    title: 'Team Tasks',
    subtitle: 'Shared member work',
    icon: Users,
    render: () => <TeamAssignedTasksCard />,
  },
  {
    id: 'studio_tasks',
    title: 'Studio Tasks',
    subtitle: 'Room and studio work',
    icon: MonitorCog,
    render: () => <StudioAssignedTasksCard />,
  },
]
const DEFAULT_TASK_PANE = TASK_PANES[0]!

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')
  const [activePaneId, setActivePaneId] = useState<TaskPaneId>('my_tasks')
  const activePane = useMemo(
    () => TASK_PANES.find((pane) => pane.id === activePaneId) ?? DEFAULT_TASK_PANE,
    [activePaneId],
  )
  const ActiveIcon = activePane.icon

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        icon={ListChecks}
        title="Tasks"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
        <aside
          className="bg-surface rounded-xl border border-border p-2 space-y-1 lg:sticky lg:top-28"
          aria-label="Task sections"
        >
          <p className="hidden lg:block px-3 pt-3 pb-2 text-label">Tasks</p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {TASK_PANES.map((pane) => {
              const Icon = pane.icon
              const active = activePane.id === pane.id
              return (
                <button
                  key={pane.id}
                  type="button"
                  onClick={() => setActivePaneId(pane.id)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'min-w-[180px] lg:min-w-0 w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 focus-ring',
                    active ? 'bg-surface-alt ring-1 ring-border-light' : 'hover:bg-surface-hover',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-surface',
                      active ? 'text-gold' : 'text-text-muted',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-semibold text-text">{pane.title}</span>
                    <span className="block text-[12px] text-text-muted truncate">{pane.subtitle}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="bg-surface rounded-xl border border-border lg:min-h-[620px] overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border">
            <div className="min-w-0 flex items-center gap-3">
              <span
                className="shrink-0 w-9 h-9 rounded-lg bg-surface-alt ring-1 ring-border flex items-center justify-center text-gold"
                aria-hidden="true"
              >
                <ActiveIcon size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-text truncate">{activePane.title}</h2>
                <p className="text-[12px] text-text-muted truncate">{activePane.subtitle}</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
              <ClipboardList size={12} aria-hidden="true" />
              Focus view
            </span>
          </header>

          <div className="p-3 sm:p-4 lg:min-h-[560px] lg:h-[calc(100vh-15rem)] lg:max-h-[860px]">
            {activePane.render()}
          </div>
        </section>
      </div>
    </div>
  )
}
