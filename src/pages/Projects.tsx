import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  Pencil,
  ListTodo,
  ListPlus,
  MessageSquarePlus,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Target,
  Users,
  X,
} from 'lucide-react'
import { Button, EmptyState, Input, PageHeader, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  addProjectProgressNote,
  addProjectObjective,
  addProjectObjectiveTask,
  archiveProject,
  completeProjectObjective,
  completeProject,
  completeProjectTask,
  createProject,
  deleteProjectObjective,
  deleteProjectTask,
  fetchProjectDetail,
  fetchProjects,
  projectKeys,
  reorderProjectObjectives,
  setProjectMember,
  setProjectPin,
  updateProjectDetails,
  updateProjectObjective,
  updateProjectTask,
  type Project,
  type ProjectObjective,
  type ProjectTask,
} from '../lib/queries/projects'
import { memberActivityKeys } from '../lib/activity/queries'
import { emitFlywheelEvent, flywheelKeys } from '../lib/queries/flywheelEvents'

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
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const pinMutation = useMutation({
    mutationFn: () => setProjectPin(project.id, !project.is_pinned),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
    onError: (error: Error) => toast(error.message, 'error'),
  })
  return (
    <article
      className={[
        'relative w-full rounded-xl border transition-colors',
        selected
          ? 'border-gold/55 bg-gold/10'
          : 'border-border bg-surface hover:bg-surface-hover',
      ].join(' ')}
    >
      <button type="button" onClick={onSelect} className="w-full rounded-xl p-4 pr-12 text-left focus-ring">
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
            <span className={project.status === 'completed'
              ? 'rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-300'
              : 'rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400'}>
              {project.status === 'completed' ? 'Completed' : 'Active'}
            </span>
            <span>{dateLabel(project.target_date)}</span>
          </div>
        </div>
      </div>
      </button>
      <button
        type="button"
        onClick={() => pinMutation.mutate()}
        disabled={pinMutation.isPending}
        className={project.is_pinned ? 'absolute right-3 top-3 rounded-lg p-2 text-gold hover:bg-gold/10 focus-ring' : 'absolute right-3 top-3 rounded-lg p-2 text-text-light hover:bg-surface-hover hover:text-gold focus-ring'}
        aria-label={project.is_pinned ? `Unpin ${project.title}` : `Pin ${project.title}`}
        title={project.is_pinned ? 'Unpin project' : 'Pin project to top'}
      >
        {project.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
      </button>
    </article>
  )
}

function AddSubtaskForm({ projectId, objectiveId }: { projectId: string; objectiveId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const mutation = useMutation({
    mutationFn: addProjectObjectiveTask,
    onSuccess: () => {
      setTitle('')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast('Subtask added.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  if (!open) {
    return (
      <div className="border-t border-dashed border-sky-500/20 px-3 py-2.5">
        <Button
          variant="secondary"
          size="sm"
          className="border-sky-500/35 bg-sky-500/5 text-sky-300 hover:bg-sky-500/10"
          iconLeft={<ListPlus size={14} />}
          onClick={() => setOpen(true)}
        >
          Add subtask inside this objective
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2 border-t border-dashed border-sky-500/25 bg-sky-500/5 p-3 sm:flex-row"
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
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => { setOpen(false); setTitle('') }}>Cancel</Button>
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!title.trim()}
          className="bg-sky-400 text-slate-950 hover:bg-sky-300"
          iconLeft={<ListPlus size={15} />}
        >
          Save subtask
        </Button>
      </div>
    </form>
  )
}

function AddObjectiveForm({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const mutation = useMutation({
    mutationFn: addProjectObjective,
    onSuccess: () => {
      setTitle('')
      onClose()
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast('Objective added.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <form
      className="flex flex-col gap-2 border-b border-gold/30 bg-gold/8 p-4 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) mutation.mutate({ projectId, title: title.trim() })
      }}
    >
      <Input
        wrapperClassName="flex-1"
        aria-label="New project objective"
        autoFocus
        placeholder="Name the major objective…"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending} disabled={!title.trim()} iconLeft={<Target size={15} />}>
          Save objective
        </Button>
      </div>
    </form>
  )
}

function ProjectTaskRow({
  projectId,
  task,
  canCompleteWork,
}: {
  projectId: string
  task: ProjectTask
  canCompleteWork: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [writing, setWriting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [note, setNote] = useState('')

  const completeMutation = useMutation({
    mutationFn: (next: boolean) => completeProjectTask(task.id, next),
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
  const editMutation = useMutation({
    mutationFn: updateProjectTask,
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast('Subtask updated.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProjectTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast('Subtask deleted.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <div id={`task-${task.id}`} className="border-b border-border last:border-b-0 scroll-mt-28">
      {editing ? (
        <form
          className="flex flex-col gap-2 bg-surface-alt/50 p-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (editTitle.trim()) editMutation.mutate({ taskId: task.id, title: editTitle.trim(), dueDate: task.due_date ?? undefined })
          }}
        >
          <Input
            autoFocus
            wrapperClassName="flex-1"
            aria-label={`Edit ${task.title}`}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditTitle(task.title) }}>Cancel</Button>
            <Button type="submit" size="sm" loading={editMutation.isPending} disabled={!editTitle.trim()}>Save</Button>
          </div>
        </form>
      ) : (
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => completeMutation.mutate(!task.is_completed)}
          disabled={!canCompleteWork || completeMutation.isPending}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-ring disabled:opacity-50"
          aria-label={`${task.is_completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
          title={!canCompleteWork ? 'Only project members can complete this task' : undefined}
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
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-2 rounded-lg text-text-light hover:bg-surface-hover hover:text-text focus-ring"
          aria-label={`Edit ${task.title}`}
          title="Edit subtask"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete subtask “${task.title}”? Its progress notes will remain in the project timeline.`)) {
              deleteMutation.mutate(task.id)
            }
          }}
          disabled={deleteMutation.isPending}
          className="p-2 rounded-lg text-text-light hover:bg-red-500/10 hover:text-red-400 focus-ring disabled:opacity-50"
          aria-label={`Delete ${task.title}`}
          title="Delete subtask"
        >
          <Trash2 size={14} />
        </button>
      </div>
      )}
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
  position,
  objectiveCount,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  canCompleteWork,
}: {
  projectId: string
  objective: ProjectObjective
  tasks: ProjectTask[]
  position: number
  objectiveCount: number
  onMove: (from: number, to: number) => void
  onDragStart: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: () => void
  canCompleteWork: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(objective.title)
  const completedTasks = tasks.filter((task) => task.is_completed).length
  const canComplete = tasks.length > 0 && completedTasks === tasks.length
  const mutation = useMutation({
    mutationFn: (next: boolean) => completeProjectObjective(objective.id, next),
    onSuccess: (_updated, next) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      if (next) {
        void emitFlywheelEvent({
          stage: 'production',
          source_type: 'project_objective',
          source_id: objective.id,
          metadata: { title: objective.title, project_id: projectId },
        }).then(() => {
          void queryClient.invalidateQueries({ queryKey: memberActivityKeys.all })
          void queryClient.invalidateQueries({ queryKey: flywheelKeys.all })
        })
      }
      toast(objective.is_completed ? 'Objective reopened.' : 'Objective completed.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const editMutation = useMutation({
    mutationFn: updateProjectObjective,
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast('Objective updated.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProjectObjective,
    onSuccess: (deletedTasks) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast(`Objective deleted${deletedTasks ? ` with ${deletedTasks} subtask${deletedTasks === 1 ? '' : 's'}` : ''}.`, 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <article
      className="border-b border-border last:border-b-0"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {editing ? (
        <form
          className="flex flex-col gap-2 border-b border-gold/30 bg-gold/8 p-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (editTitle.trim()) editMutation.mutate({ objectiveId: objective.id, title: editTitle.trim() })
          }}
        >
          <Input
            autoFocus
            wrapperClassName="flex-1"
            aria-label={`Edit objective ${objective.title}`}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditTitle(objective.title) }}>Cancel</Button>
            <Button type="submit" size="sm" loading={editMutation.isPending} disabled={!editTitle.trim()}>Save objective</Button>
          </div>
        </form>
      ) : null}
      <header className="flex flex-col gap-3 bg-surface-alt/45 px-4 py-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-0.5" aria-label={`Reorder objective ${objective.title}`}>
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            className="cursor-grab rounded-lg p-2 text-text-light hover:bg-surface-hover hover:text-gold focus-ring active:cursor-grabbing"
            aria-label={`Drag to reorder ${objective.title}`}
            title="Drag to move objective"
          >
            <ListTodo size={16} />
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onMove(position, position - 1)}
              disabled={position === 0}
              className="rounded p-0.5 text-text-light hover:bg-surface-hover hover:text-gold focus-ring disabled:opacity-20"
              aria-label={`Move ${objective.title} up`}
              title="Move objective up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => onMove(position, position + 1)}
              disabled={position === objectiveCount - 1}
              className="rounded p-0.5 text-text-light hover:bg-surface-hover hover:text-gold focus-ring disabled:opacity-20"
              aria-label={`Move ${objective.title} down`}
              title="Move objective down"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
        <button
          type="button"
          disabled={!canCompleteWork || mutation.isPending || (!objective.is_completed && !canComplete)}
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
              ? 'block whitespace-pre-wrap break-words text-sm font-bold leading-6 text-text-muted line-through'
              : 'block whitespace-pre-wrap break-words text-sm font-bold leading-6 text-text'}
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
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg text-text-light hover:bg-surface-hover hover:text-text focus-ring"
            aria-label={`Edit objective ${objective.title}`}
            title="Edit objective"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              const nestedWarning = tasks.length
                ? ` This will also delete its ${tasks.length} nested subtask${tasks.length === 1 ? '' : 's'}.`
                : ''
              if (window.confirm(`Delete objective “${objective.title}”?${nestedWarning} Progress notes will remain in the project timeline.`)) {
                deleteMutation.mutate(objective.id)
              }
            }}
            disabled={deleteMutation.isPending}
            className="p-2 rounded-lg text-text-light hover:bg-red-500/10 hover:text-red-400 focus-ring disabled:opacity-50"
            aria-label={`Delete objective ${objective.title}`}
            title="Delete objective"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      {tasks.length > 0 && (
        <div className="pl-4 sm:pl-8">
          {tasks.map((task) => (
            <ProjectTaskRow key={task.id} projectId={projectId} task={task} canCompleteWork={canCompleteWork} />
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

function EditProjectForm({
  project,
  onClose,
  onArchived,
}: {
  project: Project
  onClose: () => void
  onArchived: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.objective ?? '')
  const [targetDate, setTargetDate] = useState(project.target_date ?? '')
  const editMutation = useMutation({
    mutationFn: updateProjectDetails,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast('Project updated.', 'success')
      onClose()
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast('Project archived.', 'success')
      onArchived()
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <form
      className="rounded-xl border border-gold/35 bg-gold/5 p-4 sm:p-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) {
          editMutation.mutate({
            projectId: project.id,
            title: title.trim(),
            description: description.trim(),
            targetDate,
          })
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-text">Edit project</h2>
          <p className="mt-1 text-xs text-text-muted">Update the project context or archive it from the active workspace.</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-text-muted hover:bg-surface-hover focus-ring" aria-label="Close project editor">
          <X size={16} />
        </button>
      </div>
      <Input label="Project name" required value={title} onChange={(event) => setTitle(event.target.value)} />
      <Textarea
        label="Description"
        rows={5}
        hint="Line breaks and dashes are preserved."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Input label="Target date (optional)" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="danger"
          iconLeft={<Archive size={15} />}
          loading={archiveMutation.isPending}
          onClick={() => {
            if (window.confirm(`Archive “${project.title}”? It will leave the active Projects list, but its data and history will be preserved.`)) {
              archiveMutation.mutate(project.id)
            }
          }}
        >
          Archive project
        </Button>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={editMutation.isPending} disabled={!title.trim()}>Save project</Button>
        </div>
      </div>
    </form>
  )
}

function ProjectTeam({
  projectId,
  members,
  teamMembers,
  canManage,
}: {
  projectId: string
  members: { member_id: string; display_name: string }[]
  teamMembers: { id: string; display_name: string }[]
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [managing, setManaging] = useState(false)
  const memberIds = new Set(members.map((member) => member.member_id))
  const mutation = useMutation({
    mutationFn: setProjectMember,
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      toast(input.isMember ? 'Member added to the project.' : 'Member removed from the project.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-text"><Users size={16} className="text-gold" /> Project team</h2>
          <p className="mt-1 text-xs text-text-muted">Only these members can check off project work.</p>
        </div>
        {canManage && <Button variant="secondary" size="sm" onClick={() => setManaging((value) => !value)}>{managing ? 'Done' : 'Manage members'}</Button>}
      </header>
      <div className="flex flex-wrap gap-2 p-4">
        {members.map((member) => (
          <span key={member.member_id} className="rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text">
            {member.display_name}
          </span>
        ))}
      </div>
      {managing && (
        <div className="grid gap-2 border-t border-border bg-surface-alt/40 p-4 sm:grid-cols-2">
          {teamMembers.map((member) => (
            <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text">
              <input
                type="checkbox"
                checked={memberIds.has(member.id)}
                disabled={mutation.isPending}
                onChange={(event) => mutation.mutate({ projectId, memberId: member.id, isMember: event.target.checked })}
                className="h-4 w-4 accent-gold"
              />
              {member.display_name}
            </label>
          ))}
        </div>
      )}
    </section>
  )
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [addingObjective, setAddingObjective] = useState(false)
  const [editingProject, setEditingProject] = useState(false)
  const [draggedObjectiveId, setDraggedObjectiveId] = useState<string | null>(null)
  const objectiveComposerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const query = useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => fetchProjectDetail(projectId),
  })
  const orderedObjectives = query.data?.objectives ?? []
  const reorderMutation = useMutation({
    mutationFn: reorderProjectObjectives,
    onMutate: async ({ objectiveIds }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(projectId) })
      const previous = queryClient.getQueryData(projectKeys.detail(projectId))
      queryClient.setQueryData(projectKeys.detail(projectId), (current: typeof query.data) => {
        if (!current) return current
        const positions = new Map(objectiveIds.map((id, index) => [id, index]))
        return {
          ...current,
          objectives: [...current.objectives].sort(
            (a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0),
          ),
        }
      })
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(projectKeys.detail(projectId), context.previous)
      toast(error.message, 'error')
    },
    onSettled: () => {
      setDraggedObjectiveId(null)
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    },
  })
  const projectCompletionMutation = useMutation({
    mutationFn: (next: boolean) => completeProject(projectId, next),
    onSuccess: (updated, next) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      if (next) {
        void emitFlywheelEvent({
          stage: 'production',
          source_type: 'project_completed',
          source_id: updated.id,
          metadata: { title: updated.title, project_id: updated.id },
        }).then(() => {
          void queryClient.invalidateQueries({ queryKey: memberActivityKeys.all })
          void queryClient.invalidateQueries({ queryKey: flywheelKeys.all })
        })
      }
      toast(next ? 'Project completed and added to your activity tracker.' : 'Project reopened.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const moveObjective = (from: number, to: number) => {
    if (to < 0 || to >= orderedObjectives.length || from === to || reorderMutation.isPending) return
    const next = [...orderedObjectives]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    reorderMutation.mutate({ projectId, objectiveIds: next.map((objective) => objective.id) })
  }
  const dropObjective = (targetId: string) => {
    if (!draggedObjectiveId || draggedObjectiveId === targetId) return
    const from = orderedObjectives.findIndex((objective) => objective.id === draggedObjectiveId)
    const to = orderedObjectives.findIndex((objective) => objective.id === targetId)
    moveObjective(from, to)
  }

  useEffect(() => {
    if (!query.data) return
    const taskId = new URLSearchParams(window.location.search).get('task')
    if (!taskId) return
    window.setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }, [query.data])

  useEffect(() => {
    if (!addingObjective) return
    window.setTimeout(() => objectiveComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }, [addingObjective])

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

  const { project, objectives, tasks, updates, members, teamMembers, currentMemberId } = query.data
  const canCompleteWork = Boolean(currentMemberId && members.some((member) => member.member_id === currentMemberId))
  const currentTeamMember = teamMembers.find((member) => member.id === currentMemberId)
  const canManageMembers = currentMemberId === project.owner_id || currentTeamMember?.role === 'admin' || currentTeamMember?.role === 'owner'
  const completedObjectives = objectives.filter((objective) => objective.is_completed).length
  const canCompleteProject = objectives.length > 0 && completedObjectives === objectives.length
  const progress = objectives.length ? Math.round((completedObjectives / objectives.length) * 100) : 0
  const ungroupedTasks = tasks.filter((task) => !task.project_objective_id)
  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]))

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-text-muted hover:bg-surface-hover hover:text-text focus-ring lg:hidden">
        <ArrowLeft size={15} /> All projects
      </button>

      {editingProject && (
        <EditProjectForm
          project={project}
          onClose={() => setEditingProject(false)}
          onArchived={onBack}
        />
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className={project.status === 'completed'
                  ? 'rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-300'
                  : 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400'}>
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
            <div className="flex shrink-0 items-start gap-2">
              {project.status === 'completed' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => projectCompletionMutation.mutate(false)}
                  loading={projectCompletionMutation.isPending}
                >
                  Reopen project
                </Button>
              ) : (
                <Button
                  size="sm"
                  iconLeft={<CheckCircle2 size={14} />}
                  disabled={!canCompleteWork || !canCompleteProject}
                  loading={projectCompletionMutation.isPending}
                  onClick={() => projectCompletionMutation.mutate(true)}
                  title={!canCompleteProject ? 'Complete every objective first' : 'Complete project'}
                >
                  Complete project
                </Button>
              )}
              <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditingProject(true)}>
                Edit project
              </Button>
              <div className="rounded-xl border border-border bg-surface-alt px-4 py-3 text-right">
                <div className="text-2xl font-bold tabular-nums text-text">{completedObjectives}/{objectives.length}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-light">objectives complete</div>
              </div>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <ProjectTeam
        projectId={project.id}
        members={members}
        teamMembers={teamMembers}
        canManage={canManageMembers}
      />

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-text">
              <ListTodo size={16} className="text-gold" /> Objective checklist
            </h2>
            <p className="mt-1 text-xs text-text-muted">Complete the subtasks, then check off their objective.</p>
          </div>
        </header>
        {objectives.length === 0 ? (
          <>
            <div className="p-6 text-center">
              <Target size={26} className="mx-auto text-gold" />
              <p className="mt-2 text-sm font-semibold text-text">What is the first major objective?</p>
              <p className="mt-1 text-xs text-text-muted">Add an objective umbrella, then place its subtasks underneath.</p>
            </div>
            {addingObjective && (
              <div ref={objectiveComposerRef}>
                <AddObjectiveForm projectId={project.id} onClose={() => setAddingObjective(false)} />
              </div>
            )}
          </>
        ) : (
          <div>
            {objectives.map((objective, index) => (
              <ProjectObjectiveSection
                key={objective.id}
                projectId={project.id}
                objective={objective}
                tasks={tasks.filter((task) => task.project_objective_id === objective.id)}
                position={index}
                objectiveCount={objectives.length}
                onMove={moveObjective}
                onDragStart={() => setDraggedObjectiveId(objective.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropObjective(objective.id)}
                canCompleteWork={canCompleteWork}
              />
            ))}
            {addingObjective && (
              <div ref={objectiveComposerRef}>
                <AddObjectiveForm projectId={project.id} onClose={() => setAddingObjective(false)} />
              </div>
            )}
            {ungroupedTasks.length > 0 && (
              <div className="border-t border-border">
                <div className="bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-300">
                  Earlier project tasks · add new work inside an objective
                </div>
                <div className="pl-4 sm:pl-8">
                  {ungroupedTasks.map((task) => (
                    <ProjectTaskRow key={task.id} projectId={project.id} task={task} canCompleteWork={canCompleteWork} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!addingObjective && (
          <div className="border-t border-border bg-gold/5 p-4">
            <Button iconLeft={<Target size={15} />} onClick={() => setAddingObjective(true)}>
              Add next objective
            </Button>
          </div>
        )}
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

  useEffect(() => {
    if (!projectsQuery.isLoading && !selectedId && projects[0]) {
      setSearchParams({ project: projects[0].id }, { replace: true })
    }
  }, [projects, projectsQuery.isLoading, selectedId, setSearchParams])

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
              <h2 className="text-sm font-bold text-text">Projects</h2>
              <p className="text-xs text-text-muted">
                {projects.filter((project) => project.status !== 'completed').length} active · {projects.filter((project) => project.status === 'completed').length} completed
              </p>
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
