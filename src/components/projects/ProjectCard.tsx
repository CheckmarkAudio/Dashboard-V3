import { CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Project, ProjectMember } from '../../lib/queries/projects'
import { projectCover } from './projectCover'
import './ProjectGrid.css'

export interface ProjectCardModel extends Project {
  cover_url?: string | null
  objectiveCount: number
  completedCount: number
  members: ProjectMember[]
}

function dateLabel(value: string | null): string {
  if (!value) return 'No target date'
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ProgressRing({ value }: { value: number }) {
  const size = 52
  const stroke = 4.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="project-card-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="rgba(20,14,8,.32)" stroke="rgba(255,255,255,.28)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="project-card-ring-label">
        {value}%
      </text>
    </svg>
  )
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

export function ProjectCard({ project, href }: { project: ProjectCardModel; href: string }) {
  const cover = projectCover(project.id, project.title)
  const progress = project.objectiveCount ? Math.round((project.completedCount / project.objectiveCount) * 100) : 0
  const description = project.objective?.trim() || 'No description yet'
  const label = [
    `Open ${project.title}`,
    project.objectiveCount ? `${project.completedCount} of ${project.objectiveCount} objectives complete` : 'No objectives yet',
    dateLabel(project.target_date),
    project.status,
  ].join(', ')

  return (
    <Link to={href} className="project-card focus-ring" aria-label={label}>
      <div className="project-card-cover" style={project.cover_url ? undefined : { backgroundImage: cover.background }}>
        {project.cover_url ? (
          <img src={project.cover_url} alt="" className="project-card-cover-image" />
        ) : (
          <span className="project-card-monogram">{cover.initials}</span>
        )}
        <span className="project-card-status" data-status={project.status}>{project.status}</span>
        {project.objectiveCount > 0 && <ProgressRing value={progress} />}
      </div>
      <div className="project-card-body">
        <h2 className="project-card-title">{project.title}</h2>
        <p className="project-card-copy">{description}</p>
        <div className="project-card-meta">
          <div className="project-card-meta-start">
            <span>
              <strong className="text-text">{project.completedCount}/{project.objectiveCount}</strong>
              {' '}objectives
            </span>
            <span>
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel(project.target_date)}
            </span>
          </div>
          <MemberAvatars members={project.members} />
        </div>
      </div>
    </Link>
  )
}

export function NewProjectTile({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="project-card-add focus-ring" onClick={onClick}>
      <span className="project-card-add-icon" aria-hidden="true"><Plus size={26} /></span>
      New project
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
