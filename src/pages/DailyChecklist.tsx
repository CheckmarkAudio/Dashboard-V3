import { useMemo, useState, type ReactNode } from 'react'
import {
  ClipboardList,
  LayoutGrid,
  ListChecks,
  MonitorCog,
  Users,
} from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { Button, PageHeader } from '../components/ui'
import MyTasksCard from '../components/tasks/MyTasksCard'
import {
  StudioAssignedTasksCard,
  TeamAssignedTasksCard,
} from '../components/tasks/AssignedTaskBoards'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { TASKS_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { AdminSectionNavItem, type AdminSection } from '../components/admin/AdminSectionNavItem'

/**
 * Tasks page — `/daily`
 *
 * Worker-obviousness pass — starts on My Tasks, then lets the user
 * switch into secondary contexts from a sidebar. The old WorkspacePanel
 * rendered every task widget as equal-weight columns; that layout remains
 * available as a page-level Widget View toggle.
 *
 * File name stays `DailyChecklist` for backward compat with route
 * mapping; the page title stays 'Tasks'.
 */
type TaskPaneId = 'my_tasks' | 'team_tasks' | 'studio_tasks'
type TaskViewMode = 'focused' | 'widgets'

type TaskPane = AdminSection<TaskPaneId>

const TASK_PANES: TaskPane[] = [
  {
    key: 'my_tasks',
    title: 'My Tasks',
    subtitle: 'Your personal queue',
    icon: ListChecks,
  },
  {
    key: 'team_tasks',
    title: 'Team Tasks',
    subtitle: 'Shared member work',
    icon: Users,
  },
  {
    key: 'studio_tasks',
    title: 'Studio Tasks',
    subtitle: 'Room and studio work',
    icon: MonitorCog,
  },
]
const DEFAULT_TASK_PANE = TASK_PANES[0]!

function renderTaskPane(paneId: TaskPaneId): ReactNode {
  switch (paneId) {
    case 'team_tasks':
      return <TeamAssignedTasksCard />
    case 'studio_tasks':
      return <StudioAssignedTasksCard />
    case 'my_tasks':
    default:
      return <MyTasksCard embedded />
  }
}

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')
  const { profile, appRole } = useAuth()
  const [activePaneId, setActivePaneId] = useState<TaskPaneId>('my_tasks')
  const [viewMode, setViewMode] = useState<TaskViewMode>('focused')
  const activePane = useMemo(
    () => TASK_PANES.find((pane) => pane.key === activePaneId) ?? DEFAULT_TASK_PANE,
    [activePaneId],
  )
  const ActiveIcon = activePane.icon
  const activePaneBody = renderTaskPane(activePane.key)
  const showingWidgetView = viewMode === 'widgets'

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        icon={ListChecks}
        title="Tasks"
        actions={
          <Button
            variant="secondary"
            onClick={() => setViewMode(showingWidgetView ? 'focused' : 'widgets')}
            iconLeft={
              showingWidgetView
                ? <ListChecks size={16} aria-hidden="true" />
                : <LayoutGrid size={16} aria-hidden="true" />
            }
          >
            {showingWidgetView ? 'Main View' : 'Widget View'}
          </Button>
        }
      />

      {showingWidgetView ? (
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope="member_tasks"
          definitions={TASKS_WIDGET_DEFINITIONS}
          controlsDescription=""
          showControls={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-stretch">
          <aside
            className="bg-surface rounded-xl border border-border p-2 space-y-1 h-full"
            aria-label="Task sections"
          >
            <p className="px-3 pt-3 pb-2 text-label">Tasks</p>
            {TASK_PANES.map((pane) => (
              <AdminSectionNavItem
                key={pane.key}
                section={pane}
                active={activePane.key === pane.key}
                onSelect={() => setActivePaneId(pane.key)}
              />
            ))}
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
                One group
              </span>
            </header>

            <div className="p-3 sm:p-4 lg:min-h-[560px] lg:h-[calc(100vh-15rem)] lg:max-h-[860px]">
              {activePaneBody}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
