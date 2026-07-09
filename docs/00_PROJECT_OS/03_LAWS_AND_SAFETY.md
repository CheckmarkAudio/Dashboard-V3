# Laws And Safety

Purpose: define the structural laws for building Checkmark without drift, guessing, false data, unsafe SQL, or confusing repo organization.

These laws apply to all AI coders and humans.

## Law 1: Do Not Guess Through Unclear Truth

If the instruction, data model, business rule, brand rule, or worker behavior is unclear, mark it.

Use:

- `NEEDS-DIRECTOR` for user/business decisions
- `NEEDS-WORKER-TEST` for real employee behavior questions
- `ASSUMPTION` for a reasonable but unproven bridge
- `BLOCKED` when work should stop
- `PLACEHOLDER-DATA` for fake or incomplete data

Do not stretch the truth to keep momentum.

## Law 2: No False Success

The interface must not pretend work succeeded if the backend did not confirm it.

Required:

- mutations handle errors honestly
- destructive changes return affected IDs or counts where possible
- partial success is named
- optimistic UI does not hide backend failure
- placeholder data is marked
- demo data does not masquerade as production truth

## Law 3: Supabase Data Must Not Become Orphaned

Any database-affecting work must account for:

- team ownership
- user/member ownership
- RLS
- RPC permissions
- generated TypeScript types
- migration apply status
- related realtime subscriptions when relevant
- delete/edit/transfer/approval data paths

Vercel green does not mean Supabase SQL is live.

If a migration exists, record whether it was applied, how it was applied, and what verified it.

## Law 4: Branches And Worktrees Are Real Project State

Before editing shared or risky files:

- check `git status --short --branch`
- check current branch
- check open PRs when GitHub access is available
- identify active Claude/Codex overlap
- do not overwrite unrelated local changes

If another active PR owns the same file or workflow, stop and report the overlap before editing.

## Law 5: File Organization Must Stay Human-Findable

Do not create folder sprawl to look organized.

Use existing buckets when they fit:

- `docs/00_PROJECT_OS/`: project mission, language, roles, laws, learning, design memory, checkpoint ledger
- `docs/pwa/`: app/PWA roadmap and app quality
- `docs/ux/`: tactical worker-facing usability plans
- `docs/security/`: Supabase/security reports and assessments
- `docs/mockups/`: HTML mockups and visual review drafts
- `docs/pages/`: per-page screenshot history
- `docs/visual-refs/`: aesthetic references and implementation visual context
- `docs/Menu-Sidebar/`: frozen global chrome design source
- `.claude/skills/`: Claude/Fable task skills
- `.claude/commands/`: Claude/Fable startup and QA commands
- `.cursor/skills/`: Cursor-specific operational skills

Do not delete, merge, or move historical docs unless references and current accuracy have been checked.

## Law 6: UI Polish Must Serve Clarity

Beautiful UI is required, but decorative complexity is not the goal.

Required:

- primary action is visible
- controls look clickable
- icon-only controls are accessible and obvious when important
- buttons share a hierarchy
- pages have one clear job
- dense data is grouped, summarized, or moved behind panes
- no information wall by default on daily worker flows
- visual changes use shared tokens/components when they should apply broadly

Use `docs/ui-standards.md` before styling changes.

## Law 7: Accessibility Is Part Of Done

Every UI change should preserve:

- keyboard access
- visible focus
- readable contrast
- semantic buttons and links
- accessible labels for icon-only actions
- non-color-only status signals
- no text overlap or clipping

Do not solve layout pressure by shrinking important text until it becomes hard to read.

## Law 8: History Must Be Updated At Meaningful Checkpoints

When a meaningful session, PR, or phase closes, update the right record:

- `CHECKPOINT_LEDGER.md` for who did what, when, and what remains uncertain
- `docs/SESSION_CONTEXT.md` for broad handoff context
- `docs/PROJECT_STATE.md` for current live/in-flight project state
- `docs/LEARNING_LOG.md` for real lessons learned from actual project work
- focused roadmap/plan docs when behavior, sequence, or scope changes

Do not record a problem as resolved unless it is actually resolved and verified.

## Law 9: Accountant Waits For Daily Clarity Unless Directed

Checkmark Accountant is important.

It should not jump ahead of auth safety, daily worker clarity, and backend discipline unless the user explicitly overrides the phase order.

Accountant needs a secure schema, permission model, and admin-only first path before UI implementation.

## Law 10: Ask Like Raising A Hand

When the right next action is blocked by unclear direction, call it out cleanly.

Use this format:

```text
NEEDS-DIRECTOR:
- Decision needed:
- Why it matters:
- Options I see:
- Recommended choice:
- What I will do after you decide:
```

This is not failure. It is structural integrity.
