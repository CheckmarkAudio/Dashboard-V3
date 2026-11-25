import { CalendarDays, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Project, ProjectMember } from '../../lib/queries/projects'
import { artTransitionName, resolveProjectArt } from './projectArt'
import { useCardTilt } from './useCardTilt'
import { navigateWithTransition } from './navigateWithTransition'
import './ProjectGrid.css'

export interface ProjectCardModel extends Project {
  cover_url?: string | null
  objectiveCount: number
  completedCount: number
  members: ProjectMember[]
}


function ProjectCover({
  project,
  className,
}: {
  project: Pick<Project, 'id' | 'title' | 'objective'> & { cover_url?: string | null }
  className?: string
}) {
  const art = resolveProjectArt(project)
  const name = artTransitionName(project.id)
  if (art.custom) {
    return <img className={className} src={art.src} alt="" style={{ viewTransitionName: name }} />
  }
  return (
    <span
      className={`project-card-art-ink${className ? ` ${className}` : ''}`}
      style={{
        viewTransitionName: name,
        WebkitMaskImage: `url("${art.src}")`,
        maskImage: `url("${art.src}")`,
      }}
    />
  )
}

function dateLabel(value: string | null): string {
  if (!value) return 'No target date'
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function MemberAvatars({ members }: { members: ProjectMember[] }) {
  if (members.length === 0) return null
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length
  return (
    <div className="project-card-avatars" aria-label={`${members.length} team member${members.length === 1 ? '' : 's'}`}>
      {shown.map((member) => (
        member.avatar_url ? (
          <img key={member.member_id} src={member.avatar_url} alt="" className="project-card-avatar" title={member.display_name} />
        ) : (
          <span key={member.member_id} className="project-card-avatar" title={member.display_name}>
            {member.display_name.trim().charAt(0).toUpperCase() || '?'}
          </span>
        )
      ))}
      {extra > 0 && <span className="project-card-avatar-more">+{extra}</span>}
    </div>
  )
}

export function ProjectCard({ project, href, previewHover = false, layout = 'tile' }: { project: ProjectCardModel; href: string; previewHover?: boolean; layout?: 'tile' | 'row' }) {
  const navigate = useNavigate()
  const tilt = useCardTilt()
  const progress = project.objectiveCount ? Math.round((project.completedCount / project.objectiveCount) * 100) : 0
  const description = project.objective?.trim() || 'No description yet'
  const label = [
    `Open ${project.title}`,
    project.objectiveCount ? `${project.completedCount} of ${project.objectiveCount} objectives complete` : 'No objectives yet',
    dateLabel(project.target_date),
    project.status,
  ].join(', ')

  return (
    <Link
      ref={tilt.ref as never}
      to={href}
      className={`project-card focus-ring${previewHover ? ' is-preview-hover' : ''}${layout === 'row' ? ' is-row' : ''}`}
      aria-label={label}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        event.preventDefault()
        navigateWithTransition(navigate, href)
      }}
    >
      <span className="project-card-art">
        <ProjectCover project={project} />
      </span>
      <span className="project-card-corners" aria-hidden="true" />
      <span className="project-card-gem" data-status={project.status}>{project.status}</span>
      <span className="project-card-plate">
        <h2 className="project-card-title">{project.title}</h2>
        <p className="project-card-copy">{description}</p>
        <span className="project-card-meta">
          <span className="project-card-meta-start">
            <span>
              <strong>{project.completedCount}/{project.objectiveCount}</strong>
              {' '}objectives
            </span>
            <span>
              <CalendarDays size={12} aria-hidden="true" />
              {dateLabel(project.target_date)}
            </span>
          </span>
          <MemberAvatars members={project.members} />
        </span>
      </span>
      {project.objectiveCount > 0 && (
        <span className="project-card-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
      )}
    </Link>
  )
}

export function NewProjectTile({ onClick }: { onClick: () => void }) {
  const tilt = useCardTilt()
  return (
    <button
      ref={tilt.ref as never}
      type="button"
      className="project-card-add focus-ring"
      onClick={onClick}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <span className="project-card-art" aria-hidden="true" />
      <span className="project-card-add-slot" aria-hidden="true" />
      <span className="project-card-corners" aria-hidden="true" />
      <span className="project-card-add-icon" aria-hidden="true"><Plus size={26} /></span>
      <span className="project-card-add-label">New project</span>
    </button>
  )
}

export function ProjectGridSkeleton() {
  return (
    <div className="project-grid" aria-hidden="true">
      <div className="project-card-skeleton" />
      <div className="project-card-skeleton" />
      <div className="project-card-skeleton" />
    </div>
  )
}

export function ProjectHero({
  project,
  actions,
  progress = 0,
  eyebrow,
}: {
  project: Pick<Project, 'id' | 'title' | 'objective' | 'status' | 'target_date'> & { cover_url?: string | null }
  actions?: ReactNode
  progress?: number
  eyebrow?: ReactNode
}) {
  return (
    <header className="project-hero">
      <div className="project-hero-art">
        <ProjectCover project={project} />
        <span className="project-card-corners" aria-hidden="true" />
        <div className="project-hero-plate">
          <span className="project-card-gem" data-status={project.status}>{project.status}</span>
          {eyebrow && <p className="project-hero-eyebrow">{eyebrow}</p>}
          <h1 className="project-hero-title">{project.title}</h1>
          <p className="project-hero-copy">{project.objective?.trim() || 'No project description yet.'}</p>
          <p className="project-card-meta">
            <span className="project-card-meta-start">
              <span>
                <CalendarDays size={13} aria-hidden="true" />
                {dateLabel(project.target_date)}
              </span>
            </span>
          </p>
        </div>
        <span className="project-card-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
      </div>
      {actions && <div className="project-hero-actions">{actions}</div>}
    </header>
  )
}

