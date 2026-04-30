import { useCallback, useEffect, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/email'
import { useToast } from '../components/Toast'
import {
  Button, Input, Textarea, Select, Badge, EmptyState, PageHeader,
  type BadgeVariant,
} from '../components/ui'
import type { Lead } from '../types'
import {
  Plus, X, Search, Phone, Mail, Building2, DollarSign, AlertCircle, Target, Save,
} from 'lucide-react'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'] as const
const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: 'info',
  contacted: 'warning',
  qualified: 'stage-share',
  proposal: 'stage-capture',
  closed_won: 'success',
  closed_lost: 'danger',
}

const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

type LeadForm = {
  contact: string; company: string; email: string; phone: string; description: string
  priority: Lead['priority']; status: Lead['status']; amount: number | undefined
  needs_follow_up: boolean
}

const EMPTY_LEAD: LeadForm = {
  contact: '', company: '', email: '', phone: '', description: '',
  priority: 'medium', status: 'new', amount: undefined,
  needs_follow_up: false,
}

export default function Leads() {
  useDocumentTitle('Leads - Checkmark Workspace')
  const { profile, isAdmin } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<LeadForm>(EMPTY_LEAD)
  const { toast } = useToast()

  const loadLeads = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    try {
      let query = supabase.from('team_leads').select('*').order('created_at', { ascending: false })
      if (!isAdmin) query = query.eq('intern_id', profile.id)
      const { data } = await query
      if (data) setLeads(data as Lead[])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [profile, isAdmin])

  useEffect(() => { loadLeads() }, [loadLeads])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    const payload = {
      ...formData,
      email: normalizeEmail(formData.email),
      intern_id: profile.id,
    }

    if (editingLead) {
      const { error } = await supabase.from('team_leads').update(payload).eq('id', editingLead.id)
      if (error) {
        console.error('[Leads] Update failed:', error)
        toast(error.message || 'Failed to update lead', 'error')
        setSubmitting(false)
        return
      }
    } else {
      const { error } = await supabase.from('team_leads').insert(payload)
      if (error) {
        console.error('[Leads] Insert failed:', error)
        toast(error.message || 'Failed to add lead', 'error')
        setSubmitting(false)
        return
      }
    }

    setShowForm(false)
    setEditingLead(null)
    setFormData(EMPTY_LEAD)
    setSubmitting(false)
    loadLeads()
  }

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      contact: lead.contact,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      description: lead.description,
      priority: lead.priority,
      status: lead.status,
      amount: lead.amount,
      needs_follow_up: lead.needs_follow_up,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    const { error } = await supabase.from('team_leads').delete().eq('id', id)
    if (error) toast('Failed to delete lead', 'error')
    loadLeads()
  }

  const filtered = leads
    .filter(l => statusFilter === 'all' || l.status === statusFilter)
    .filter(l => {
      if (!search) return true
      const s = search.toLowerCase()
      return l.contact.toLowerCase().includes(s) || l.company.toLowerCase().includes(s) || l.email.toLowerCase().includes(s)
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={Target}
        title="Leads"
        actions={
          <Button
            variant="primary"
            onClick={() => { setShowForm(!showForm); setEditingLead(null); setFormData(EMPTY_LEAD) }}
            iconLeft={showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          >
            {showForm ? 'Cancel' : 'New Lead'}
          </Button>
        }
      />

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">{editingLead ? 'Edit Lead' : 'New Lead'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              id="lead-contact"
              label="Contact Name"
              required
              placeholder="John Doe"
              value={formData.contact}
              onChange={e => setFormData({ ...formData, contact: e.target.value })}
            />
            <Input
              id="lead-company"
              label="Company"
              placeholder="Acme Inc."
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
            />
            <Input
              id="lead-email"
              label="Email"
              type="email"
              placeholder="john@example.com"
              hint="Will be normalized to lowercase on save."
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              id="lead-phone"
              label="Phone"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
            <Select
              id="lead-priority"
              label="Priority"
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value as Lead['priority'] })}
            >
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </Select>
            <Select
              id="lead-status"
              label="Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Input
              id="lead-amount"
              label="Deal Amount"
              type="number"
              placeholder="0"
              value={formData.amount ?? ''}
              onChange={e => setFormData({ ...formData, amount: e.target.value ? Number(e.target.value) : undefined })}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.needs_follow_up}
                  onChange={e => setFormData({ ...formData, needs_follow_up: e.target.checked })}
                  className="rounded border-border"
                />
                Needs follow-up
              </label>
            </div>
          </div>
          <Textarea
            id="lead-description"
            label="Description"
            rows={3}
            placeholder="Notes about this lead..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowForm(false); setEditingLead(null) }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              iconLeft={!submitting ? <Save size={16} aria-hidden="true" /> : undefined}
            >
              {editingLead ? 'Update Lead' : 'Add Lead'}
            </Button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          aria-label="Search leads"
          placeholder="Search leads..."
          iconLeft={<Search size={16} aria-hidden="true" />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          wrapperClassName="flex-1"
        />
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          wrapperClassName="sm:w-56"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={leads.length === 0 ? 'No leads yet' : 'No matches'}
          description={
            leads.length === 0
              ? 'Add your first lead to start tracking prospects.'
              : 'No leads match the current search or filter.'
          }
          action={
            leads.length === 0 ? (
              <Button
                variant="primary"
                onClick={() => { setShowForm(true); setEditingLead(null); setFormData(EMPTY_LEAD) }}
                iconLeft={<Plus size={16} aria-hidden="true" />}
              >
                Add First Lead
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt text-left">
                  <th className="px-4 py-3 font-medium text-text-muted">Contact</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden sm:table-cell">Company</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden md:table-cell">Contact Info</th>
                  <th className="px-4 py-3 font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-text-muted hidden lg:table-cell">Amount</th>
                  <th className="px-4 py-3 font-medium text-text-muted">Priority</th>
                  <th className="px-4 py-3 font-medium text-text-muted w-20"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.contact}</span>
                        {lead.needs_follow_up && (
                          <>
                            <AlertCircle size={14} className="text-amber-500" aria-hidden="true" />
                            <span className="sr-only">Needs follow-up</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-text-muted">
                      <div className="flex items-center gap-1"><Building2 size={13} aria-hidden="true" /> {lead.company || '—'}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-3 text-text-muted text-xs">
                        {lead.email && <span className="flex items-center gap-1"><Mail size={12} aria-hidden="true" />{lead.email}</span>}
                        {lead.phone && <span className="flex items-center gap-1"><Phone size={12} aria-hidden="true" />{lead.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_VARIANTS[lead.status] ?? 'neutral'}
                        className="capitalize"
                      >
                        {lead.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.amount ? (
                        <span className="flex items-center gap-0.5 text-text-muted">
                          <DollarSign size={13} aria-hidden="true" />
                          {lead.amount.toLocaleString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANTS[lead.priority] ?? 'neutral'} className="capitalize">
                        {lead.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(lead)}
                          className="text-gold hover:text-gold hover:bg-gold/10"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lead.id)}
                          className="text-red-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
