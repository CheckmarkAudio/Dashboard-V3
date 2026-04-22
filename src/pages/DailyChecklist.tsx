import { useDocumentTitle } from '../hooks/useDocumentTitle'
import MyTasksCard from '../components/tasks/MyTasksCard'
import { StudioAssignedTasksCard, TeamAssignedTasksCard } from '../components/tasks/AssignedTaskBoards'

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')

  return (
    <div className="max-w-[1280px] mx-auto animate-fade-in">
      <h1 className="text-[44px] font-bold tracking-[-0.04em] leading-none text-text mb-6">Tasks</h1>

      {/* Three equal columns, left-to-right: My Tasks · Studio Tasks · Team Tasks.
          On narrow viewports they stack into a single column. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <MyTasksCard />
        <StudioAssignedTasksCard />
        <TeamAssignedTasksCard />
      </div>
    </div>
  )
}
