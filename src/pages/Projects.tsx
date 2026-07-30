import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  ListTodo,
  MessageSquarePlus,
  Plus,
  Trash2,
  Target,
  X,
} from 'lucide-react'
import { Button, EmptyState, Input, PageHeader, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { completeAssignedTask } from '../lib/queries/assignments'
import {
  addProjectProgressNote,
  addProjectObjective,
  addProjectObjectiveTask,
  completeProjectObjective,
  createProject,
  fetchProjectDetail,
  fetchProjects,
  projectKeys,
  type Project,
  type ProjectObjective,
  type ProjectTask,
} from '../lib/queries/projects'
import { memberActivityKeys } from '../lib/activity/queries'

function dateLabel(value: string | null): string {
  if (!value) return 'No target date'
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [, setSearchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [objectives, setObjectives] = useState([''])
  const [targetDate, setTargetDate] = useState('')

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      setSearchParams({ project: project.id })
      toast('Project created — add the first next task.', 'success')
      onClose()
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    mutation.mutate({
      title: title.trim(),
      description: description.trim(),
      targetDate,
      objectives: objectives.map((item) => item.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gold/35 bg-gold/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-text">Create a project</h2>
          <p className="mt-1 text-xs text-text-muted">Add context, then turn the major outcomes into a checklist.</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-text-muted hover:bg-surface-hover focus-ring" aria-label="Close project form">
          <X size={16} />
        </button>
      </div>
      <Input
        label="Project name"
        required
        autoFocus
        placeholder="Example: Rebuild the client portal"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Textarea
        label="Description"
        hint="Line breaks and dashes will be preserved exactly as written."
        rows={4}
        placeholder="Website revamp and migration."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-muted">Objective checklist</legend>
        <p className="text-xs text-text-light">Each objective becomes a checkable umbrella for its own subtasks.</p>
        {objectives.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-xs font-bold text-gold">
              {index + 1}
            </span>
            <Input
              wrapperClassName="flex-1"
              aria-label={`Objective ${index + 1}`}
              placeholder={index === 0 ? 'Example: Improve SEO' : 'Add another objective'}
              value={item}
              onChange={(event) => setObjectives((current) => current.map((value, itemIndex) => (
                itemIndex === index ? event.target.value : value
              )))}
            />
            {objectives.length > 1 && (
              <button
                type="button"
                onClick={() => setObjectives((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="p-2 rounded-lg text-text-light hover:bg-red-500/10 hover:text-red-400 focus-ring"
                aria-label={`Remove objective ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus size={14} />}
          onClick={() => setObjectives((current) => [...current, ''])}
        >
          Add objective
        </Button>
      </fieldset>
      <Input
        label="Target date (optional)"
        type="date"
        value={targetDate}
        onChange={(event) => setTargetDate(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending} disabled={!title.trim()} iconLeft={<Plus size={16} />}>
          Create project
        </Button>
      </div>
    </form>
  )
}

function ProjectListCard({
  project,
  selected,
  onSelect,
}: {
  project: Project
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-xl border p-4 transition-colors focus-ring',
        selected
          ? 'border-gold/55 bg-gold/10'
          : 'border-border bg-surface hover:bg-surface-hover',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <FolderKanban size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-bold text-text">{project.title}</h2>
            <ChevronRight size={15} className="shrink-0 text-text-light" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
            {project.objective || 'No outcome summary yet.'}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-text-light">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">Active</span>
            <span>{dateLabel(project.target_date)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function AddSubtaskForm({ projectId, objectiveId }: { projectId: string; objectiveId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const mutation = useMutation({
    mutationFn: addProjectObjectiveTask,
    onSuccess: () => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast('Subtask added.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <form
      className="flex flex-col gap-2 border-t border-border bg-surface-alt/35 p-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) mutation.mutate({ projectId, objectiveId, title: title.trim() })
      }}
    >
      <Input
        wrapperClassName="flex-1"
        aria-label="New objective subtask"
        placeholder="Add a concrete subtask…"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button type="submit" loading={mutation.isPending} disabled={!title.trim()} iconLeft={<Plus size={15} />}>
        Add subtask
      </Button>
    </form>
  )
}

function AddObjectiveForm({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const mutation = useMutation({
    mutationFn: addProjectObjective,
    onSuccess: () => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast('Objective added.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <form
      className="flex flex-col gap-2 border-t border-border bg-surface-alt/35 p-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) mutation.mutate({ projectId, title: title.trim() })
      }}
    >
      <Input
        wrapperClassName="flex-1"
        aria-label="New project objective"
        placeholder="Add another objective umbrella…"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button type="submit" loading={mutation.isPending} disabled={!title.trim()} iconLeft={<Plus size={15} />}>
        Add objective
      </Button>
    </form>
  )
}

function ProjectTaskRow({
  projectId,
  task,
}: {
  projectId: string
  task: ProjectTask
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [writing, setWriting] = useState(false)
  const [note, setNote] = useState('')

  const completeMutation = useMutation({
    mutationFn: (next: boolean) => completeAssignedTask(task.id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: memberActivityKeys.all })
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const noteMutation = useMutation({
    mutationFn: addProjectProgressNote,
    onSuccess: () => {
      setNote('')
      setWriting(false)
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      void queryClient.invalidateQueries({ queryKey: memberActivityKeys.all })
      toast('Progress recorded on the project timeline.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <div id={`task-${task.id}`} className="border-b border-border last:border-b-0 scroll-mt-28">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => completeMutation.mutate(!task.is_completed)}
          disabled={completeMutation.isPending}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-ring disabled:opacity-50"
          aria-label={`${task.is_completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
        >
          {task.is_completed
            ? <CheckCircle2 size={22} className="shrink-0 text-emerald-400" />
            : <Circle size={22} className="shrink-0 text-text-light" />}
          <span className={task.is_completed ? 'truncate text-sm text-text-muted line-through' : 'truncate text-sm font-semibold text-text'}>
            {task.title}
          </span>
        </button>
        <Button
          variant="secondary"
          size="sm"
          className="sm:shrink-0 border-gold/35 text-gold"
          iconLeft={<MessageSquarePlus size={14} />}
          onClick={() => setWriting((value) => !value)}
        >
          Add progress note
        </Button>
      </div>
      {writing && (
        <form
          className="border-t border-border bg-gold/5 p-3 sm:pl-12"
          onSubmit={(event) => {
            event.preventDefault()
            if (note.trim()) noteMutation.mutate({ projectId, taskId: task.id, note: note.trim() })
          }}
        >
          <Textarea
            autoFocus
            label={`Progress on “${task.title}”`}
            hint="This note will appear here and as a clickable marker on your activity bar."
            rows={3}
            placeholder="What changed, what did you learn, or what will you do next?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWriting(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={noteMutation.isPending} disabled={!note.trim()} iconLeft={<Check size={14} />}>
              Record progress
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function ProjectObjectiveSection({
  projectId,
  objective,
  tasks,
}: {
  projectId: string
  objective: ProjectObjective
  tasks: ProjectTask[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const completedTasks = tasks.filter((task) => task.is_completed).length
  const canComplete = tasks.length > 0 && completedTasks === tasks.length
  const mutation = useMutation({
    mutationFn: (next: boolean) => completeProjectObjective(objective.id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast(objective.is_completed ? 'Objective reopened.' : 'Objective completed.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <article className="border-b border-border last:border-b-0">
      <header className="flex flex-col gap-3 bg-surface-alt/45 px-4 py-4 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={mutation.isPending || (!objective.is_completed && !canComplete)}
          onClick={() => mutation.mutate(!objective.is_completed)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-ring disabled:cursor-not-allowed"
          title={!objective.is_completed && !canComplete
            ? (tasks.length === 0 ? 'Add at least one subtask first' : 'Complete every subtask first')
            : undefined}
        >
          {objective.is_completed ? (
            <CheckCircle2 size={24} className="shrink-0 text-emerald-400" />
          ) : (
            <Circle
              size={24}
              className={canComplete ? 'shrink-0 text-gold' : 'shrink-0 text-text-light opacity-55'}
            />
          )}
          <span className="min-w-0">
            <span className={objective.is_completed
              ? 'block truncate text-sm font-bold text-text-muted line-through'
              : 'block truncate text-sm font-bold text-text'}
            >
              {objective.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-text-light">
              {completedTasks}/{tasks.length} subtasks complete
              {!objective.is_completed && canComplete ? ' · Ready to check off' : ''}
            </span>
          </span>
        </button>
        {!objective.is_completed && !canComplete && (
          <span className="text-[11px] font-semibold text-text-light">
            {tasks.length === 0 ? 'Add a subtask to unlock' : 'Finish subtasks to unlock'}
          </span>
        )}
      </header>
      {tasks.length > 0 && (
        <div className="pl-4 sm:pl-8">
          {tasks.map((task) => (
            <ProjectTaskRow key={task.id} projectId={projectId} task={task} />
          ))}
        </div>
      )}
      {!objective.is_completed && (
        <div className="pl-4 sm:pl-8">
          <AddSubtaskForm projectId={projectId} objectiveId={objective.id} />
        </div>
      )}
    </article>
  )
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const query = useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => fetchProjectDetail(projectId),
  })

  useEffect(() => {
    if (!query.data) return
    const taskId = new URLSearchParams(window.location.search).get('task')
    if (!taskId) return
    window.setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }, [query.data])

  if (query.isLoading) {
    return <div className="min-h-[560px] animate-pulse rounded-xl border border-border bg-surface" />
  }
  if (query.error || !query.data) {
    return (
      <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-6 text-sm text-red-300">
        {(query.error as Error | null)?.message ?? 'Project not found.'}
      </div>
    )
  }

  const { project, objectives, tasks, updates } = query.data
  const completedObjectives = objectives.filter((objective) => objective.is_completed).length
  const progress = objectives.length ? Math.round((completedObjectives / objectives.length) * 100) : 0
  const ungroupedTasks = tasks.filter((task) => !task.project_objective_id)
  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]))

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-text-muted hover:bg-surface-hover hover:text-text focus-ring lg:hidden">
        <ArrowLeft size={15} /> All projects
      </button>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                  {project.status}
                </span>
                <span className="flex items-center gap-1 text-xs text-text-light">
                  <CalendarDays size={13} /> {dateLabel(project.target_date)}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">{project.title}</h1>
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-text-muted">
                {project.objective || 'No project description yet.'}
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-border bg-surface-alt px-4 py-3 text-right">
              <div className="text-2xl font-bold tabular-nums text-text">{completedObjectives}/{objectives.length}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-light">objectives complete</div>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-text">
              <ListTodo size={16} className="text-gold" /> Objective checklist
            </h2>
            <p className="mt-1 text-xs text-text-muted">Complete the subtasks, then check off their objective.</p>
          </div>
        </header>
        {objectives.length === 0 ? (
          <div className="p-6 text-center">
            <Target size={26} className="mx-auto text-gold" />
            <p className="mt-2 text-sm font-semibold text-text">What is the first major objective?</p>
            <p className="mt-1 text-xs text-text-muted">Add an objective umbrella, then place its subtasks underneath.</p>
          </div>
        ) : (
          <div>
            {objectives.map((objective) => (
              <ProjectObjectiveSection
                key={objective.id}
                projectId={project.id}
                objective={objective}
                tasks={tasks.filter((task) => task.project_objective_id === objective.id)}
              />
            ))}
            {ungroupedTasks.length > 0 && (
              <div className="border-t border-border">
                <div className="bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-300">
                  Earlier project tasks · add new work inside an objective
                </div>
                <div className="pl-4 sm:pl-8">
                  {ungroupedTasks.map((task) => (
                    <ProjectTaskRow key={task.id} projectId={project.id} task={task} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <AddObjectiveForm projectId={project.id} />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-text">
            <Clock3 size={16} className="text-gold" /> Progress timeline
          </h2>
          <p className="mt-1 text-xs text-text-muted">A readable record of what moved this project forward.</p>
        </header>
        {updates.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">
            Progress notes added from a task will appear here.
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {updates.map((update) => (
              <li key={update.id} className="relative flex gap-3 px-4 py-4 sm:px-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <FileText size={14} />
                </span>
                <div className="min-w-0">
                  {update.task_id && (
                    <a href={`?project=${project.id}&task=${update.task_id}`} className="text-xs font-bold text-gold hover:underline">
                      {taskTitle.get(update.task_id) ?? 'Project task'}
                    </a>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">{update.note}</p>
                  <p className="mt-1.5 text-[11px] text-text-light">{timeLabel(update.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export default function Projects() {
  useDocumentTitle('Projects - Checkmark Workspace')
  const [searchParams, setSearchParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const selectedId = searchParams.get('project')
  const projectsQuery = useQuery({ queryKey: projectKeys.list(), queryFn: fetchProjects })
  const projects = projectsQuery.data ?? []
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  )

  function selectProject(id: string | null) {
    setSearchParams(id ? { project: id } : {})
  }

  return (
    <div className="mx-auto max-w-[1320px] animate-fade-in space-y-5">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        actions={
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />

      {creating && <CreateProjectForm onClose={() => setCreating(false)} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className={selectedId ? 'hidden lg:block' : 'block'}>
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold text-text">Active projects</h2>
              <p className="text-xs text-text-muted">{projects.length} ongoing objective{projects.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {projectsQuery.isLoading ? (
              <>
                <div className="h-32 animate-pulse rounded-xl bg-surface" />
                <div className="h-32 animate-pulse rounded-xl bg-surface" />
              </>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create one outcome, then add its next concrete task."
                action={<Button size="sm" onClick={() => setCreating(true)} iconLeft={<Plus size={14} />}>Create project</Button>}
              />
            ) : (
              projects.map((project) => (
                <ProjectListCard
                  key={project.id}
                  project={project}
                  selected={project.id === selectedId}
                  onSelect={() => selectProject(project.id)}
                />
              ))
            )}
          </div>
        </aside>

        <main className={!selectedId ? 'hidden lg:block' : 'block'}>
          {selectedId ? (
            <ProjectDetail projectId={selectedId} onBack={() => selectProject(null)} />
          ) : (
            <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
              <div className="max-w-sm">
                <ClipboardCheck size={36} className="mx-auto text-gold" />
                <h2 className="mt-4 text-lg font-bold text-text">Choose one project to focus</h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Its outcome, next tasks, and progress notes will stay together in one calm workspace.
                </p>
                {selectedProject && <p className="sr-only">{selectedProject.title}</p>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
