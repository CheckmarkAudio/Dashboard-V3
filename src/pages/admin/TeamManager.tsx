import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizeEmail } from '../../lib/email'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import { Button, Input, Select, Badge, EmptyState, PageHeader } from '../../components/ui'
import type { TeamMember } from '../../types'
import {
  Users, X, Loader2, Edit2, Trash2, Search, Shield, UserCheck,
  Mail, Phone, Calendar as CalendarIcon, Save, ChevronRight,
  MoreVertical, UserPlus, Filter,
} from 'lucide-react'

import type { BadgeVariant } from '../../components/ui'

const POSITIONS: { value: string; label: string; badge: BadgeVariant }[] = [
  { value: 'owner',              label: 'Owner / Lead Engineer', badge: 'gold' },
  { value: 'marketing_admin',    label: 'Marketing / Admin',     badge: 'success' },
  { value: 'artist_development', label: 'Artist Development',    badge: 'stage-share' },
  { value: 'intern',             label: 'Intern',                badge: 'info' },
  { value: 'engineer',           label: 'Audio Engineer',        badge: 'warning' },
  { value: 'producer',           label: 'Producer',              badge: 'stage-book' },
]

type MemberForm = {
  display_name: string; email: string; role: 'admin' | 'member'
  position: string; phone: string; start_date: string; status: 'active' | 'inactive'
  managed_by: string
  default_password: string
}

const EMPTY_MEMBER: MemberForm = {
  display_name: '', email: '', role: 'member', position: 'intern',
  phone: '', start_date: '', status: 'active', managed_by: '',
  default_password: '',
}

export default function TeamManager() {
  useDocumentTitle('Team Manager - Checkmark Audio')
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<MemberForm>(EMPTY_MEMBER)
  const [customPosition, setCustomPosition] = useState('')

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [confirmState, setConfirmState] = useState<{
    open: boolean; memberId: string; memberName: string; loading: boolean
  }>({ open: false, memberId: '', memberName: '', loading: false })

  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    if (!openMenuId) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenuId])

  const loadMembers = async () => {
    const { data } = await supabase.from('intern_users').select('*').order('display_name')
    if (data) setMembers(data as TeamMember[])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const position = formData.position === 'custom' ? customPosition : formData.position
    const email = normalizeEmail(formData.email)

    if (editingMember) {
      const { error } = await supabase.from('intern_users').update({
        display_name: formData.display_name.trim(),
        role: formData.role,
        position,
        phone: formData.phone.trim() || null,
        start_date: formData.start_date || null,
        status: formData.status,
        managed_by: formData.managed_by || null,
      }).eq('id', editingMember.id)
      if (error) {
        console.error('[TeamManager] Update member failed:', error)
        toast(error.message || 'Failed to update member', 'error')
        setSubmitting(false)
        return
      }
      toast('Member updated')
    } else {
      if (!email) {
        toast('Email is required', 'error')
        setSubmitting(false)
        return
      }
      if (formData.default_password.length < 8) {
        toast('Default password must be at least 8 characters', 'error')
        setSubmitting(false)
        return
      }

      // Admin-create-member Edge Function: creates the auth user (with the
      // admin-supplied default password) AND the intern_users row atomically.
      // See supabase/functions/admin-create-member/index.ts.
      const { data: result, error } = await supabase.functions.invoke<
        { ok: boolean; profile?: TeamMember; error?: string }
      >('admin-create-member', {
        body: {
          email,
          display_name: formData.display_name.trim(),
          default_password: formData.default_password,
          role: formData.role,
          position,
          phone: formData.phone.trim() || null,
          start_date: formData.start_date || null,
          status: formData.status,
          managed_by: formData.managed_by || null,
        },
      })

      if (error || !result?.ok) {
        // supabase.functions.invoke wraps non-2xx responses in a generic
        // FunctionsHttpError ("Edge Function returned a non-2xx status code")
        // and stuffs the actual response on error.context. Read it so the
        // toast shows the real reason instead of the wrapper.
        let msg = result?.error || error?.message || 'Failed to add member'
        const ctx = (error as { context?: Response } | null)?.context
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text()
            if (raw) {
              try {
                const parsed = JSON.parse(raw)
                if (parsed?.error) msg = parsed.error
                else if (parsed?.message) msg = parsed.message
                else msg = raw
              } catch {
                msg = raw
              }
            }
          } catch {
            // fall through with the original message
          }
        }
        console.error('[TeamManager] admin-create-member failed:', msg, error, result)
        toast(msg, 'error')
        setSubmitting(false)
        return
      }
      toast(`Member added — share the default password with them`)
    }

    closeForm()
    setSubmitting(false)
    loadMembers()
  }

  const openAddForm = () => {
    setEditingMember(null)
    setFormData(EMPTY_MEMBER)
    setCustomPosition('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingMember(null)
    setFormData(EMPTY_MEMBER)
    setCustomPosition('')
  }

  const handleEdit = (member: TeamMember) => {
    const knownPosition = POSITIONS.find(p => p.value === member.position)
    setEditingMember(member)
    setFormData({
      display_name: member.display_name,
      email: member.email,
      role: member.role as 'admin' | 'member',
      position: knownPosition ? (member.position ?? 'intern') : 'custom',
      phone: member.phone ?? '',
      start_date: member.start_date ?? '',
      status: (member.status ?? 'active') as 'active' | 'inactive',
      managed_by: member.managed_by ?? '',
      // default_password is only meaningful for new-member creation; not editable here.
      default_password: '',
    })
    if (!knownPosition) setCustomPosition(member.position ?? '')
    setShowForm(true)
    setOpenMenuId(null)
  }

  const requestDelete = (member: TeamMember) => {
    setOpenMenuId(null)
    setConfirmState({ open: true, memberId: member.id, memberName: member.display_name, loading: false })
  }

  const handleDelete = async () => {
    setConfirmState(s => ({ ...s, loading: true }))
    const { error } = await supabase.from('intern_users').delete().eq('id', confirmState.memberId)
    if (error) toast('Failed to remove member', 'error')
    else toast('Member removed')
    setConfirmState({ open: false, memberId: '', memberName: '', loading: false })
    loadMembers()
  }

  const toggleStatus = async (member: TeamMember) => {
    setOpenMenuId(null)
    setActionLoadingId(member.id)
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('intern_users').update({ status: newStatus }).eq('id', member.id)
    if (error) toast('Failed to update status', 'error')
    else toast(`Member ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    setActionLoadingId(null)
    loadMembers()
  }

  const toggleRole = async (member: TeamMember) => {
    setOpenMenuId(null)
    setActionLoadingId(member.id)
    const newRole = member.role === 'admin' ? 'member' : 'admin'
    const { error } = await supabase.from('intern_users').update({ role: newRole }).eq('id', member.id)
    if (error) toast('Failed to update role', 'error')
    else toast(`Role updated to ${newRole}`)
    setActionLoadingId(null)
    loadMembers()
  }

  const getPositionVariant = (pos: string): BadgeVariant =>
    POSITIONS.find(p => p.value === pos)?.badge ?? 'neutral'

  const getPositionLabel = (pos: string) =>
    POSITIONS.find(p => p.value === pos)?.label ?? pos

  const getManagerName = (managedBy: string | undefined) => {
    if (!managedBy) return null
    return members.find(m => m.id === managedBy)?.display_name ?? null
  }

  const getReportChain = (member: TeamMember): string[] => {
    const chain: string[] = []
    let current = member.managed_by
    const visited = new Set<string>()
    while (current && !visited.has(current)) {
      visited.add(current)
      const mgr = members.find(m => m.id === current)
      if (mgr) {
        chain.push(mgr.display_name)
        current = mgr.managed_by
      } else break
    }
    return chain
  }

  const adminsAndOwners = members.filter(m => m.role === 'admin' || m.position === 'owner')

  const filtered = members
    .filter(m => positionFilter === 'all' || m.position === positionFilter)
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .filter(m => {
      if (!search) return true
      const s = search.toLowerCase()
      return m.display_name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)
    })

  const positionCounts = members.reduce<Record<string, number>>((acc, m) => {
    const pos = m.position ?? 'intern'
    acc[pos] = (acc[pos] ?? 0) + 1
    return acc
  }, {})

  const activeCount = members.filter(m => m.status === 'active').length
  const inactiveCount = members.length - activeCount

  if (loading) return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      <PageHeader
        icon={Users}
        title={
          <span className="inline-flex items-center gap-2">
            Team Manager
            <span className="text-sm font-medium text-text-muted bg-surface-alt px-2.5 py-0.5 rounded-full">
              {members.length}
            </span>
          </span>
        }
        subtitle="Manage team members, roles, positions, and reporting structure"
        actions={
          <Button
            variant="primary"
            onClick={openAddForm}
            iconLeft={<UserPlus size={16} aria-hidden="true" />}
          >
            Add Member
          </Button>
        }
      />

      {/* Toolbar: search + filters */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              aria-label="Search team members"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm" />
          </div>
          <div className="flex items-center gap-1 bg-surface-alt rounded-lg p-0.5">
            {([
              { key: 'all' as const, label: 'All', count: members.length },
              { key: 'active' as const, label: 'Active', count: activeCount },
              { key: 'inactive' as const, label: 'Inactive', count: inactiveCount },
            ]).map(opt => (
              <button key={opt.key} onClick={() => setStatusFilter(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-surface text-gold shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}>
                {opt.label}
                <span className="ml-1 opacity-60">{opt.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-text-light" aria-hidden="true" />
          {Object.entries(positionCounts).map(([pos, count]) => {
            const isActive = positionFilter === pos
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(isActive ? 'all' : pos)}
                className={`rounded-full focus-ring transition-all ${
                  isActive ? 'ring-2 ring-gold ring-offset-1 ring-offset-bg' : ''
                }`}
                aria-pressed={isActive}
              >
                <Badge variant={getPositionVariant(pos)}>
                  <span>{getPositionLabel(pos)}</span>
                  <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[10px]">{count}</span>
                </Badge>
              </button>
            )
          })}
          {positionFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setPositionFilter('all')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Member grid */}
      {filtered.length === 0 ? (
        members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Get started by adding your first team member."
            action={
              <Button variant="primary" onClick={openAddForm} iconLeft={<UserPlus size={16} aria-hidden="true" />}>
                Add First Member
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No matches"
            description="No members match your current filters."
            action={
              <Button
                variant="ghost"
                onClick={() => { setSearch(''); setPositionFilter('all'); setStatusFilter('all') }}
              >
                Clear all filters
              </Button>
            }
          />
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => {
            const managerName = getManagerName(member.managed_by)
            const chain = getReportChain(member)
            const isLoading = actionLoadingId === member.id

            return (
              <div key={member.id}
                className={`bg-surface rounded-2xl border border-border p-5 transition-all hover:shadow-lg hover:border-border-light group ${
                  isLoading ? 'opacity-70 pointer-events-none' : ''
                }`}>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 size={20} className="animate-spin text-gold" aria-hidden="true" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold shrink-0">
                      {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{member.display_name}</h3>
                      <Badge
                        variant={getPositionVariant(member.position ?? 'intern')}
                        size="sm"
                        className="mt-0.5"
                      >
                        {getPositionLabel(member.position ?? 'intern')}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${member.status === 'active' ? 'bg-emerald-400' : 'bg-text-light'}`}
                      title={member.status === 'active' ? 'Active' : 'Inactive'}
                      aria-hidden="true" />

                    <div className="relative" ref={openMenuId === member.id ? menuRef : undefined}>
                      <button onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Actions for ${member.display_name}`}
                        aria-expanded={openMenuId === member.id}
                        aria-haspopup="menu">
                        <MoreVertical size={14} aria-hidden="true" />
                      </button>

                      {openMenuId === member.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl z-20 py-1 animate-fade-in" role="menu">
                          <button role="menuitem" onClick={() => handleEdit(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors">
                            <Edit2 size={12} aria-hidden="true" /> Edit Member
                          </button>
                          <button role="menuitem" onClick={() => toggleRole(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-surface-hover transition-colors">
                            <Shield size={12} aria-hidden="true" /> {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button role="menuitem" onClick={() => toggleStatus(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors">
                            <UserCheck size={12} aria-hidden="true" /> {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button role="menuitem" onClick={() => requestDelete(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} aria-hidden="true" /> Remove Member
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-text-muted mb-3">
                  <p className="flex items-center gap-1.5 truncate"><Mail size={12} className="shrink-0" aria-hidden="true" /> {member.email}</p>
                  {member.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="shrink-0" aria-hidden="true" /> {member.phone}</p>}
                  {member.start_date && <p className="flex items-center gap-1.5"><CalendarIcon size={12} className="shrink-0" aria-hidden="true" /> Started {member.start_date}</p>}
                </div>

                <div className="flex items-center gap-2 text-xs mb-3">
                  {member.role === 'admin' ? (
                    <Badge variant="gold" icon={<Shield size={10} aria-hidden="true" />}>Admin</Badge>
                  ) : (
                    <Badge variant="neutral" icon={<UserCheck size={10} aria-hidden="true" />}>Member</Badge>
                  )}
                  {member.status === 'inactive' && (
                    <Badge variant="danger" size="sm">Inactive</Badge>
                  )}
                </div>

                {managerName && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-1 text-xs">
                      <Users size={12} className="text-violet-400 shrink-0" aria-hidden="true" />
                      <span className="text-text-light">Reports to</span>
                      <span className="font-medium text-text">{managerName}</span>
                    </div>
                    {chain.length > 1 && (
                      <div className="flex items-center gap-0.5 flex-wrap pl-4 mt-1">
                        {[...chain].reverse().map((name, i) => (
                          <span key={i} className="flex items-center gap-0.5 text-[10px] text-text-light">
                            {i > 0 && <ChevronRight size={8} aria-hidden="true" />}
                            {name}
                          </span>
                        ))}
                        <ChevronRight size={8} className="text-text-light" aria-hidden="true" />
                        <span className="text-[10px] text-gold font-medium">{member.display_name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    onClick={() => handleEdit(member)}
                    iconLeft={<Edit2 size={12} aria-hidden="true" />}
                    className="text-gold hover:text-gold hover:bg-gold/10"
                  >
                    Edit Details
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Slide-over form */}
      {showForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-manager-panel-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 id="team-manager-panel-title" className="font-semibold text-lg">
                {editingMember ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeForm}
                aria-label="Close"
                className="!p-1.5"
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-6 space-y-5 flex-1">
                <Input
                  id="team-member-display-name"
                  label="Full Name"
                  required
                  autoFocus
                  placeholder="Jane Smith"
                  value={formData.display_name}
                  onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                />

                <Input
                  id="team-member-email"
                  label="Email"
                  type="email"
                  required={!editingMember}
                  disabled={!!editingMember}
                  placeholder="jane@example.com"
                  hint={
                    editingMember
                      ? 'Email is immutable after a member is created.'
                      : 'Will be normalized to lowercase on save.'
                  }
                  value={editingMember ? (editingMember.email ?? '') : formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />

                {!editingMember && (
                  <Input
                    id="team-member-default-password"
                    label="Default Password"
                    type="text"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    hint="Share this with the member. They'll be prompted to change it on first sign-in."
                    value={formData.default_password}
                    onChange={e => setFormData({ ...formData, default_password: e.target.value })}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    id="team-member-position"
                    label="Position"
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                  >
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    <option value="custom">Custom Position...</option>
                  </Select>
                  <Select
                    id="team-member-role"
                    label="Role"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'member' })}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>

                {formData.position === 'custom' && (
                  <Input
                    id="team-member-custom-position"
                    label="Custom Position Name"
                    placeholder="e.g. Session Musician"
                    value={customPosition}
                    onChange={e => setCustomPosition(e.target.value)}
                  />
                )}

                <Select
                  id="team-member-managed-by"
                  label="Reports To"
                  value={formData.managed_by}
                  onChange={e => setFormData({ ...formData, managed_by: e.target.value })}
                >
                  <option value="">No Manager (Top Level)</option>
                  {adminsAndOwners
                    .filter(m => m.id !== editingMember?.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({getPositionLabel(m.position ?? 'intern')})
                      </option>
                    ))}
                </Select>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="team-member-phone"
                    label="Phone"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <Input
                    id="team-member-start-date"
                    label="Start Date"
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <Select
                  id="team-member-status"
                  label="Status"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface">
                <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  iconLeft={!submitting ? <Save size={16} aria-hidden="true" /> : undefined}
                >
                  {editingMember ? 'Update Member' : 'Add Member'}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${confirmState.memberName}? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={confirmState.loading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmState({ open: false, memberId: '', memberName: '', loading: false })}
      />
    </div>
  )
}
