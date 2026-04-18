import { useEffect, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import TemplateAssignModal from '../../components/templates/TemplateAssignModal'
import type { ReportTemplate, TemplateField, TeamMember, TaskAssignment } from '../../types'
import {
  ClipboardList, Plus, X, Save, Loader2, Edit2, Trash2, Copy, GripVertical,
  FileText, CheckSquare, BarChart3, AlertTriangle, UserPlus, Users,
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
  useDocumentTitle('Templates - Checkmark Audio')
  useAuth()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  const [name, setName] = useState('')
  const [type, setType] = useState<ReportTemplate['type']>('daily')
  const [position, setPosition] = useState<string>('')
  const [isDefault, setIsDefault] = useState(false)
  const [fields, setFields] = useState<TemplateField[]>([])

  const [assignModalTemplate, setAssignModalTemplate] = useState<ReportTemplate | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<TaskAssignment[]>([])

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

  const getAssignmentCount = (templateId: string) => assignments.filter(a => a.template_id === templateId && a.is_active).length

  const filtered = typeFilter === 'all' ? templates : templates.filter(t => t.type === typeFilter)

  if (loading) return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-text-muted mt-1">Create and manage task templates, then assign them to team members</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowPresets(!showPresets); setShowForm(false) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover">
            <ClipboardList size={16} aria-hidden="true" /> Presets
          </button>
          <button onClick={showForm ? () => { setShowForm(false); resetForm() } : openForm}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold hover:bg-gold-muted text-black font-semibold text-sm">
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Cancel' : 'New Template'}
          </button>
        </div>
      </div>

      {showPresets && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="font-semibold mb-4">Preset Templates</h2>
          <p className="text-sm text-text-muted mb-4">Pick a preset to start with, then customize it to your needs.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESET_TEMPLATES.map((preset, i) => {
              const info = getTypeInfo(preset.type)
              return (
                <button
                  key={i}
                  onClick={() => usePreset(preset)}
                  className="text-left p-4 rounded-lg border border-border hover:border-gold/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-1 rounded ${info.color}`}><info.icon size={14} aria-hidden="true" /></span>
                    <span className="text-xs font-medium text-text-muted capitalize">{preset.type.replace('_', '-')}</span>
                    {preset.position && (
                      <span className="text-xs bg-surface-alt px-1.5 py-0.5 rounded capitalize">{preset.position}</span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm">{preset.name}</h3>
                  <p className="text-xs text-text-muted mt-1">{preset.fields.length} fields</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-semibold">{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>

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

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold hover:bg-gold-muted text-black font-semibold text-sm disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={typeFilter === 'all'} onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-hover'}`}>
          All
        </button>
        {TEMPLATE_TYPES.map(t => (
          <button type="button" key={t.value} role="tab" aria-selected={typeFilter === t.value} onClick={() => setTypeFilter(t.value)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t.value ? t.color : 'text-text-muted hover:bg-surface-hover'}`}>
            <t.icon size={12} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No templates yet. Create one or pick from presets to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(template => {
            const info = getTypeInfo(template.type)
            const assignCount = getAssignmentCount(template.id)
            return (
              <div key={template.id} className="bg-surface rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`p-1 rounded ${info.color}`}><info.icon size={14} aria-hidden="true" /></span>
                      <span className="text-xs font-medium text-text-muted capitalize">{template.type.replace('_', '-')}</span>
                      {template.is_default && (
                        <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">Default</span>
                      )}
                      {assignCount > 0 && (
                        <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Users size={10} aria-hidden="true" /> {assignCount}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold">{template.name}</h3>
                  </div>
                  {template.position && (
                    <span className="text-xs bg-surface-alt px-2 py-1 rounded-full capitalize">{template.position}</span>
                  )}
                </div>

                <div className="space-y-1 mb-4">
                  {template.fields.slice(0, 4).map(field => (
                    <div key={field.id} className="flex items-center gap-2 text-xs text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${field.is_critical ? 'bg-red-400' : 'bg-text-light'}`} />
                      <span className="truncate">{field.label}</span>
                      <span className="text-text-light ml-auto shrink-0">{field.type}</span>
                    </div>
                  ))}
                  {template.fields.length > 4 && (
                    <p className="text-xs text-text-light pl-3.5">+{template.fields.length - 4} more fields</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 border-t border-border pt-3">
                  <button onClick={() => handleEdit(template)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gold hover:bg-gold/10">
                    <Edit2 size={12} aria-hidden="true" /> Edit
                  </button>
                  <button onClick={() => handleDuplicate(template)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-hover">
                    <Copy size={12} aria-hidden="true" /> Duplicate
                  </button>
                  <button onClick={() => setAssignModalTemplate(template)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-violet-400 hover:bg-violet-500/10">
                    <UserPlus size={12} aria-hidden="true" /> Assign Tasks
                  </button>
                  <button onClick={() => handleDelete(template.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 ml-auto">
                    <Trash2 size={12} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
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
