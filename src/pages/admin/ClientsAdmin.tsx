import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, Archive, ArchiveRestore, Briefcase, Edit2, ExternalLink,
  Loader2, Mail, MoreVertical, Phone, Plus, Search, Star, X,
} from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import { Button, Input, PageHeader } from '../../components/ui'
import {
  archiveClient,
  clientKeys,
  createClient as createClientRpc,
  fetchClients,
  updateClient,
  type Client,
  type CreateClientInput,
} from '../../lib/queries/clients'

/**
 * Clients admin page (PR #51) — `/admin/clients`.
 *
 * Mirrors the TeamManager (Members) page's table layout: clean dark
 * table with avatar circles, top-right "Add Client" button, hover-
 * revealed 3-dot per-row action menu. Top-right "Show archived"
 * toggle re-fetches with the archived flag.
 *
 * This is the foundation for Tier 2 / Lean 2 (EmailJS booking
 * confirmations) — the booking modal can now pick a real client and
 * we have an email + phone on file to send to.
 */
export default function ClientsAdmin() {
  useDocumentTitle('Clients - Checkmark Workspace')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const listQuery = useQuery({
    queryKey: clientKeys.list(showArchived),
    queryFn: () => fetchClients({ includeArchived: showArchived }),
  })
  const clients = listQuery.data ?? []

  // Click-outside to close the action menu.
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

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const needle = search.trim().toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.email ?? '').toLowerCase().includes(needle) ||
        (c.phone ?? '').toLowerCase().includes(needle),
    )
  }, [clients, search])

  const archiveMutation = useMutation({
    mutationFn: archiveClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
      toast('Client archived')
    },
    onError: (err) => toast(`Archive failed: ${(err as Error).message}`, 'error'),
  })
  const restoreMutation = useMutation({
    mutationFn: (id: string) => updateClient(id, { archived: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all })
      toast('Client restored')
    },
    onError: (err) => toast(`Restore failed: ${(err as Error).message}`, 'error'),
  })

  const activeCount = clients.filter((c) => !c.archived).length
  const archivedCount = clients.filter((c) => c.archived).length

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      <PageHeader
        icon={Briefcase}
        title={
          <span className="inline-flex items-center gap-2">
            Clients
            <span className="text-sm font-medium text-text-muted bg-surface-alt px-2.5 py-0.5 rounded-full">
              {clients.length}
            </span>
          </span>
        }
        actions={
          <Button
            variant="primary"
            iconLeft={<Plus size={16} aria-hidden="true" />}
            onClick={() => {
              setEditingClient(null)
              setEditorOpen(true)
            }}
          >
            Add Client
          </Button>
        }
      />

      {/* Toolbar: search + show-archived toggle */}
      <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            aria-label="Search clients"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface-alt rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !showArchived ? 'bg-surface text-gold shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            Active <span className="ml-1 opacity-60">{activeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showArchived ? 'bg-surface text-gold shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            All <span className="ml-1 opacity-60">{clients.length + (showArchived ? 0 : archivedCount)}</span>
          </button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="widget-card p-10 flex items-center justify-center text-text-light">
          <Loader2 size={18} className="animate-spin mr-2" />
          Loading clients…
        </div>
      ) : listQuery.error ? (
        <div className="widget-card p-6 flex items-start gap-2 text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Could not load clients</p>
            <p className="text-xs text-text-light mt-0.5">{(listQuery.error as Error).message}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="widget-card p-10 text-center">
          <Briefcase size={22} className="text-text-light mx-auto mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-light">
            {clients.length === 0
              ? 'No clients yet. Add your first one to start sending booking confirmations.'
              : 'No matches for your search.'}
          </p>
        </div>
      ) : (
        <div className="widget-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <ClHeaderCell>Client</ClHeaderCell>
                  <ClHeaderCell>Email</ClHeaderCell>
                  <ClHeaderCell>Phone</ClHeaderCell>
                  <ClHeaderCell>Notes</ClHeaderCell>
                  <ClHeaderCell>Review link</ClHeaderCell>
                  <ClHeaderCell>
                    <span className="sr-only">Actions</span>
                  </ClHeaderCell>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const initial = c.name.charAt(0).toUpperCase()
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group ${
                        c.archived ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Name + initial */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-alt border-[2px] border-white/12 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-text tracking-tight truncate">
                              {c.name}
                              {c.archived && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-bold text-text-light uppercase tracking-wider">
                                  Archived
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-text-light truncate">
                              {new Date(c.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-4">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="text-[13px] text-text-muted hover:text-gold transition-colors inline-flex items-center gap-1.5"
                          >
                            <Mail size={11} aria-hidden="true" />
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-[13px] text-text-light">—</span>
                        )}
                      </td>
                      {/* Phone */}
                      <td className="px-5 py-4">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="text-[13px] text-text-muted hover:text-gold transition-colors inline-flex items-center gap-1.5"
                          >
                            <Phone size={11} aria-hidden="true" />
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-[13px] text-text-light">—</span>
                        )}
                      </td>
                      {/* Notes preview */}
                      <td className="px-5 py-4 max-w-[240px]">
                        <span className="text-[13px] text-text-muted truncate inline-block max-w-full" title={c.notes ?? ''}>
                          {c.notes || '—'}
                        </span>
                      </td>
                      {/* Review link */}
                      <td className="px-5 py-4">
                        {c.google_review_link ? (
                          <a
                            href={c.google_review_link}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[12px] text-gold hover:underline inline-flex items-center gap-1"
                          >
                            <Star size={11} aria-hidden="true" />
                            Open
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-[13px] text-text-light">—</span>
                        )}
                      </td>
                      {/* Action menu */}
                      <td className="px-5 py-4 text-right relative">
                        <div
                          className="relative inline-block"
                          ref={openMenuId === c.id ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors opacity-60 group-hover:opacity-100 focus:opacity-100 focus-ring"
                            aria-label={`Actions for ${c.name}`}
                            aria-expanded={openMenuId === c.id}
                            aria-haspopup="menu"
                          >
                            <MoreVertical size={14} aria-hidden="true" />
                          </button>
                          {openMenuId === c.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl z-20 py-1 animate-fade-in"
                              role="menu"
                            >
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setEditingClient(c)
                                  setEditorOpen(true)
                                  setOpenMenuId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
                              >
                                <Edit2 size={12} aria-hidden="true" /> Edit client
                              </button>
                              {c.archived ? (
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    restoreMutation.mutate(c.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-surface-hover transition-colors"
                                >
                                  <ArchiveRestore size={12} aria-hidden="true" /> Restore
                                </button>
                              ) : (
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    archiveMutation.mutate(c.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-surface-hover transition-colors"
                                >
                                  <Archive size={12} aria-hidden="true" /> Archive
                                </button>
                              )}
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

      {editorOpen && (
        <ClientEditorModal
          client={editingClient}
          onClose={() => {
            setEditorOpen(false)
            setEditingClient(null)
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: clientKeys.all })
            setEditorOpen(false)
            setEditingClient(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Helper components ─────────────────────────────────────────────

function ClHeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-left text-label">{children}</th>
}

/**
 * Modal for creating + editing a client. Stays simple — name is the
 * only required field; everything else (email, phone, notes, Google
 * review link) is optional but encouraged so the EmailJS reminder
 * flow has something to send to.
 */
function ClientEditorModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null
  onClose: () => void
  onSaved: (saved: Client) => void
}) {
  const { toast } = useToast()
  const isEdit = client !== null

  const [name, setName] = useState(client?.name ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [googleReviewLink, setGoogleReviewLink] = useState(client?.google_review_link ?? '')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = name.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const input: CreateClientInput = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        google_review_link: googleReviewLink.trim() || null,
      }
      const saved = isEdit && client
        ? await updateClient(client.id, input)
        : await createClientRpc(input)
      toast(isEdit ? 'Client updated' : 'Client added')
      onSaved(saved)
    } catch (err) {
      toast(`Failed to save: ${(err as Error).message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-editor-title"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="client-editor-title" className="text-lg font-bold text-text">
            {isEdit ? 'Edit client' : 'Add client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            id="client-name"
            label="Name"
            required
            placeholder="Sage Linden"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="client-email"
            label="Email"
            type="email"
            placeholder="sage@example.com"
            hint="Used for booking confirmations + reminders (Tier 2)."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="client-phone"
              label="Phone"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              id="client-google-review-link"
              label="Google review link"
              placeholder="https://g.page/r/..."
              hint="Optional — used by the review-ask flow."
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="client-notes" className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              id="client-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering — preferred mics, label affiliation, etc."
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold focus:outline-none resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={!canSubmit}
          >
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </div>
      </div>
    </div>
  )
}
