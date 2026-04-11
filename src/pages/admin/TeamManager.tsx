import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import type { TeamMember } from '../../types'
import {
  Users, Plus, X, Loader2, Edit2, Trash2, Search, Shield, UserCheck,
  Mail, Phone, Calendar as CalendarIcon, Save, ChevronRight,
  MoreVertical, UserPlus, Filter,
} from 'lucide-react'

const POSITIONS = [
  { value: 'owner', label: 'Owner / Lead Engineer', color: 'bg-gold/10 text-gold' },
  { value: 'marketing_admin', label: 'Marketing / Admin', color: 'bg-emerald-500/10 text-emerald-400' },
  { value: 'artist_development', label: 'Artist Development', color: 'bg-violet-500/10 text-violet-400' },
  { value: 'intern', label: 'Intern', color: 'bg-sky-500/10 text-sky-400' },
  { value: 'engineer', label: 'Audio Engineer', color: 'bg-amber-500/10 text-amber-400' },
  { value: 'producer', label: 'Producer', color: 'bg-rose-500/10 text-rose-400' },
]

type MemberForm = {
  display_name: string; email: string; role: 'admin' | 'member'
  position: string; phone: string; start_date: string; status: 'active' | 'inactive'
  managed_by: string
}

const EMPTY_MEMBER: MemberForm = {
  display_name: '', email: '', role: 'member', position: 'intern',
  phone: '', start_date: '', status: 'active', managed_by: '',
}

export default function TeamManager() {
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

    if (editingMember) {
      const { error } = await supabase.from('intern_users').update({
        display_name: formData.display_name,
        role: formData.role,
        position,
        phone: formData.phone,
        start_date: formData.start_date || null,
        status: formData.status,
        managed_by: formData.managed_by || null,
      }).eq('id', editingMember.id)
      if (error) toast('Failed to update member', 'error')
      else toast('Member updated')
    } else {
      const { error } = await supabase.from('intern_users').insert({
        id: crypto.randomUUID(),
        display_name: formData.display_name,
        email: formData.email,
        role: formData.role,
        position,
        phone: formData.phone || null,
        start_date: formData.start_date || null,
        status: formData.status,
        managed_by: formData.managed_by || null,
      })
      if (error) toast('Failed to add member', 'error')
      else toast('Member added')
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

  const getPositionStyle = (pos: string) =>
    POSITIONS.find(p => p.value === pos)?.color ?? 'bg-surface-alt text-text-muted'

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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Team Manager
            <span className="text-sm font-medium text-text-muted bg-surface-alt px-2.5 py-0.5 rounded-full">
              {members.length}
            </span>
          </h1>
          <p className="text-text-muted text-sm mt-1">Manage team members, roles, positions, and reporting structure</p>
        </div>
        <button onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-all">
          <UserPlus size={16} />
          Add Member
        </button>
      </div>

      {/* Toolbar: search + filters */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
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
          <Filter size={12} className="text-text-light" />
          {Object.entries(positionCounts).map(([pos, count]) => (
            <button key={pos} onClick={() => setPositionFilter(positionFilter === pos ? 'all' : pos)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                positionFilter === pos ? 'ring-2 ring-gold ring-offset-1 ring-offset-bg' : ''
              } ${getPositionStyle(pos)}`}>
              <span>{getPositionLabel(pos)}</span>
              <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          ))}
          {positionFilter !== 'all' && (
            <button onClick={() => setPositionFilter('all')}
              className="text-xs text-text-muted hover:text-gold px-2 py-1">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Member grid */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center">
          {members.length === 0 ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-gold" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No team members yet</h3>
              <p className="text-sm text-text-muted mb-4">Get started by adding your first team member.</p>
              <button onClick={openAddForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-all">
                <UserPlus size={16} /> Add First Member
              </button>
            </>
          ) : (
            <>
              <Search size={32} className="mx-auto mb-3 text-text-light opacity-30" />
              <p className="text-text-muted">No members match your filters.</p>
              <button onClick={() => { setSearch(''); setPositionFilter('all'); setStatusFilter('all') }}
                className="text-sm text-gold font-medium mt-2 hover:underline">
                Clear all filters
              </button>
            </>
          )}
        </div>
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
                    <Loader2 size={20} className="animate-spin text-gold" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold shrink-0">
                      {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{member.display_name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${getPositionStyle(member.position ?? 'intern')}`}>
                        {getPositionLabel(member.position ?? 'intern')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${member.status === 'active' ? 'bg-emerald-400' : 'bg-text-light'}`}
                      title={member.status === 'active' ? 'Active' : 'Inactive'} />

                    <div className="relative" ref={openMenuId === member.id ? menuRef : undefined}>
                      <button onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <MoreVertical size={14} />
                      </button>

                      {openMenuId === member.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl z-20 py-1 animate-fade-in">
                          <button onClick={() => handleEdit(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors">
                            <Edit2 size={12} /> Edit Member
                          </button>
                          <button onClick={() => toggleRole(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-surface-hover transition-colors">
                            <Shield size={12} /> {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button onClick={() => toggleStatus(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors">
                            <UserCheck size={12} /> {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button onClick={() => requestDelete(member)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} /> Remove Member
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-text-muted mb-3">
                  <p className="flex items-center gap-1.5 truncate"><Mail size={12} className="shrink-0" /> {member.email}</p>
                  {member.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="shrink-0" /> {member.phone}</p>}
                  {member.start_date && <p className="flex items-center gap-1.5"><CalendarIcon size={12} className="shrink-0" /> Started {member.start_date}</p>}
                </div>

                <div className="flex items-center gap-2 text-xs mb-3">
                  {member.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 text-gold font-medium">
                      <Shield size={10} /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-alt text-text-muted font-medium">
                      <UserCheck size={10} /> Member
                    </span>
                  )}
                  {member.status === 'inactive' && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium text-[10px]">
                      Inactive
                    </span>
                  )}
                </div>

                {managerName && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-1 text-xs">
                      <Users size={12} className="text-violet-400 shrink-0" />
                      <span className="text-text-light">Reports to</span>
                      <span className="font-medium text-text">{managerName}</span>
                    </div>
                    {chain.length > 1 && (
                      <div className="flex items-center gap-0.5 flex-wrap pl-4 mt-1">
                        {[...chain].reverse().map((name, i) => (
                          <span key={i} className="flex items-center gap-0.5 text-[10px] text-text-light">
                            {i > 0 && <ChevronRight size={8} />}
                            {name}
                          </span>
                        ))}
                        <ChevronRight size={8} className="text-text-light" />
                        <span className="text-[10px] text-gold font-medium">{member.display_name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border">
                  <button onClick={() => handleEdit(member)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gold hover:bg-gold/10 transition-colors">
                    <Edit2 size={12} /> Edit Details
                  </button>
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
          <aside className="absolute right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-in"
            style={{ animationDirection: 'normal' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-lg">{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-muted">Full Name *</label>
                  <input required value={formData.display_name}
                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                    placeholder="Jane Smith" autoFocus />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-muted">Email {editingMember ? '' : '*'}</label>
                  <input type="email" required={!editingMember} disabled={!!editingMember}
                    value={editingMember ? editingMember.email : formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm disabled:bg-surface-alt disabled:text-text-muted"
                    placeholder="jane@example.com" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Position</label>
                    <select value={formData.position}
                      onChange={e => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                      {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      <option value="custom">Custom Position...</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Role</label>
                    <select value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'member' })}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {formData.position === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Custom Position Name</label>
                    <input value={customPosition} onChange={e => setCustomPosition(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                      placeholder="e.g. Session Musician" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-muted">Reports To</label>
                  <select value={formData.managed_by}
                    onChange={e => setFormData({ ...formData, managed_by: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                    <option value="">No Manager (Top Level)</option>
                    {adminsAndOwners
                      .filter(m => m.id !== editingMember?.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.display_name} ({getPositionLabel(m.position ?? 'intern')})</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Phone</label>
                    <input value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                      placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Start Date</label>
                    <input type="date" value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-muted">Status</label>
                  <select value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface">
                <button type="button" onClick={closeForm}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-surface-hover transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50 transition-all">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingMember ? 'Update Member' : 'Add Member'}
                </button>
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
