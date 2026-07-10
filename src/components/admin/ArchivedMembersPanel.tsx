import { useCallback, useEffect, useState } from 'react'
import { Archive, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { fetchArchivedTeamMembers } from '../../lib/queries/teamMembers'
import {
  inspectMember,
  permanentlyDeleteMember,
  unarchiveMember,
} from '../../lib/queries/memberLifecycle'
import { useToast } from '../Toast'
import MemberAvatar from '../members/MemberAvatar'
import type { TeamMember } from '../../types'

/**
 * Settings → Archive. Home for members removed from the active roster.
 *
 * Archived members are hidden everywhere else in the app (the shared
 * `fetchTeamMembers` roster query excludes `status = 'inactive'`), so this
 * panel is the one place to see them, bring them back, or delete them for
 * good. Restore re-enables their login and returns them to the roster;
 * Delete forever only succeeds when they have no linked history (the DB's
 * foreign keys block it otherwise, to keep old work attributed).
 */
export default function ArchivedMembersPanel() {
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setMembers(await fetchArchivedTeamMembers())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load archived members')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleRestore = useCallback(async (member: TeamMember) => {
    setBusyId(member.id)
    try {
      await unarchiveMember(member.id)
      toast(`${member.display_name} restored — they're back on the roster`, 'success')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restore failed', 'error')
    } finally {
      setBusyId(null)
    }
  }, [load, toast])

  const handleDelete = useCallback(async (member: TeamMember) => {
    // Two-tap: first tap arms the row, second tap commits.
    if (confirmingDeleteId !== member.id) {
      setConfirmingDeleteId(member.id)
      // Pre-check history so we can warn before they tap again.
      try {
        const { canPermanentlyDelete } = await inspectMember(member.id)
        if (!canPermanentlyDelete) {
          toast(`${member.display_name} has linked history and can't be deleted — they'll stay archived.`, 'error')
          setConfirmingDeleteId(null)
        }
      } catch {
        // Let the delete attempt surface the real reason if inspect fails.
      }
      return
    }
    setBusyId(member.id)
    try {
      await permanentlyDeleteMember(member.id)
      toast(`${member.display_name} deleted — their email can be re-added anytime`, 'success')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
    } finally {
      setBusyId(null)
      setConfirmingDeleteId(null)
    }
  }, [confirmingDeleteId, load, toast])

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-bold">Archive</h2>
        <p className="text-[13px] text-text-muted mt-0.5">
          Members removed from the roster. They're hidden everywhere else in the app.
          Restore brings them back; Delete forever is only possible when they have no history.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {members === null ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-6" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading archived members…
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10 text-text-muted">
          <Archive size={28} className="text-text-light" aria-hidden="true" />
          <p className="text-sm font-medium text-text">No archived members</p>
          <p className="text-[13px]">When you remove someone with Archive, they'll show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => {
            const busy = busyId === member.id
            const arming = confirmingDeleteId === member.id
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-alt/40"
              >
                <MemberAvatar member={member} size="md" className="grayscale opacity-70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{member.display_name}</p>
                  <p className="text-xs text-text-muted truncate">{member.email}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestore(member)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-sm font-semibold text-emerald-300 transition-colors focus-ring disabled:opacity-50"
                >
                  {busy && !arming
                    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    : <RotateCcw size={14} aria-hidden="true" />}
                  Restore
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(member)}
                  disabled={busy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors focus-ring disabled:opacity-50 ${
                    arming
                      ? 'border-red-400 bg-red-500/25 hover:bg-red-500/30 text-red-200'
                      : 'border-red-400/40 bg-red-500/10 hover:bg-red-500/20 text-red-300'
                  }`}
                >
                  {busy && arming
                    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    : <Trash2 size={14} aria-hidden="true" />}
                  {arming ? 'Tap to confirm' : 'Delete forever'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
