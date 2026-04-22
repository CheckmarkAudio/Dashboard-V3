import { useDocumentTitle } from '../hooks/useDocumentTitle'
import MyTasksCard from '../components/tasks/MyTasksCard'
import { StudioAssignedTasksCard, TeamAssignedTasksCard } from '../components/tasks/AssignedTaskBoards'

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')

  return (
    <div className="max-w-[1280px] mx-auto animate-fade-in">
      <h1 className="text-[44px] font-bold tracking-[-0.04em] leading-none text-text mb-6">Tasks</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <TeamAssignedTasksCard />
        <div className="flex flex-col gap-4 min-w-0">
          <MyTasksCard />
          <StudioAssignedTasksCard />
        </div>
      </div>
    </div>
  )
}
