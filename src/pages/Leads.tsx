import { useEffect, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { Lead } from '../types'
import {
  Plus, X, Search, Filter, Loader2, Phone, Mail, Building2, DollarSign, AlertCircle,
} from 'lucide-react'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'] as const
const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-sky-500/10 text-sky-400',
  contacted: 'bg-amber-500/10 text-amber-400',
  qualified: 'bg-violet-500/10 text-violet-400',
  proposal: 'bg-indigo-500/10 text-indigo-400',
  closed_won: 'bg-emerald-500/10 text-emerald-400',
  closed_lost: 'bg-red-500/10 text-red-400',
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
  useDocumentTitle('Leads - Checkmark Audio')
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
      let query = supabase.from('intern_leads').select('*').order('created_at', { ascending: false })
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

    const payload = { ...formData, intern_id: profile.id }

    if (editingLead) {
      const { error } = await supabase.from('intern_leads').update(payload).eq('id', editingLead.id)
      if (error) { toast('Failed to update lead', 'error'); setSubmitting(false); return }
    } else {
      const { error } = await supabase.from('intern_leads').insert(payload)
      if (error) { toast('Failed to add lead', 'error'); setSubmitting(false); return }
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
    const { error } = await supabase.from('intern_leads').delete().eq('id', id)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-text-muted mt-1">Manage your sales pipeline and contacts</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingLead(null); setFormData(EMPTY_LEAD) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm transition-all"
        >
          {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {showForm ? 'Cancel' : 'New Lead'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">{editingLead ? 'Edit Lead' : 'New Lead'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lead-contact" className="block text-sm font-medium mb-1.5">Contact Name *</label>
              <input id="lead-contact" required value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm" placeholder="John Doe" />
            </div>
            <div>
              <label htmlFor="lead-company" className="block text-sm font-medium mb-1.5">Company</label>
              <input id="lead-company" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm" placeholder="Acme Inc." />
            </div>
            <div>
              <label htmlFor="lead-email" className="block text-sm font-medium mb-1.5">Email</label>
              <input id="lead-email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm" placeholder="john@example.com" />
            </div>
            <div>
              <label htmlFor="lead-phone" className="block text-sm font-medium mb-1.5">Phone</label>
              <input id="lead-phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm" placeholder="(555) 123-4567" />
            </div>
            <div>
              <label htmlFor="lead-priority" className="block text-sm font-medium mb-1.5">Priority</label>
              <select id="lead-priority" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as Lead['priority'] })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lead-status" className="block text-sm font-medium mb-1.5">Status</label>
              <select id="lead-status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lead-amount" className="block text-sm font-medium mb-1.5">Deal Amount</label>
              <input id="lead-amount" type="number" value={formData.amount ?? ''} onChange={e => setFormData({ ...formData, amount: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm" placeholder="0" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={formData.needs_follow_up} onChange={e => setFormData({ ...formData, needs_follow_up: e.target.checked })}
                  className="rounded border-border" />
                Needs follow-up
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="lead-description" className="block text-sm font-medium mb-1.5">Description</label>
            <textarea id="lead-description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3} className="w-full px-3 py-2.5 rounded-xl border border-border text-sm resize-none" placeholder="Notes about this lead..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingLead(null) }}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm transition-all disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {editingLead ? 'Update Lead' : 'Add Lead'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
            aria-label="Search leads"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="appearance-none pl-8 pr-8 py-2.5 rounded-lg border border-border text-sm">
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
          No leads found.
        </div>
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
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[lead.status] ?? 'bg-surface-alt text-text-muted'}`}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.amount ? <span className="flex items-center gap-0.5 text-text-muted"><DollarSign size={13} aria-hidden="true" />{lead.amount.toLocaleString()}</span> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        lead.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                        lead.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-surface-alt text-text-muted'
                      }`}>{lead.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(lead)} className="px-2 py-1 rounded text-xs hover:bg-gold/10 text-gold">Edit</button>
                        <button onClick={() => handleDelete(lead.id)} className="px-2 py-1 rounded text-xs hover:bg-red-500/10 text-red-400">Delete</button>
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
