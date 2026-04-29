import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeEmail } from '../../lib/email'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import { Button, Input, Select, Badge, EmptyState, PageHeader } from '../../components/ui'
import {
  loadActiveTemplates,
  loadDefaultTemplateIdsForPosition,
  assignTemplatesToMember,
  generateTodayChecklist,
} from '../../lib/queries/templates'
import type { TeamMember, ReportTemplate } from '../../types'
import {
  Users, X, Loader2, Edit2, Trash2, Search, Shield, UserCheck,
  Mail, Phone, Save, ChevronRight, ChevronLeft,
  MoreVertical, UserPlus, Filter, Check, ClipboardList,
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
  display_name: string; email: string; role: 'admin' | 'intern'
  position: string; phone: string; start_date: string; status: 'active' | 'inactive'
  managed_by: string
  default_password: string
  // PR #49 — when true (default), the admin enters NO password; the
  // edge function generates a strong random one server-side and we
  // fire `auth.resetPasswordForEmail()` after creation so the new
  // member receives a setup link and picks their own password.
  // When false, the admin enters a temp password to share manually
  // (offline / walk-in adds).
  send_setup_email: boolean
}

const EMPTY_MEMBER: MemberForm = {
  display_name: '', email: '', role: 'intern', position: 'intern',
  phone: '', start_date: '', status: 'active', managed_by: '',
  default_password: '',
  send_setup_email: true,
}

export default function TeamManager() {
  useDocumentTitle('Team Manager - Checkmark Workspace')
  const { toast } = useToast()
  const { profile } = useAuth()
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

  // ─── Phase 6.3 — Multi-step Add Member state ───────────────────────
  // Step 1 = profile (existing fields), Step 2 = templates, Step 3 = review.
  // Editing an existing member always stays a single-step form (step 1).
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [dailyTemplates, setDailyTemplates] = useState<ReportTemplate[]>([])
  const [weeklyTemplates, setWeeklyTemplates] = useState<ReportTemplate[]>([])
  const [selectedDailyTemplateIds, setSelectedDailyTemplateIds] = useState<Set<string>>(new Set())
  const [selectedWeeklyTemplateIds, setSelectedWeeklyTemplateIds] = useState<Set<string>>(new Set())
  const [templatesLoading, setTemplatesLoading] = useState(false)

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
    const { data } = await supabase.from('team_members').select('*').order('display_name')
    if (data) setMembers(data as TeamMember[])
    setLoading(false)
  }

  // ─── Multi-step Add Member helpers (Phase 6.3) ─────────────────────
  // Step 1 → 2 → 3, with edit-mode bypassing the multi-step flow entirely.

  const validateStep1 = (): string | null => {
    if (!formData.display_name.trim()) return 'Full name is required'
    if (!editingMember) {
      const email = normalizeEmail(formData.email)
      if (!email) return 'Email is required'
      // PR #49 — when send_setup_email is on (default), the edge
      // function generates a strong random password server-side and
      // we email a reset link, so admin doesn't need to enter one.
      // Only require a password when the admin opted into manual
      // share mode (offline / walk-in adds).
      if (!formData.send_setup_email && formData.default_password.length < 8) {
        return 'Temporary password must be at least 8 characters'
      }
    }
    if (formData.position === 'custom' && !customPosition.trim()) {
      return 'Custom position name is required'
    }
    return null
  }

  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) { toast(err, 'error'); return }
      setStep(2)
      return
    }
    if (step === 2) {
      setStep(3)
      return
    }
  }

  const handleBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Edit mode is single-step — preserve the existing flow exactly.
    if (editingMember) {
      setSubmitting(true)
      const position = formData.position === 'custom' ? customPosition : formData.position
      const { error } = await supabase.from('team_members').update({
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
      closeForm()
      setSubmitting(false)
      loadMembers()
      return
    }

    // Add mode — submit only fires from step 3. Steps 1 + 2 advance via
    // handleNext, never via form submission.
    if (step !== 3) {
      handleNext()
      return
    }

    setSubmitting(true)
    const position = formData.position === 'custom' ? customPosition : formData.position
    const email = normalizeEmail(formData.email)

    // 1) Create the auth user + team_members row atomically via the Edge Function.
    //    PR #49 — when send_setup_email is on, we omit `default_password`
    //    entirely; the edge function generates one server-side. The plaintext
    //    is never returned to the client. We then trigger the recovery email
    //    below so the member can pick their own password.
    const { data: result, error } = await supabase.functions.invoke<
      {
        ok: boolean
        profile?: TeamMember
        error?: string
        where?: string
        password_was_generated?: boolean
      }
    >('admin-create-member', {
      body: {
        email,
        display_name: formData.display_name.trim(),
        // Only send a password when the admin opted into manual share
        // mode. Omitting the field cleanly triggers the server-side
        // random-generation path.
        ...(formData.send_setup_email
          ? {}
          : { default_password: formData.default_password }),
        role: formData.role,
        position,
        phone: formData.phone.trim() || null,
        start_date: formData.start_date || null,
        status: formData.status,
        managed_by: formData.managed_by || null,
      },
    })

    if (error || !result?.ok || !result.profile) {
      // Read the function's actual JSON body off error.context (the
      // generic FunctionsHttpError wrapper hides it otherwise).
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
        } catch { /* fall through */ }
      }
      console.error('[TeamManager] admin-create-member failed:', msg, error, result)
      toast(msg, 'error')
      setSubmitting(false)
      return
    }

    const newMember = result.profile

    // 2) Assign the templates the admin selected. Non-fatal — if it
    //    fails the member still exists, just empty checklists.
    const templateIds = [
      ...Array.from(selectedDailyTemplateIds),
      ...Array.from(selectedWeeklyTemplateIds),
    ]
    if (templateIds.length > 0) {
      try {
        await assignTemplatesToMember(newMember.id, templateIds, profile?.id)
      } catch (assignErr) {
        console.error('[TeamManager] template assignment failed:', assignErr)
        toast(
          'Member created, but template assignment failed. Assign manually from Templates.',
          'error',
        )
      }
    }

    // 3) Generate today's checklist instance so the new member sees
    //    their first day's tasks immediately on first login. Non-fatal.
    try {
      await generateTodayChecklist(newMember.id)
    } catch (genErr) {
      console.error('[TeamManager] checklist generation failed:', genErr)
      // Quiet — most common reason is "no templates assigned yet", which
      // is fine.
    }

    // 4) PR #49 — when the admin chose "Email a setup link", trigger
    //    Supabase's standard recovery email so the new member receives
    //    a single-use link to set their own password. The link lands
    //    on the app with `type=recovery`, RecoveryGate intercepts and
    //    shows the password-set form. Non-fatal — the member account
    //    still exists if this fails; admin can re-send via
    //    AccountAccessPanel afterwards.
    let setupEmailSent = false
    if (formData.send_setup_email) {
      try {
        const redirectTo =
          typeof window !== 'undefined'
            ? window.location.origin + import.meta.env.BASE_URL
            : undefined
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
          email,
          redirectTo ? { redirectTo } : undefined,
        )
        if (resetErr) {
          console.error('[TeamManager] resetPasswordForEmail failed:', resetErr)
        } else {
          setupEmailSent = true
        }
      } catch (resetErr) {
        console.error('[TeamManager] resetPasswordForEmail threw:', resetErr)
      }
    }

    if (formData.send_setup_email) {
      toast(
        setupEmailSent
          ? `Member added — setup email sent to ${email}`
          : `Member added — couldn't send setup email. Resend from Account Access.`,
        setupEmailSent ? 'success' : 'error',
      )
    } else {
      toast(`Member added — share the temporary password with them`)
    }
    closeForm()
    setSubmitting(false)
    loadMembers()
  }

  const openAddForm = async () => {
    setEditingMember(null)
    setFormData(EMPTY_MEMBER)
    setCustomPosition('')
    setStep(1)
    setSelectedDailyTemplateIds(new Set())
    setSelectedWeeklyTemplateIds(new Set())
    setShowForm(true)
    // Kick off template fetch in parallel; the user usually spends a
    // few seconds on step 1, so we'll have results before they hit Next.
    setTemplatesLoading(true)
    try {
      const [d, w] = await Promise.all([
        loadActiveTemplates('daily'),
        loadActiveTemplates('weekly'),
      ])
      setDailyTemplates(d)
      setWeeklyTemplates(w)
    } finally {
      setTemplatesLoading(false)
    }
  }

  // When the admin picks a position in step 1, pre-check the templates
  // already assigned to that position so the default-for-this-position
  // bundle is just one click away.
  useEffect(() => {
    if (editingMember || !showForm) return
    const position = formData.position === 'custom' ? customPosition : formData.position
    if (!position) return
    let cancelled = false
    ;(async () => {
      const [defaultDaily, defaultWeekly] = await Promise.all([
        loadDefaultTemplateIdsForPosition(position, 'daily'),
        loadDefaultTemplateIdsForPosition(position, 'weekly'),
      ])
      if (cancelled) return
      setSelectedDailyTemplateIds(new Set(defaultDaily))
      setSelectedWeeklyTemplateIds(new Set(defaultWeekly))
    })()
    return () => { cancelled = true }
  }, [formData.position, customPosition, editingMember, showForm])

  const closeForm = () => {
    setShowForm(false)
    setEditingMember(null)
    setFormData(EMPTY_MEMBER)
    setCustomPosition('')
    setStep(1)
    setSelectedDailyTemplateIds(new Set())
    setSelectedWeeklyTemplateIds(new Set())
  }

  const handleEdit = (member: TeamMember) => {
    const knownPosition = POSITIONS.find(p => p.value === member.position)
    setEditingMember(member)
    setFormData({
      display_name: member.display_name,
      email: member.email,
      role: member.role as 'admin' | 'intern',
      position: knownPosition ? (member.position ?? 'intern') : 'custom',
      phone: member.phone ?? '',
      start_date: member.start_date ?? '',
      status: (member.status ?? 'active') as 'active' | 'inactive',
      managed_by: member.managed_by ?? '',
      // default_password + send_setup_email are only meaningful for
      // new-member creation; not editable here.
      default_password: '',
      send_setup_email: true,
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
    const { error } = await supabase.from('team_members').delete().eq('id', confirmState.memberId)
    if (error) toast('Failed to remove member', 'error')
    else toast('Member removed')
    setConfirmState({ open: false, memberId: '', memberName: '', loading: false })
    loadMembers()
  }

  const toggleStatus = async (member: TeamMember) => {
    setOpenMenuId(null)
    setActionLoadingId(member.id)
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('team_members').update({ status: newStatus }).eq('id', member.id)
    if (error) toast('Failed to update status', 'error')
    else toast(`Member ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    setActionLoadingId(null)
    loadMembers()
  }

  const toggleRole = async (member: TeamMember) => {
    setOpenMenuId(null)
    setActionLoadingId(member.id)
    const newRole = member.role === 'admin' ? 'intern' : 'admin'
    const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', member.id)
    if (error) toast('Failed to update role', 'error')
    else toast(`Role updated to ${newRole}`)
    setActionLoadingId(null)
    loadMembers()
  }

  /**
   * PR #49 — re-send the password-setup email to an existing member.
   * Same `auth.resetPasswordForEmail()` call AccountAccessPanel uses;
   * Supabase delivers a single-use recovery link, the member clicks
   * it, lands on `RecoveryGate`, picks their own password.
   *
   * Useful when:
   *   - Admin originally created the member with a manual temp pw and
   *     wants to switch them to the email-setup path instead.
   *   - The original setup email expired (1-hour TTL).
   *   - Member forgot their password and the admin is helping.
   */
  const handleSendSetupEmail = async (member: TeamMember) => {
    setOpenMenuId(null)
    if (!member.email) {
      toast('Member has no email on file', 'error')
      return
    }
    setActionLoadingId(member.id)
    const redirectTo =
      typeof window !== 'undefined'
        ? window.location.origin + import.meta.env.BASE_URL
        : undefined
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      member.email,
      redirectTo ? { redirectTo } : undefined,
    )
    setActionLoadingId(null)
    if (resetErr) {
      console.error('[TeamManager] handleSendSetupEmail failed:', resetErr)
      toast(`Couldn't send setup email: ${resetErr.message}`, 'error')
      return
    }
    toast(`Setup email sent to ${member.email}`)
  }

  const getPositionVariant = (pos: string): BadgeVariant =>
    POSITIONS.find(p => p.value === pos)?.badge ?? 'neutral'

  const getPositionLabel = (pos: string) =>
    POSITIONS.find(p => p.value === pos)?.label ?? pos

  const getManagerName = (managedBy: string | undefined) => {
    if (!managedBy) return null
    return members.find(m => m.id === managedBy)?.display_name ?? null
  }

  // PR #49 — `getReportChain` was used by the old card grid to show a
  // multi-hop reporting chain. The table layout doesn't render the
  // chain (manager column shows direct manager only). If the chain
  // ever becomes useful again, restore from git history.

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
        // PR #49 — table layout (replaces the previous card grid).
        // Mirrors the read-only MyTeam look the user signed off on
        // visually, but every row has a 3-dot action menu (Edit /
        // Send setup email / Toggle role / Toggle status / Delete)
        // so the page is the single canonical Members management
        // surface — Add up top, manage per-row.
        <div className="widget-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <TmHeaderCell>Member</TmHeaderCell>
                  <TmHeaderCell>Job Title</TmHeaderCell>
                  <TmHeaderCell>Department</TmHeaderCell>
                  <TmHeaderCell>Term</TmHeaderCell>
                  <TmHeaderCell>Status</TmHeaderCell>
                  <TmHeaderCell>Access</TmHeaderCell>
                  <TmHeaderCell>Contact</TmHeaderCell>
                  <TmHeaderCell><span className="sr-only">Actions</span></TmHeaderCell>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => {
                  const isInactive = member.status === 'inactive'
                  const isLoading = actionLoadingId === member.id
                  const initial = member.display_name?.charAt(0)?.toUpperCase() ?? '?'
                  return (
                    <tr
                      key={member.id}
                      className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group ${
                        isInactive ? 'opacity-50' : ''
                      } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {/* Member: avatar + name + email → profile link */}
                      <td className="px-5 py-4">
                        <Link
                          to={`/profile/${member.id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <div className="w-10 h-10 rounded-full bg-surface-alt border-[2px] border-white/12 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-text tracking-tight truncate">
                              {member.display_name}
                            </p>
                            <p className="text-[11px] text-text-light truncate">{member.email}</p>
                          </div>
                        </Link>
                      </td>
                      {/* Job Title */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted">
                          {member.position
                            ? getPositionLabel(member.position).toLowerCase().replace(/\s+/g, '_')
                            : '—'}
                        </span>
                      </td>
                      {/* Department (free-text column on team_members) */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted">{member.department || '—'}</span>
                      </td>
                      {/* Term: start – end (or "present") */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-text-muted whitespace-nowrap">
                          {formatTerm(member)}
                        </span>
                      </td>
                      {/* Status dot */}
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isInactive ? 'bg-text-light' : 'bg-emerald-400'
                            }`}
                            aria-hidden="true"
                          />
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      {/* Access pill (Admin / Standard) */}
                      <td className="px-5 py-4">
                        <TmAccessBadge role={member.role} />
                      </td>
                      {/* Contact icons */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {member.email && (
                            <a
                              href={`mailto:${member.email}`}
                              className="text-text-light hover:text-gold transition-colors"
                              title={member.email}
                              aria-label={`Email ${member.display_name}`}
                            >
                              <Mail size={14} />
                            </a>
                          )}
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="text-text-light hover:text-gold transition-colors"
                              title={member.phone}
                              aria-label={`Call ${member.display_name}`}
                            >
                              <Phone size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      {/* Action menu — 3-dot, hover-revealed, popover */}
                      <td className="px-5 py-4 text-right relative">
                        <div className="relative inline-block" ref={openMenuId === member.id ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === member.id ? null : member.id)
                            }
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors opacity-60 group-hover:opacity-100 focus:opacity-100 focus-ring"
                            aria-label={`Actions for ${member.display_name}`}
                            aria-expanded={openMenuId === member.id}
                            aria-haspopup="menu"
                          >
                            <MoreVertical size={14} aria-hidden="true" />
                          </button>
                          {openMenuId === member.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-52 bg-surface border border-border rounded-xl shadow-xl z-20 py-1 animate-fade-in"
                              role="menu"
                            >
                              <button
                                role="menuitem"
                                onClick={() => handleEdit(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
                              >
                                <Edit2 size={12} aria-hidden="true" /> Edit member
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => handleSendSetupEmail(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
                              >
                                <Mail size={12} aria-hidden="true" /> Send setup email
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => toggleRole(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-surface-hover transition-colors"
                              >
                                <Shield size={12} aria-hidden="true" />{' '}
                                {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              </button>
                              <button
                                role="menuitem"
                                onClick={() => toggleStatus(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors"
                              >
                                <UserCheck size={12} aria-hidden="true" />{' '}
                                {member.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button
                                role="menuitem"
                                onClick={() => requestDelete(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={12} aria-hidden="true" /> Remove member
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
                {editingMember
                  ? 'Edit Team Member'
                  : `Add Team Member · Step ${step} of 3`}
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

            {/* Step indicator (add mode only) */}
            {!editingMember && (
              <div className="px-6 py-3 border-b border-border bg-surface-alt/40">
                <div className="flex items-center gap-2">
                  {[
                    { n: 1, label: 'Profile' },
                    { n: 2, label: 'Templates' },
                    { n: 3, label: 'Review' },
                  ].map((s, i) => (
                    <div key={s.n} className="flex items-center gap-2 flex-1">
                      <div
                        className={`shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                          step >= s.n
                            ? 'bg-gold text-black'
                            : 'bg-surface-alt text-text-light border border-border'
                        }`}
                      >
                        {step > s.n ? <Check size={11} /> : s.n}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          step === s.n ? 'text-text' : 'text-text-muted'
                        }`}
                      >
                        {s.label}
                      </span>
                      {i < 2 && (
                        <div className={`flex-1 h-px ${step > s.n ? 'bg-gold' : 'bg-border'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-6 space-y-5 flex-1">
                {/* ─── Step 1 — Profile ─── */}
                {(editingMember || step === 1) && (
                <>
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

                {/* PR #49 — Send-setup-email toggle replaces the
                    always-visible password input. When on (default),
                    no password is collected: the edge function
                    generates a random one server-side and we email a
                    setup link via Supabase's native recovery flow.
                    When off, the password input returns for offline
                    adds. */}
                {!editingMember && (
                  <div className="space-y-3">
                    <label
                      className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border bg-surface-alt/50 hover:bg-surface-alt cursor-pointer transition-colors"
                      htmlFor="team-member-send-setup-email"
                    >
                      <input
                        id="team-member-send-setup-email"
                        type="checkbox"
                        checked={formData.send_setup_email}
                        onChange={e =>
                          setFormData({ ...formData, send_setup_email: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 rounded border-border accent-gold shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text flex items-center gap-1.5">
                          <Mail size={13} className="text-gold shrink-0" aria-hidden="true" />
                          Email a setup link to the new member
                        </p>
                        <p className="text-[12px] text-text-muted mt-0.5">
                          {formData.send_setup_email ? (
                            <>
                              They'll get a secure link at{' '}
                              <span className="font-medium text-text">
                                {normalizeEmail(formData.email) || 'their email'}
                              </span>{' '}
                              to choose their own password. Recommended.
                            </>
                          ) : (
                            "You'll set a temporary password below to share with them manually."
                          )}
                        </p>
                      </div>
                    </label>

                    {!formData.send_setup_email && (
                      <Input
                        id="team-member-default-password"
                        label="Temporary password"
                        type="text"
                        required
                        minLength={8}
                        placeholder="Min 8 characters"
                        hint="Share this with the member. They'll be prompted to change it on first sign-in."
                        value={formData.default_password}
                        onChange={e =>
                          setFormData({ ...formData, default_password: e.target.value })
                        }
                      />
                    )}
                  </div>
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
                    onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'intern' })}
                  >
                    <option value="intern">Member</option>
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
                </>
                )}

                {/* ─── Step 2 — Templates ─── */}
                {!editingMember && step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-text">
                        <ClipboardList size={14} className="text-gold" aria-hidden="true" />
                        Assign templates
                      </h3>
                      <p className="text-xs text-text-muted mt-1">
                        Pick the daily and weekly checklists this member should run on first
                        sign-in. Defaults for their position are pre-checked.
                      </p>
                    </div>

                    {templatesLoading ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        Loading templates…
                      </div>
                    ) : (
                      <>
                        <TemplatePicker
                          label="Daily templates"
                          templates={dailyTemplates}
                          selectedIds={selectedDailyTemplateIds}
                          onToggle={(id) => {
                            setSelectedDailyTemplateIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return next
                            })
                          }}
                        />
                        <TemplatePicker
                          label="Weekly templates"
                          templates={weeklyTemplates}
                          selectedIds={selectedWeeklyTemplateIds}
                          onToggle={(id) => {
                            setSelectedWeeklyTemplateIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return next
                            })
                          }}
                        />
                      </>
                    )}

                    <p className="text-[11px] text-text-light">
                      You can skip this step and assign templates later from the Templates page.
                    </p>
                  </div>
                )}

                {/* ─── Step 3 — Review ─── */}
                {!editingMember && step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-text">
                        <UserCheck size={14} className="text-gold" aria-hidden="true" />
                        Review &amp; create
                      </h3>
                      <p className="text-xs text-text-muted mt-1">
                        {formData.send_setup_email ? (
                          <>
                            Confirm everything below. After creation, a setup-link email will be sent to{' '}
                            <span className="font-semibold text-text">{normalizeEmail(formData.email)}</span>{' '}
                            so the new member can pick their own password.
                          </>
                        ) : (
                          <>
                            Confirm everything below. The temporary password will need to be shared with
                            the new member directly — they'll be required to change it on first sign-in.
                          </>
                        )}
                      </p>
                    </div>

                    <ReviewSummary
                      label="Profile"
                      rows={[
                        ['Name', formData.display_name],
                        ['Email', normalizeEmail(formData.email)],
                        ['Role', formData.role],
                        ['Position', formData.position === 'custom' ? customPosition : getPositionLabel(formData.position)],
                        ['Manager', getManagerName(formData.managed_by) ?? 'None'],
                        ['Phone', formData.phone || '—'],
                        ['Start date', formData.start_date || '—'],
                        ['Status', formData.status],
                        formData.send_setup_email
                          ? ['Setup', 'Email link to member']
                          : ['Temp password', formData.default_password],
                      ]}
                    />

                    <ReviewSummary
                      label="Templates"
                      rows={[
                        [
                          'Daily',
                          selectedDailyTemplateIds.size === 0
                            ? 'None'
                            : Array.from(selectedDailyTemplateIds)
                                .map((id) => dailyTemplates.find((t) => t.id === id)?.name ?? id)
                                .join(', '),
                        ],
                        [
                          'Weekly',
                          selectedWeeklyTemplateIds.size === 0
                            ? 'None'
                            : Array.from(selectedWeeklyTemplateIds)
                                .map((id) => weeklyTemplates.find((t) => t.id === id)?.name ?? id)
                                .join(', '),
                        ],
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-surface">
                {/* Left: Back / Cancel */}
                <div>
                  {!editingMember && step > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleBack}
                      iconLeft={<ChevronLeft size={14} aria-hidden="true" />}
                    >
                      Back
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={closeForm}>
                      Cancel
                    </Button>
                  )}
                </div>
                {/* Right: Next / Create / Update */}
                <div className="flex items-center gap-2">
                  {!editingMember && step < 3 ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleNext}
                      iconLeft={<ChevronRight size={14} aria-hidden="true" />}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      loading={submitting}
                      iconLeft={!submitting ? <Save size={16} aria-hidden="true" /> : undefined}
                    >
                      {editingMember ? 'Update Member' : 'Create Account'}
                    </Button>
                  )}
                </div>
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

// ─── Step 2 helper: template multi-select list ───────────────────────

function TemplatePicker({
  label,
  templates,
  selectedIds,
  onToggle,
}: {
  label: string
  templates: ReportTemplate[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
        {label}
      </p>
      {templates.length === 0 ? (
        <p className="text-xs text-text-light italic">
          No {label.toLowerCase()} available. Create one from the Templates page first.
        </p>
      ) : (
        <ul className="space-y-1.5 rounded-lg border border-border divide-y divide-border/60">
          {templates.map((t) => {
            const checked = selectedIds.has(t.id)
            return (
              <li key={t.id}>
                <label
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-alt/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(t.id)}
                    className="w-4 h-4 rounded border-border accent-gold focus-ring"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{t.name}</p>
                    <p className="text-[11px] text-text-light truncate">
                      {t.fields?.length ?? 0} item{(t.fields?.length ?? 0) === 1 ? '' : 's'}
                      {t.position ? ` · default for ${t.position}` : ''}
                    </p>
                  </div>
                  {t.is_default && (
                    <Badge variant="gold" size="sm">
                      Default
                    </Badge>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Step 3 helper: read-only summary block ──────────────────────────

function ReviewSummary({
  label,
  rows,
}: {
  label: string
  rows: Array<[string, string]>
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt/40 overflow-hidden">
      <p className="px-4 py-2 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wide">
        {label}
      </p>
      <dl className="divide-y divide-border/60">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2">
            <dt className="text-xs text-text-muted">{k}</dt>
            <dd className="text-xs text-text break-words">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// PR #49 — table helpers ported from MyTeam.tsx so this file is the
// canonical Members admin surface. `Tm` prefix avoids any future
// collision with similarly-named atoms in other files.

function TmHeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-left text-label">{children}</th>
}

function TmAccessBadge({ role }: { role?: string }) {
  const isAdmin = role === 'admin' || role === 'owner'
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded">
        <Shield size={10} aria-hidden="true" />
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold text-text-muted bg-surface-alt border border-border px-2 py-0.5 rounded">
      Standard
    </span>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Term cell — "Jan 15, 2024 – present" when end_date is absent,
 * otherwise "Jan 15, 2024 – Jun 30, 2024". Em-dash if no start_date.
 */
function formatTerm(m: TeamMember): string {
  const start = m.start_date ? formatDate(m.start_date) : null
  if (!start || start === '—') return '—'
  const end = m.end_date ? formatDate(m.end_date) : 'present'
  return `${start} – ${end}`
}
