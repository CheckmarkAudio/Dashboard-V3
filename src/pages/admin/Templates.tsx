import { useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import TemplateAssignModal from '../../components/templates/TemplateAssignModal'
import FloatingDetailModal from '../../components/FloatingDetailModal'
import type { ReportTemplate, TemplateField, TeamMember, TaskAssignment } from '../../types'
import {
  ClipboardList, Plus, X, Save, Loader2, Edit2, Trash2, Copy, GripVertical,
  FileText, CheckSquare, BarChart3, AlertTriangle, UserPlus, Search,
} from 'lucide-react'

const TEMPLATE_TYPES = [
  { value: 'daily', label: 'Daily Report', icon: FileText, color: 'bg-sky-500/10 text-sky-400' },
  { value: 'weekly', label: 'Weekly Report', icon: BarChart3, color: 'bg-violet-500/10 text-violet-400' },
  { value: 'checklist', label: 'Checklist', icon: CheckSquare, color: 'bg-emerald-500/10 text-emerald-400' },
  { value: 'must_do', label: 'Must-Do', icon: AlertTriangle, color: 'bg-red-500/10 text-red-400' },
]

const FIELD_TYPES = [
  { value: 'textarea', label: 'Long Text' },
  { value: 'text', label: 'Short Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'select', label: 'Dropdown' },
]

const POSITIONS_LIST = [
  { value: 'owner', label: 'Owner / Lead Engineer' },
  { value: 'marketing_admin', label: 'Marketing / Admin' },
  { value: 'artist_development', label: 'Artist Development' },
  { value: 'intern', label: 'Intern' },
  { value: 'engineer', label: 'Audio Engineer' },
  { value: 'producer', label: 'Producer' },
]

const PRESET_TEMPLATES: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Intern Daily Checklist',
    type: 'checklist',
    position: 'intern',
    is_default: true,
    fields: [
      { id: '1', label: 'Submit 1 social media piece to Dropbox', type: 'checkbox', is_critical: true },
      { id: '2', label: 'Check and respond to messages', type: 'checkbox' },
      { id: '3', label: 'Attend standup / check-in', type: 'checkbox' },
      { id: '4', label: 'Complete learning module', type: 'checkbox' },
      { id: '5', label: 'Update task notes', type: 'checkbox' },
    ],
  },
  {
    name: 'Marketing / Admin Daily Checklist',
    type: 'checklist',
    position: 'marketing_admin',
    is_default: true,
    fields: [
      { id: '1', label: 'Submit content to Dropbox', type: 'checkbox', is_critical: true },
      { id: '2', label: 'Update and communicate team schedule', type: 'checkbox', is_critical: true },
      { id: '3', label: 'Review analytics / metrics', type: 'checkbox' },
      { id: '4', label: 'Manage content calendar', type: 'checkbox' },
      { id: '5', label: 'Process communications and emails', type: 'checkbox' },
    ],
  },
  {
    name: 'Artist Development Daily Checklist',
    type: 'checklist',
    position: 'artist_development',
    is_default: true,
    fields: [
      { id: '1', label: 'Complete client/artist follow-ups', type: 'checkbox', is_critical: true },
      { id: '2', label: 'Log all external communications with next steps', type: 'checkbox', is_critical: true },
      { id: '3', label: 'Update artist pipeline', type: 'checkbox' },
      { id: '4', label: 'Coordinate release timelines', type: 'checkbox' },
      { id: '5', label: 'Review new submissions', type: 'checkbox' },
    ],
  },
  {
    name: 'Owner Daily Checklist',
    type: 'checklist',
    position: 'owner',
    is_default: true,
    fields: [
      { id: '1', label: 'Review team progress and submissions', type: 'checkbox', is_critical: true },
      { id: '2', label: 'Check business health metrics', type: 'checkbox' },
      { id: '3', label: 'Approve submitted work', type: 'checkbox' },
      { id: '4', label: 'Handle escalations', type: 'checkbox' },
      { id: '5', label: 'Update priorities for the team', type: 'checkbox' },
    ],
  },
  {
    name: 'Daily Must-Do\'s',
    type: 'must_do',
    position: null,
    is_default: true,
    fields: [
      { id: '1', label: 'Submit 1 content piece to Dropbox', type: 'checkbox', is_critical: true },
      { id: '2', label: 'Log all client/external communications', type: 'checkbox', is_critical: true },
      { id: '3', label: 'Update daily notes', type: 'checkbox', is_critical: true },
    ],
  },
  {
    name: 'Weekly Summary',
    type: 'weekly',
    position: null,
    is_default: false,
    fields: [
      { id: '1', label: 'Key accomplishments this week', type: 'textarea', required: true },
      { id: '2', label: 'Challenges faced', type: 'textarea', required: false },
      { id: '3', label: 'Plans for next week', type: 'textarea', required: true },
      { id: '4', label: 'Total hours worked', type: 'number', required: true },
    ],
  },
  {
    name: 'Marketing Weekly Report',
    type: 'weekly',
    position: 'marketing_admin',
    is_default: false,
    fields: [
      { id: '1', label: 'Content pieces published', type: 'number', required: true },
      { id: '2', label: 'Social media growth this week', type: 'textarea', required: true },
      { id: '3', label: 'Campaign performance summary', type: 'textarea', required: false },
      { id: '4', label: 'Next week\'s content strategy', type: 'textarea', required: true },
    ],
  },
  {
    name: 'Daily Standup Report',
    type: 'daily',
    position: null,
    is_default: false,
    fields: [
      { id: '1', label: 'What did you accomplish today?', type: 'textarea', required: true },
      { id: '2', label: 'Any blockers or challenges?', type: 'textarea', required: false },
      { id: '3', label: 'What will you work on tomorrow?', type: 'textarea', required: true },
    ],
  },
]

export default function Templates() {
  useDocumentTitle('Templates - Checkmark Workspace')
  useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const typeFilter = 'all' // type filter tabs removed; search filter covers it

  const [name, setName] = useState('')
  const [type, setType] = useState<ReportTemplate['type']>('daily')
  const [position, setPosition] = useState<string>('')
  const [isDefault, setIsDefault] = useState(false)
  const [fields, setFields] = useState<TemplateField[]>([])

  const [assignModalTemplate, setAssignModalTemplate] = useState<ReportTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<ReportTemplate | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<TaskAssignment[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { loadTemplates() }, [])

  const loadTemplates = async () => {
    const [{ data: tData }, { data: mData }, { data: aData }] = await Promise.all([
      supabase.from('report_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').order('display_name'),
      supabase.from('task_assignments').select('*'),
    ])
    if (tData) setTemplates(tData as ReportTemplate[])
    if (mData) setTeamMembers(mData as TeamMember[])
    if (aData) setAssignments(aData as TaskAssignment[])
    setLoading(false)
  }

  const resetForm = () => {
    setName(''); setType('daily'); setPosition(''); setIsDefault(false)
    setFields([]); setEditingTemplate(null)
  }

  const openForm = () => { resetForm(); setShowForm(true); setShowPresets(false) }

  const handleEdit = (t: ReportTemplate) => {
    setEditingTemplate(t)
    setName(t.name)
    setType(t.type)
    setPosition(t.position ?? '')
    setIsDefault(t.is_default)
    setFields(t.fields)
    setShowForm(true)
    setShowPresets(false)
  }

  const handleDuplicate = (t: ReportTemplate) => {
    setEditingTemplate(null)
    setName(`${t.name} (Copy)`)
    setType(t.type)
    setPosition(t.position ?? '')
    setIsDefault(false)
    setFields(t.fields.map(f => ({ ...f, id: crypto.randomUUID() })))
    setShowForm(true)
    setShowPresets(false)
  }

  const usePreset = (preset: typeof PRESET_TEMPLATES[number]) => {
    resetForm()
    setName(preset.name)
    setType(preset.type as ReportTemplate['type'])
    setPosition(preset.position ?? '')
    setFields(preset.fields.map(f => ({ ...f, id: crypto.randomUUID() })))
    setShowPresets(false)
    setShowForm(true)
  }

  const addField = () => {
    setFields([...fields, {
      id: crypto.randomUUID(),
      label: '',
      type: (type === 'checklist' || type === 'must_do') ? 'checkbox' : 'textarea',
      required: false,
    }])
  }

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f))
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      name,
      type,
      position: position || null,
      is_default: isDefault,
      fields,
      updated_at: new Date().toISOString(),
    }

    if (editingTemplate) {
      const { error } = await supabase.from('report_templates').update(payload).eq('id', editingTemplate.id)
      if (error) {
        toast('Failed to update template', 'error')
        setSubmitting(false)
        return
      }
    } else {
      const { error } = await supabase.from('report_templates').insert({ ...payload, created_at: new Date().toISOString() })
      if (error) {
        toast('Failed to create template', 'error')
        setSubmitting(false)
        return
      }
    }

    setShowForm(false)
    resetForm()
    setSubmitting(false)
    loadTemplates()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    const { error } = await supabase.from('report_templates').delete().eq('id', id)
    if (error) {
      toast('Failed to delete template', 'error')
      return
    }
    loadTemplates()
  }

  const getTypeInfo = (t: string) => TEMPLATE_TYPES.find(tt => tt.value === t) ?? TEMPLATE_TYPES[0]!

  // getAssignmentCount removed — assignee count is derived by getAssignee() now.

  // Search filter — matches on name, position, OR any field label so an
  // admin can find "intern" / "daily" / "follow-up" from one box.
  const filtered = useMemo(() => {
    const base = typeFilter === 'all' ? templates : templates.filter(t => t.type === typeFilter)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return base
    return base.filter(t => {
      if (t.name.toLowerCase().includes(q)) return true
      if (t.position?.toLowerCase().includes(q)) return true
      if (t.fields.some(f => f.label.toLowerCase().includes(q))) return true
      return false
    })
  }, [templates, typeFilter, searchQuery])

  // Stats for the hero header strip — total, assigned, and unassigned
  // template counts, matching the Workspace-UI-Draft mockup.
  const stats = useMemo(() => {
    const active = templates.length
    const assignedIds = new Set(
      assignments.filter(a => a.is_active).map(a => a.template_id),
    )
    const assigned = templates.filter(t => assignedIds.has(t.id)).length
    const unassigned = active - assigned
    return { active, assigned, unassigned }
  }, [templates, assignments])

  const memberById = useMemo(() => {
    const map = new Map<string, TeamMember>()
    teamMembers.forEach(m => map.set(m.id, m))
    return map
  }, [teamMembers])

  // Friendly assignee label: pick the first active assignment; otherwise
  // "Unassigned" in rose. Matches the mockup's green/rose assign pill.
  const getAssignee = (templateId: string): { label: string; unassigned: boolean } => {
    const active = assignments.filter(a => a.template_id === templateId && a.is_active)
    if (active.length === 0) return { label: 'Unassigned', unassigned: true }
    const first = active[0]!
    if (first.intern_id) {
      const member = memberById.get(first.intern_id)
      if (member) {
        const firstName = member.display_name.split(' ')[0] ?? member.display_name
        if (active.length === 1) return { label: firstName, unassigned: false }
        return { label: `${firstName} +${active.length - 1}`, unassigned: false }
      }
    }
    if (first.position) {
      return { label: first.position.replace(/_/g, ' '), unassigned: false }
    }
    return { label: 'Team', unassigned: false }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ─── Hero header (matches Workspace-UI-Draft assign.html) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-[56px] md:text-[64px] font-bold tracking-[-0.05em] leading-none text-text">Assign</h1>
          <p className="mt-2 text-[13px] text-text-muted">Templates</p>
        </div>

        <div className="justify-self-center px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center gap-5">
          <StatBox label="Active" value={stats.active} />
          <StatBox label="Assigned" value={stats.assigned} />
          <StatBox label="Unassigned" value={stats.unassigned} highlight={stats.unassigned > 0} />
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <button
            onClick={() => { setShowPresets(!showPresets); setShowForm(false) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/[0.025] text-[13px] font-bold text-text hover:bg-white/[0.05] transition-colors"
          >
            <ClipboardList size={15} aria-hidden="true" /> Presets
          </button>
          <button
            onClick={showForm ? () => { setShowForm(false); resetForm() } : openForm}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-b from-gold to-gold-muted text-black text-[13px] font-extrabold shadow-[0_14px_28px_rgba(214,170,55,0.22)] hover:brightness-105 transition-all"
          >
            {showForm ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            {showForm ? 'Cancel' : 'New Template'}
          </button>
        </div>
      </div>

      {/* ─── Filter search ─── */}
      <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.025]">
        <Search size={16} className="text-text-light shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter templates by role, task, or keyword"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-text placeholder:text-text-light"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-text-light hover:text-gold transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showPresets && (
        <FloatingDetailModal
          onClose={() => setShowPresets(false)}
          title="Preset Templates"
          eyebrow="Quick Start"
          maxWidth={720}
        >
          <p className="text-[13px] text-text-muted mb-4">Pick a preset to start with, then customize it to your needs.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PRESET_TEMPLATES.map((preset, i) => {
              const info = getTypeInfo(preset.type)
              return (
                <button
                  key={i}
                  onClick={() => usePreset(preset)}
                  className="text-left p-4 rounded-xl border border-white/10 bg-white/[0.025] hover:border-gold/30 hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-1 rounded ${info.color}`}><info.icon size={14} aria-hidden="true" /></span>
                    <span className="text-[11px] font-semibold text-text-muted capitalize uppercase tracking-wider">{preset.type.replace('_', '-')}</span>
                    {preset.position && (
                      <span className="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded capitalize">{preset.position}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-[14px] text-text">{preset.name}</h3>
                  <p className="text-[12px] text-text-muted mt-1">{preset.fields.length} fields</p>
                </button>
              )
            })}
          </div>
        </FloatingDetailModal>
      )}

      {showForm && (
        <FloatingDetailModal
          onClose={() => { setShowForm(false); resetForm() }}
          title={editingTemplate ? editingTemplate.name : 'Create Template'}
          eyebrow={editingTemplate ? 'Edit Template' : 'New'}
          maxWidth={720}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-light hover:text-text">
                Cancel
              </button>
              <button type="submit" form="template-edit-form" disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-b from-gold to-gold-muted text-black font-extrabold text-[13px] disabled:opacity-50 hover:brightness-105 transition-all">
                {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          }
        >
        <form id="template-edit-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium mb-1.5">Template Name *</label>
              <input id="template-name" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                placeholder="e.g. Daily Marketing Report" />
            </div>
            <div>
              <label htmlFor="template-type" className="block text-sm font-medium mb-1.5">Type</label>
              <select id="template-type" value={type} onChange={e => setType(e.target.value as ReportTemplate['type'])}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="template-position" className="block text-sm font-medium mb-1.5">Assigned Position</label>
              <select id="template-position" value={position} onChange={e => setPosition(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                <option value="">All Positions</option>
                {POSITIONS_LIST.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label htmlFor="template-is-default" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input id="template-is-default" type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded border-border" />
                Set as default for this position
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">Fields ({fields.length})</label>
              <button type="button" onClick={addField}
                className="flex items-center gap-1 text-xs text-gold font-medium">
                <Plus size={14} aria-hidden="true" /> Add Field
              </button>
            </div>
            <div className="space-y-2">
              {fields.length === 0 && (
                <p className="text-sm text-text-muted p-4 text-center border border-dashed border-border rounded-lg">
                  No fields yet. Click "Add Field" to start building your template.
                </p>
              )}
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-surface-alt">
                  <GripVertical size={16} className="text-text-light mt-2 shrink-0 cursor-grab" aria-label="Reorder" />
                  <div className="flex-1 grid sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label htmlFor={`field-label-${field.id}`} className="sr-only">Field label</label>
                      <input
                        id={`field-label-${field.id}`}
                        value={field.label}
                        onChange={e => updateField(i, { label: e.target.value })}
                        placeholder="Field label"
                        className="w-full px-2.5 py-1.5 rounded border border-border text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`field-type-${field.id}`} className="sr-only">Field type</label>
                      <select
                        id={`field-type-${field.id}`}
                        value={field.type}
                        onChange={e => updateField(i, { type: e.target.value as TemplateField['type'] })}
                        className="w-full px-2.5 py-1.5 rounded border border-border text-sm"
                      >
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {field.type !== 'checkbox' && (
                    <label htmlFor={`field-required-${field.id}`} className="flex items-center gap-1 text-xs text-text-muted mt-2 shrink-0">
                      <input id={`field-required-${field.id}`} type="checkbox" checked={field.required ?? false}
                        onChange={e => updateField(i, { required: e.target.checked })}
                        className="rounded border-border" />
                      Required
                    </label>
                  )}
                  {(type === 'checklist' || type === 'must_do') && field.type === 'checkbox' && (
                    <label htmlFor={`field-critical-${field.id}`} className="flex items-center gap-1 text-xs text-red-400 mt-2 shrink-0">
                      <input id={`field-critical-${field.id}`} type="checkbox" checked={field.is_critical ?? false}
                        onChange={e => updateField(i, { is_critical: e.target.checked })}
                        className="rounded border-border" />
                      Critical
                    </label>
                  )}
                  <button type="button" onClick={() => removeField(i)} aria-label="Remove field"
                    className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 mt-1 shrink-0">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
        </FloatingDetailModal>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-text-light opacity-60" aria-hidden="true" />
          <p className="text-text-muted text-sm">
            {searchQuery
              ? `No templates match "${searchQuery}".`
              : 'No templates yet. Tap Presets or New Template to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {filtered.map(template => {
            const assignee = getAssignee(template.id)
            const taskCount = template.fields.length
            return (
              <TemplateCard
                key={template.id}
                template={template}
                taskCount={taskCount}
                assignee={assignee}
                onTitleClick={() => setPreviewTemplate(template)}
                onEdit={() => handleEdit(template)}
              />
            )
          })}
        </div>
      )}

      {/* ─── Preview modal (click template title) ─── */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          assignee={getAssignee(previewTemplate.id)}
          onClose={() => setPreviewTemplate(null)}
          onEdit={() => { handleEdit(previewTemplate); setPreviewTemplate(null) }}
          onAssign={() => { setAssignModalTemplate(previewTemplate); setPreviewTemplate(null) }}
          onDuplicate={() => { handleDuplicate(previewTemplate); setPreviewTemplate(null) }}
          onDelete={() => { handleDelete(previewTemplate.id); setPreviewTemplate(null) }}
        />
      )}

      <TemplateAssignModal
        template={assignModalTemplate}
        teamMembers={teamMembers}
        assignments={assignments}
        onClose={() => setAssignModalTemplate(null)}
        onChanged={loadTemplates}
      />
    </div>
  )
}

// ─── StatBox ─────────────────────────────────────────────────────────
// One of three figures in the hero header strip (Active/Assigned/Unassigned).
function StatBox({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="text-center min-w-[64px]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-text-light font-semibold">{label}</p>
      <p className={`mt-1 text-[22px] leading-none font-bold tabular-nums ${highlight ? 'text-gold' : 'text-text'}`}>{value}</p>
    </div>
  )
}

// ─── TemplateCard ────────────────────────────────────────────────────
// One bubble in the template grid. Clicking the title opens the full
// preview modal. Edit button (top-right) short-circuits to the inline
// edit form. Matches the Workspace-UI-Draft mockup's card shape.
function TemplateCard({
  template,
  taskCount,
  assignee,
  onTitleClick,
  onEdit,
}: {
  template: ReportTemplate
  taskCount: number
  assignee: { label: string; unassigned: boolean }
  onTitleClick: () => void
  onEdit: () => void
}) {
  const isUnassigned = assignee.unassigned
  // Cap at 4 task previews so the card stays square-ish and text
  // stays legible. A "···" indicator renders at the bottom-right when
  // the template has more than 4 tasks — matches the mockup.
  const visibleFields = template.fields.slice(0, 4)
  const overflowCount = Math.max(0, template.fields.length - visibleFields.length)

  return (
    <article
      className={`relative grid grid-rows-[auto_1fr_auto] h-[290px] rounded-3xl border overflow-hidden transition-all ${
        isUnassigned
          ? 'border-gold/22 bg-gradient-to-b from-[rgba(22,24,31,0.96)] to-[rgba(15,17,22,0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_36px_rgba(0,0,0,0.16)]'
          : 'border-white/8 bg-gradient-to-b from-[rgba(22,24,31,0.96)] to-[rgba(15,17,22,0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
      }`}
    >
      {isUnassigned && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/8 to-transparent"
        />
      )}

      {/* Top — title, task count, edit button. Title wraps to 2 lines
          if it's long ("Artist Development", etc.) so nothing is cut
          off by truncation. Fixed min-h keeps cards uniform across
          one-line and two-line titles. */}
      <div className="relative px-4 pt-3.5 pb-2.5 border-b border-white/5 grid gap-1.5 min-h-[86px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <button
            type="button"
            onClick={onTitleClick}
            className="min-w-0 text-left group focus-ring rounded-lg"
          >
            <h2
              className="text-[17px] font-bold tracking-[-0.02em] text-text group-hover:text-gold transition-colors leading-tight break-words"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {template.name}
            </h2>
          </button>
          <div className="flex items-center gap-2 justify-self-end shrink-0">
            <span className="text-[11px] font-semibold text-text-light whitespace-nowrap">
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </span>
            <button
              type="button"
              onClick={onEdit}
              className="px-2.5 py-1.5 rounded-lg border border-white/8 bg-white/[0.03] text-[11px] font-bold text-text-muted hover:text-gold hover:border-gold/30 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Matches the Workspace-UI-Draft mockup exactly:
            gold "+ Assign" action on the left, then a colored pill
            showing the current assignee (green) OR "Unassigned" (rose).
            No role label — the mockup intentionally omits that. */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gold/85 whitespace-nowrap">
            <Plus size={12} aria-hidden="true" strokeWidth={2.2} />
            Assign
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
              isUnassigned
                ? 'border-rose-400/22 bg-rose-400/10 text-rose-300'
                : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
            }`}
          >
            {assignee.label}
          </span>
        </div>
      </div>

      {/* Task list preview — clips at cell height so tall-content cards
          never push past the fixed 380px card size. */}
      <div className="relative min-h-0 overflow-hidden px-4 py-3 grid gap-2 content-start">
        {visibleFields.map(f => (
          <div key={f.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-start text-[13px] leading-snug text-text">
            <span
              className={`mt-0.5 shrink-0 w-[14px] h-[14px] rounded-[5px] border ${
                f.is_critical
                  ? 'border-rose-400/55 bg-rose-400/8'
                  : 'border-white/16 bg-white/[0.015]'
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">{f.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom — overflow "..." indicator */}
      <div className="px-4 pb-3 flex justify-end">
        {overflowCount > 0 && (
          <span className="text-text-light text-[14px] tracking-[0.18em] leading-none select-none">···</span>
        )}
      </div>
    </article>
  )
}

// ─── TemplatePreviewModal ────────────────────────────────────────────
// Floating center-of-page preview — uses the shared FloatingDetailModal
// so the dismiss behavior (Esc, X, backdrop) matches every other modal
// in the app. Shows the entire template and offers
// Edit / Assign / Duplicate / Delete actions on the footer.
function TemplatePreviewModal({
  template,
  assignee,
  onClose,
  onEdit,
  onAssign,
  onDuplicate,
  onDelete,
}: {
  template: ReportTemplate
  assignee: { label: string; unassigned: boolean }
  onClose: () => void
  onEdit: () => void
  onAssign: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <FloatingDetailModal
      onClose={onClose}
      ariaLabel={`${template.name} preview`}
      maxWidth={560}
      header={
        <>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold/80 font-bold">
            {template.type.replace('_', ' ')}
            {template.position ? ` · ${template.position.replace(/_/g, ' ')}` : ''}
          </p>
          <h2 className="mt-1 text-[24px] font-bold tracking-[-0.02em] text-text leading-tight truncate">
            {template.name}
          </h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                assignee.unassigned
                  ? 'border-rose-400/22 bg-rose-400/10 text-rose-300'
                  : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              }`}
            >
              {assignee.unassigned ? 'Unassigned' : assignee.label}
            </span>
            <span className="text-[11px] text-text-light">
              {template.fields.length} {template.fields.length === 1 ? 'task' : 'tasks'}
            </span>
            {template.is_default && (
              <span className="text-[10px] font-semibold text-gold/80 uppercase tracking-wider">
                Default
              </span>
            )}
          </div>
        </>
      }
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-[12px] font-bold text-text hover:border-gold/30 hover:text-gold transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-b from-gold to-gold-muted text-black text-[12px] font-extrabold hover:brightness-105 transition-all"
            >
              <UserPlus size={13} /> Assign
            </button>
          </div>
        </div>
      }
    >
      {template.fields.length === 0 ? (
        <p className="text-text-muted text-[13px] italic">No tasks defined yet.</p>
      ) : (
        <ul className="space-y-2">
          {template.fields.map((f, i) => (
            <li
              key={f.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <span
                className={`mt-0.5 shrink-0 w-[16px] h-[16px] rounded-[5px] border ${
                  f.is_critical
                    ? 'border-rose-400/55 bg-rose-400/8'
                    : 'border-white/16 bg-white/[0.015]'
                }`}
                aria-hidden="true"
              />
              <span className="text-[13px] text-text leading-snug">{f.label}</span>
              <span className="shrink-0 text-[10px] text-text-light uppercase tracking-wider self-center">
                {f.is_critical ? 'Critical' : `#${i + 1}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FloatingDetailModal>
  )
}
