import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchProjects, projectKeys } from '../../lib/queries/projects'
import { supabase } from '../../lib/supabase'
import { APP_ROUTES } from '../../app/routes'

export function useOverviewProjects() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: fetchProjects,
    enabled: Boolean(profile?.id),
    select: projects => projects.filter(project => project.status !== 'completed' && project.status !== 'archived'),
    refetchInterval: 60_000,
  })
}

export default function OverviewProjectsPanel() {
  const query = useOverviewProjects()
  const projects = (query.data ?? []).slice(0, 6)
  const ids = projects.map(project => project.id)
  const progressQuery = useQuery({
    queryKey: [...projectKeys.all, 'overview-objectives', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_objectives')
        .select('project_id, is_completed').in('project_id', ids)
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 60_000,
  })
  if (query.isLoading) return <p role="status" className="p-6 text-sm text-text-muted">Loading projects…</p>
  if (query.isError) return <div className="p-6 text-sm"><p>Could not load projects.</p><button onClick={() => void query.refetch()} className="mt-2 text-gold focus-ring">Try again</button></div>
  if (!projects.length) return <p className="p-6 text-sm text-text-muted">No active projects. Open Projects to start one or review completed work.</p>
  return <div>
    <div className="overview-project-columns bg-surface-alt border-b border-border px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted" aria-hidden="true"><span>Project</span><span>Progress</span><span>Due</span><span /></div>
    <div className="divide-y divide-border">{projects.map(project => {
      const objectives = (progressQuery.data ?? []).filter(item => item.project_id === project.id)
      const completed = objectives.filter(item => item.is_completed).length
      const progress = objectives.length ? Math.round(completed / objectives.length * 100) : 0
      return <Link key={project.id} to={`${APP_ROUTES.member.projects}?project=${encodeURIComponent(project.id)}`} className="overview-project-columns px-5 py-5 hover:bg-surface-alt focus-ring">
        <span className="flex items-center gap-3 min-w-0">
          <span className="overview-project-monogram" aria-hidden="true">{project.title.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>
          <span className="min-w-0"><strong className="block truncate text-sm">{project.title}</strong><span className="block truncate mt-1 text-xs text-text-muted">{project.objective || project.status}</span></span>
        </span>
        <span className="text-xs text-text-muted" aria-label={progressQuery.isError ? 'Progress unavailable' : progressQuery.isLoading ? 'Loading progress' : `${completed} of ${objectives.length} objectives complete`}>
          {progressQuery.isLoading ? '…' : progressQuery.isError ? 'Unavailable' : objectives.length ? <span className="flex items-center gap-2"><span className="h-1.5 flex-1 rounded bg-surface-alt overflow-hidden"><span className="block h-full bg-gold" style={{ width: `${progress}%` }} /></span>{progress}%</span> : 'No objectives'}
        </span>
        <span className="text-xs text-text-muted">{project.target_date ? new Date(`${project.target_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</span>
        <ArrowUpRight size={15} className="text-gold" aria-hidden="true" />
      </Link>
    })}</div>
    {(query.data?.length ?? 0) > 6 && <p className="px-5 py-3 text-xs text-text-muted border-t border-border">Showing 6 of {query.data!.length} active projects. View all for the complete list.</p>}
  </div>
}
