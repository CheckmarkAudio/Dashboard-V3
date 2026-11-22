import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode, useId } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  FileText,
  Ellipsis,
  FolderKanban,
  ImagePlus,
  Pencil,
  ListPlus,
  Plus,
  Share2,
  Trash2,
  Target,
  Users,
  X,
  LayoutGrid,
  Rows3,
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
  fetchProjectCardMeta,
  fetchProjectDetail,
  fetchProjects,
  projectKeys,
  reorderProjectObjectives,
  setProjectMember,
  updateProjectDetails,
  updateProjectObjective,
  updateProjectTask,
  type Project,
  type ProjectObjective,
  type ProjectTask,
} from '../lib/queries/projects'
import './ProjectsChecklist.css'
import ProjectToolsBoard from '../components/projects/ProjectToolsBoard'
import ProjectExplorer from '../components/projects/ProjectExplorer'
import { fetchProjectInspo, projectMediaKeys, setProjectCover } from '../lib/queries/projectMedia'
import { NewProjectTile, ProjectCard, ProjectGridSkeleton, ProjectHero, type ProjectCardModel } from '../components/projects/ProjectCard'
import { PROJECT_LIST_FILTERS, matchesProjectFilter, type ProjectListFilter } from '../components/projects/projectListFilter'
import { legacyProjectSearchRedirect, projectDetailPath, projectsListPath } from '../app/projectPaths'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { memberActivityKeys } from '../lib/activity/queries'
import { emitFlywheelEvent, flywheelKeys } from '../lib/queries/flywheelEvents'

const projectTaskCachePrefixes = ['assigned-tasks', 'admin-assigned-tasks', 'team-assigned-tasks', 'studio-assigned-tasks', 'assign-page-member-tasks']
function refreshTaskSurfaces(client: QueryClient) {
  for (const prefix of projectTaskCachePrefixes) void client.invalidateQueries({ queryKey: [prefix] })
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [objectives, setObjectives] = useState([''])
  const [targetDate, setTargetDate] = useState('')

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      navigate(projectDetailPath(project.id, searchParams))
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


function ChecklistActions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={trigger} type="button" className="checklist-more focus-ring"
        aria-label={label} title="More actions" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}>
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="checklist-actions-row" role="group" aria-label={label}
          onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }}
          onClick={event => {
            const button = (event.target as HTMLElement).closest('button')
            if (button && !button.disabled) { setOpen(false); trigger.current?.focus() }
          }}>
          {children}
        </div>
      )}
    </>
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
      refreshTaskSurfaces(queryClient)
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast('Subtask added.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  if (!open) {
    return (
      <div className="checklist-add-subtask">
        <Button
          variant="secondary"
          size="sm"
          className="checklist-add-button"
          iconLeft={<ListPlus size={14} />}
          onClick={() => setOpen(true)}
        >
          Add subtask
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2 px-3 pb-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) mutation.mutate({ projectId, objectiveId, title: title.trim() })
      }}
    >
      <Input
        wrapperClassName="flex-1"
        aria-label="New objective subtask"
        placeholder="Subtask title"
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => { setOpen(false); setTitle('') }}>Cancel</Button>
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!title.trim()}
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
      refreshTaskSurfaces(queryClient)
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
  embedded = false,
}: {
  projectId: string
  task: ProjectTask
  canCompleteWork: boolean
  embedded?: boolean
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
      refreshTaskSurfaces(queryClient)
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
      refreshTaskSurfaces(queryClient)
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
      refreshTaskSurfaces(queryClient)
      toast('Subtask updated.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProjectTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      refreshTaskSurfaces(queryClient)
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast('Subtask deleted.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <div id={embedded ? undefined : `task-${task.id}`} className="border-b border-border last:border-b-0 scroll-mt-28">
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
      <div className="checklist-task-head">
        <button type="button" role="checkbox" aria-checked={task.is_completed}
          onClick={() => completeMutation.mutate(!task.is_completed)}
          disabled={!canCompleteWork || completeMutation.isPending}
          className="checklist-complete focus-ring"
          aria-label={`${task.is_completed ? 'Mark incomplete' : 'Complete'} subtask: ${task.title}`}
          title={!canCompleteWork ? 'Only project members can complete this task' : undefined}>
          {task.is_completed ? <CheckCircle2 size={17} aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
        </button>
        <div className="checklist-task-content">
          <span className="checklist-task-title" data-completed={task.is_completed || undefined}>{task.title}</span>
          <button type="button" className="checklist-note focus-ring" onClick={() => setWriting(value => !value)} aria-expanded={writing}>
            Add note
          </button>
        </div>
        <ChecklistActions label={`Actions for subtask: ${task.title}`}>
          <button type="button" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit subtask</button>
          <button type="button" className="checklist-delete" disabled={deleteMutation.isPending} onClick={() => {
            if (window.confirm(`Delete subtask “${task.title}”? Its progress notes will remain in the project timeline.`)) deleteMutation.mutate(task.id)
          }}><Trash2 size={14} aria-hidden="true" />Delete subtask</button>
        </ChecklistActions>
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
            rows={3}
            placeholder="Progress note"
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
  // 2026-07-31 — director: "we do need to remove [the subtask
  // requirement] especially since not all objectives will have
  // subtasks." Was `tasks.length > 0 && completedTasks === tasks.length`
  // (blocked completion entirely until a subtask existed); `.every()`
  // is vacuously true for an empty list, so an objective with no
  // subtasks is completable immediately, while one WITH subtasks still
  // requires them all done first.
  const canComplete = tasks.every((task) => task.is_completed)
  const mutation = useMutation({
    mutationFn: (next: boolean) => completeProjectObjective(objective.id, next),
    onSuccess: (_updated, next) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      refreshTaskSurfaces(queryClient)
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
      refreshTaskSurfaces(queryClient)
      toast('Objective updated.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProjectObjective,
    onSuccess: (deletedTasks) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      refreshTaskSurfaces(queryClient)
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
      toast(`Objective deleted${deletedTasks ? ` with ${deletedTasks} subtask${deletedTasks === 1 ? '' : 's'}` : ''}.`, 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  return (
    <article
      className="checklist-objective"
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
      <header className="checklist-objective-head">
        <button
          type="button" role="checkbox" aria-checked={objective.is_completed}
          aria-label={`${objective.is_completed ? 'Reopen' : 'Complete'} objective: ${objective.title}`}
          disabled={!canCompleteWork || mutation.isPending || (!objective.is_completed && !canComplete)}
          onClick={() => mutation.mutate(!objective.is_completed)}
          className="checklist-complete focus-ring"
          title={!canCompleteWork ? 'Only project members can complete this objective' : !objective.is_completed && !canComplete ? 'Complete every subtask first' : undefined}
        >
          {objective.is_completed ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
        </button>
        <div className="checklist-objective-content" draggable onDragStart={onDragStart} title="Drag to reorder objective">
          <h3 className="checklist-objective-title" data-completed={objective.is_completed || undefined}>{objective.title}</h3>
          {tasks.length > 0 && <span className="checklist-progress">{completedTasks}/{tasks.length} subtasks</span>}
        </div>
        <ChecklistActions label={`Actions for objective: ${objective.title}`}>
          <button type="button" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit objective</button>
          <button type="button" onClick={() => onMove(position, position - 1)} disabled={position === 0}>
            <ChevronUp size={14} aria-hidden="true" />Move up
          </button>
          <button type="button" onClick={() => onMove(position, position + 1)} disabled={position === objectiveCount - 1}>
            <ChevronDown size={14} aria-hidden="true" />Move down
          </button>
          <button type="button" className="checklist-delete" disabled={deleteMutation.isPending} onClick={() => {
            const nestedWarning = tasks.length ? ` This will also delete its ${tasks.length} nested subtask${tasks.length === 1 ? '' : 's'}.` : ''
            if (window.confirm(`Delete objective “${objective.title}”?${nestedWarning} Progress notes will remain in the project timeline.`)) {
              deleteMutation.mutate(objective.id)
            }
          }}><Trash2 size={14} aria-hidden="true" />Delete objective</button>
        </ChecklistActions>
      </header>
      {tasks.length > 0 && (
        <div className="checklist-objective-children">
          {tasks.map((task) => (
            <ProjectTaskRow key={task.id} projectId={projectId} task={task} canCompleteWork={canCompleteWork} />
          ))}
        </div>
      )}
      {!objective.is_completed && (
        <div className="checklist-objective-children">
          <AddSubtaskForm projectId={projectId} objectiveId={objective.id} />
        </div>
      )}
    </article>
  )
}


function ProjectCoverEditor({
  project,
  teamId,
  userId,
}: {
  project: Project
  teamId: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const inspoQuery = useQuery({
    queryKey: projectMediaKeys.inspo(project.id),
    queryFn: () => fetchProjectInspo(project.id),
  })
  const available = inspoQuery.data?.available === true
  const mutation = useMutation({
    mutationFn: (file: File | null) => setProjectCover({
      projectId: project.id,
      teamId,
      userId,
      file,
      currentUrl: project.cover_url,
    }),
    onSuccess: (_project, file) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast(file ? 'Cover image saved.' : 'Cover reset to default art.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const inputRef = useRef<HTMLInputElement>(null)
  if (inspoQuery.isLoading) return null
  if (!available) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-muted">Cover image</p>
      <p className="text-xs text-text-light">JPEG, PNG, WEBP, or GIF, up to 5 MB. Leave empty to use the default clip art.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={mutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) mutation.mutate(file)
          }}
        />
        <Button variant="secondary" size="sm" iconLeft={<ImagePlus size={14} />} loading={mutation.isPending} onClick={() => inputRef.current?.click()}>
          {project.cover_url ? 'Replace cover' : 'Upload cover'}
        </Button>
        {project.cover_url && (
          <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate(null)}>
            Use default art
          </Button>
        )}
      </div>
    </div>
  )
}

function ProjectCoverButton({
  project,
  teamId,
  userId,
}: {
  project: Project
  teamId: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const inspoQuery = useQuery({
    queryKey: projectMediaKeys.inspo(project.id),
    queryFn: () => fetchProjectInspo(project.id),
  })
  const available = inspoQuery.data?.available === true
  const mutation = useMutation({
    mutationFn: (file: File) => setProjectCover({
      projectId: project.id,
      teamId,
      userId,
      file,
      currentUrl: project.cover_url,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast('Cover image saved.', 'success')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const inputRef = useRef<HTMLInputElement>(null)
  if (!available) return null
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={mutation.isPending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) mutation.mutate(file)
        }}
      />
      <Button variant="secondary" size="sm" iconLeft={<ImagePlus size={14} />} loading={mutation.isPending} onClick={() => inputRef.current?.click()}>
        Change cover
      </Button>
    </>
  )
}

function EditProjectForm({
  project,
  userId,
  onClose,
  onArchived,
}: {
  project: Project
  userId?: string | null
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
      {userId && (
        <ProjectCoverEditor project={project} teamId={project.team_id} userId={userId} />
      )}
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
      refreshTaskSurfaces(queryClient)
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

function AddWorkspaceTask({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const client = useQueryClient()
  const { toast } = useToast()
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('add_project_task', { p_project_id: projectId, p_title: title.trim() })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { setTitle(''); void client.invalidateQueries({ queryKey: projectKeys.all }); refreshTaskSurfaces(client) },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  return <form className="pt-add-form" onSubmit={e => { e.preventDefault(); if (title.trim() && !mutation.isPending) mutation.mutate() }}>
    <Input label="New task" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} />
    <Button type="submit" disabled={!title.trim()} loading={mutation.isPending}>Add</Button>
  </form>
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { user } = useAuth()
  const [toolsDirty, setToolsDirty] = useState(false)
  const onToolsDirty = useCallback((dirty: boolean) => setToolsDirty(dirty), [])
  useEffect(() => {
    if (!toolsDirty) return
    const leave = (event: Event) => { if (!window.confirm('Leave without saving your workspace changes?')) event.preventDefault() }
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const link = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a[href]')
      if (anchor && !anchor.getAttribute('href')?.startsWith('#') && !window.confirm('Leave without saving your workspace changes?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('project-tools-leave', leave)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', link, true)
    return () => { window.removeEventListener('project-tools-leave', leave); window.removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true) }
  }, [toolsDirty])
  const [addingObjective, setAddingObjective] = useState(false)
  const [editingProject, setEditingProject] = useState(false)
  const [deckTab, setDeckTab] = useState<'cards' | 'visual' | 'stats'>(() => {
    if (import.meta.env.DEV) {
      const tab = new URLSearchParams(window.location.search).get('previewTab')
      if (tab === 'visual' || tab === 'stats' || tab === 'cards') return tab
    }
    return 'cards'
  })
  const [moreOpen, setMoreOpen] = useState(false)
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
      refreshTaskSurfaces(queryClient)
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

  const { project, objectives, tasks, updates, members, teamMembers } = query.data
  const currentMemberId = user?.id ?? query.data.currentMemberId
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


      {editingProject && (
        <EditProjectForm
          project={project}
          userId={currentMemberId}
          onClose={() => setEditingProject(false)}
          onArchived={onBack}
        />
      )}

      <ProjectHero
        project={project}
        progress={progress}
        eyebrow={(() => {
          const owner = teamMembers.find((member) => member.id === project.owner_id)?.display_name
            ?? members.find((member) => member.member_id === project.owner_id)?.display_name
            ?? 'Project owner'
          const updated = project.updated_at
            ? new Date(project.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
            : null
          return `${owner}${updated ? ` · Updated ${updated}` : ''}`
        })()}
        actions={
          <div className="project-detail-actions flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditingProject(true)}>
              Edit
            </Button>
            {canManageMembers && currentMemberId && (
              <ProjectCoverButton
                project={project}
                teamId={project.team_id}
                userId={currentMemberId}
              />
            )}
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Share2 size={14} />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href)
                  toast('Project link copied.', 'success')
                } catch {
                  toast('Could not copy the link.', 'error')
                }
              }}
            >
              Share
            </Button>
            <div className="relative">
              <Button variant="secondary" size="sm" iconLeft={<Ellipsis size={14} />} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
                More
              </Button>
              {moreOpen && (
                <div className="absolute right-0 z-10 mt-2 min-w-44 rounded-xl border border-border bg-surface p-1 shadow-lg">
                  {project.status === 'completed' ? (
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setMoreOpen(false); projectCompletionMutation.mutate(false) }}>Reopen project</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!canCompleteWork || !canCompleteProject} onClick={() => { setMoreOpen(false); projectCompletionMutation.mutate(true) }}>Complete project</Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full justify-start" iconLeft={<Pencil size={14} />} onClick={() => { setMoreOpen(false); setEditingProject(true) }}>Edit details</Button>
                </div>
              )}
            </div>
          </div>
        }
      />

      <div className="project-deck-tabs" role="tablist" aria-label="Project views">
        {([['cards', 'Cards & deck'], ['visual', 'Visual'], ['stats', 'Stats']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" className="focus-ring" aria-selected={deckTab === id} onClick={() => setDeckTab(id)}>{label}</button>
        ))}
      </div>

      {deckTab === 'visual' && (
        <ProjectToolsBoard
          key={project.id}
          projectId={project.id}
          canEdit={project.status !== 'archived' && (canCompleteWork || canManageMembers)}
          objectives={objectives}
          onDirtyChange={onToolsDirty}
          renderTasks={objectiveId => <>
            {tasks.filter(task => !objectiveId || task.project_objective_id === objectiveId).map(task => <ProjectTaskRow key={task.id} projectId={project.id} task={task} canCompleteWork={canCompleteWork} embedded />)}
            {objectiveId ? <AddSubtaskForm projectId={project.id} objectiveId={objectiveId} /> : <AddWorkspaceTask projectId={project.id} />}
          </>}
        />
      )}

      {deckTab !== 'visual' && (
        <ProjectExplorer
          projectId={project.id}
          teamId={project.team_id}
          userId={currentMemberId}
          summary={project.objective}
          canEdit={project.status !== 'archived' && (canCompleteWork || canManageMembers)}
          onEditProject={() => setEditingProject(true)}
          objectives={objectives}
          tasks={tasks}
          stats={{ objectivesDone: completedObjectives, objectivesTotal: objectives.length }}
          onDirtyChange={onToolsDirty}
          previewSelect={import.meta.env.DEV ? new URLSearchParams(window.location.search).get('previewSelect') : null}
          mode={deckTab === 'stats' ? 'stats' : 'cards'}
          renderTasks={objectiveId => <>
            {tasks.filter(task => !objectiveId || task.project_objective_id === objectiveId).map(task => <ProjectTaskRow key={task.id} projectId={project.id} task={task} canCompleteWork={canCompleteWork} embedded />)}
            {objectiveId ? <AddSubtaskForm projectId={project.id} objectiveId={objectiveId} /> : <AddWorkspaceTask projectId={project.id} />}
          </>}
        />
      )}

      <details open={new URLSearchParams(window.location.search).has('task')} className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-section">Objectives, team &amp; progress</summary>
        <div className="mt-4 space-y-4">
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
              Objectives
            </h2>
          </div>
        </header>
        {objectives.length === 0 ? (
          <>
            <div className="p-6 text-center">
              <p className="text-sm text-text-muted">No objectives yet.</p>
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
                  Other tasks
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
              Add objective
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
                    <Link to={projectDetailPath(project.id, undefined, { task: update.task_id })} className="text-xs font-bold text-gold hover:underline">
                      {taskTitle.get(update.task_id) ?? 'Project task'}
                    </Link>
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
      </details>
    </div>
  )
}

export default function Projects() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const legacyPath = !projectId ? legacyProjectSearchRedirect(searchParams.toString()) : null
  if (legacyPath) return <Navigate to={legacyPath} replace />
  if (projectId) return <ProjectWorkspace projectId={projectId} />
  return <ProjectsGallery />
}

function ProjectWorkspace({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const listPath = projectsListPath(searchParams)
  const projectsQuery = useQuery({ queryKey: projectKeys.list(), queryFn: fetchProjects })
  const title = projectsQuery.data?.find((project) => project.id === projectId)?.title
  useDocumentTitle(title ? `${title} - Checkmark Workspace` : 'Project - Checkmark Workspace')

  function goBack() {
    if (!window.dispatchEvent(new Event('project-tools-leave', { cancelable: true }))) return
    navigate(listPath)
  }

  return (
    <div className="project-grid-page mx-auto animate-fade-in space-y-5">
      <nav className="project-workspace-nav" aria-label="Project">
        <Link to={listPath} className="project-back focus-ring">
          <ArrowLeft size={16} aria-hidden="true" />
          All projects
        </Link>
        <ol className="project-breadcrumb">
          <li><Link to={listPath} className="focus-ring">Projects</Link></li>
          <li aria-current="page">{title ?? 'Project'}</li>
        </ol>
      </nav>
      <ProjectDetail projectId={projectId} onBack={goBack} />
    </div>
  )
}

type ProjectViewSize = 's' | 'm' | 'l' | 'list'
function ProjectsGallery() {
  useDocumentTitle('Projects - Checkmark Workspace')
  const [searchParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<ProjectListFilter>('all')
  const previewView = import.meta.env.DEV ? searchParams.get('previewView') : null
  const [view, setView] = useState<ProjectViewSize>(() => {
    if (previewView === 's' || previewView === 'm' || previewView === 'l' || previewView === 'list') return previewView
    try {
      const stored = sessionStorage.getItem('checkmark-projects-view')
      if (stored === 's' || stored === 'm' || stored === 'l' || stored === 'list') return stored
    } catch { /* Browser-only preference. */ }
    return 'l'
  })
  function chooseView(next: ProjectViewSize) {
    setView(next)
    try { sessionStorage.setItem('checkmark-projects-view', next) } catch { /* Browser-only preference. */ }
  }
  const formRef = useRef<HTMLDivElement>(null)
  const projectsQuery = useQuery({ queryKey: projectKeys.list(), queryFn: fetchProjects })
  const projects = projectsQuery.data ?? []
  const ids = projects.map((project) => project.id)
  const metaQuery = useQuery({
    queryKey: projectKeys.cardMeta(ids),
    queryFn: () => fetchProjectCardMeta(ids),
    enabled: ids.length > 0,
  })
  const visible = projects.filter((project) => matchesProjectFilter(project.status, filter))
  const activeCount = projects.filter((project) => matchesProjectFilter(project.status, 'active')).length
  const completedCount = projects.filter((project) => project.status === 'completed').length
  const objectiveTotal = Object.values(metaQuery.data ?? {}).reduce((sum, meta) => sum + (meta.objectiveCount ?? 0), 0)
  const objectiveDone = Object.values(metaQuery.data ?? {}).reduce((sum, meta) => sum + (meta.completedCount ?? 0), 0)

  function openCreateForm() {
    setCreating(true)
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <div className="project-grid-page animate-fade-in space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        actions={
          <Button size="lg" iconLeft={<Plus size={16} />} onClick={openCreateForm}>
            New project
          </Button>
        }
      />

      <div ref={formRef}>{creating && <CreateProjectForm onClose={() => setCreating(false)} />}</div>

      {projectsQuery.isLoading ? (
        <ProjectGridSkeleton />
      ) : projectsQuery.isError ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-6 text-sm text-red-300" role="alert">
          {(projectsQuery.error as Error).message || 'Could not load projects.'}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create one outcome, then add its next concrete task."
          action={<Button size="sm" onClick={openCreateForm} iconLeft={<Plus size={14} />}>Create project</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="project-stats-strip" aria-label="Project overview stats">
            <span className="project-stat-chip"><strong>{projects.length}</strong> projects</span>
            <span className="project-stat-chip"><strong>{activeCount}</strong> active</span>
            <span className="project-stat-chip"><strong>{completedCount}</strong> completed</span>
            <span className="project-stat-chip"><strong>{objectiveDone}/{objectiveTotal}</strong> objectives</span>
          </div>
          <div className="project-grid-toolbar">
            <div className="project-filter" role="group" aria-label="Filter projects">
              {PROJECT_LIST_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="focus-ring"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="project-view-toggle" role="group" aria-label="Project layout">
              {([['s', 'S'], ['m', 'M'], ['l', 'L'], ['list', 'List']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="focus-ring"
                  aria-pressed={view === id}
                  aria-label={id === 'list' ? 'List view' : `${label} grid`}
                  onClick={() => chooseView(id)}
                >
                  {id === 'list' ? <Rows3 size={16} /> : id === 's' ? 'S' : id === 'm' ? 'M' : <LayoutGrid size={16} />}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={filter === 'completed' ? 'No completed projects' : 'No active projects'}
              description="Try another filter, or start a new project."
              action={<Button size="sm" onClick={() => setFilter('all')}>Show all projects</Button>}
            />
          ) : (
            <div className="project-grid" data-size={view}>
              {visible.map((project) => {
                const meta = metaQuery.data?.[project.id]
                const card: ProjectCardModel = {
                  ...project,
                  objectiveCount: meta?.objectiveCount ?? 0,
                  completedCount: meta?.completedCount ?? 0,
                  members: meta?.members ?? [],
                }
                return <ProjectCard key={project.id} project={card} href={projectDetailPath(project.id, searchParams)} layout={view === 'list' ? 'row' : 'tile'} previewHover={import.meta.env.DEV && searchParams.get('previewHover') === project.id} />
              })}
              <NewProjectTile onClick={openCreateForm} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
