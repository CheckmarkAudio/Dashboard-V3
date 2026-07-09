# Roles And Accountability

Purpose: define who tackles what, how work is signed, and how future sessions can see responsibility without rereading every chat.

## Role Facts

These are process facts for this repo.

### User

The user is lead director and product architect.

User owns:

- final business priorities
- the north star and company identity
- worker behavior truth
- ambiguous UX language
- brand taste calls
- finance/compliance expectations
- merge/delete/collapse decisions when source of truth is not obvious
- final approval when an AI flags `NEEDS-DIRECTOR`

### Codex

Codex owns:

- codebase inspection
- repo/doc architecture
- roadmap sequencing
- auth/session safety
- Supabase schema, RLS, RPC, and data-contract review
- cross-agent branch/worktree overlap checks
- scoped implementation when data or architecture risk is meaningful
- verification strategy and regression review
- converting broad product direction into safe plans and focused handoffs

Codex must not handwave. If the code, data, or source of truth is unclear, Codex marks it.

### Claude / Fable

Claude/Fable owns focused implementation slices after scope is defined.

Good Claude/Fable tasks:

- one route
- one component family
- one viewport or layout problem
- one visual target
- known files
- clear non-goals
- explicit verification steps

Do not give Claude/Fable:

- "make the whole site amazing"
- broad architecture
- broad Supabase/security changes
- vague file organization cleanup
- Accountant implementation before Codex defines schema and permissions
- multi-page redesigns without a written plan

### ChatGPT

ChatGPT is useful for:

- worker usability scripts
- microcopy and button labels
- roleplaying confused employees
- summarizing worker feedback
- brainstorming alternatives
- drafting focused handoff prompts
- explaining tradeoffs to the user in plain language
- public web research summaries when browsing/citations are available
- onboarding scripts, FAQs, and "new employee" comprehension checks
- accessibility/readability passes on labels and instructions
- interview questions for Gavin or other worker testers
- alternative wording sets for buttons, empty states, and confirmation dialogs

ChatGPT should not be treated as the source of truth for current repo architecture, branch status, or live code.

ChatGPT research standard:

- require sources, dates, and source-quality notes for claims about best practices
- separate evidence from opinion from recommendation
- treat uncited research as brainstorming, not truth
- never provide Vercel, Supabase, GitHub, owner, admin, or real employee secrets
- never let ChatGPT decide migrations, RLS, branch state, file ownership, or production readiness

### Cursor

Cursor is useful for:

- targeted code editing in a local IDE context
- Supabase migration workflow when using `.cursor/skills/supabase-migrate/SKILL.md`
- small focused changes when the file and goal are already clear

Cursor should not apply migrations or broad refactors without the relevant skill/rules and explicit database-work intent.

## Lane Assignment Rule

Assign by risk:

| Work Type | Primary Lane | Review/Support |
|---|---|---|
| Vision, roadmap, source-of-truth docs | Codex | User |
| Broad repo/file organization | Codex | User approval for destructive moves |
| UI polish, scoped route/component | Claude/Fable | Codex for risk review |
| Worker-obviousness testing script | ChatGPT or Codex | User + worker feedback |
| Button labels and microcopy | ChatGPT | User |
| Public UX research and pattern summaries | ChatGPT | Codex checks before repo decisions |
| Worker interview questions and feedback synthesis | ChatGPT | User + Codex |
| Auth/session/shell safety | Codex | Claude for visual shell polish |
| Supabase schema/RLS/RPC | Codex | Cursor only inside migration workflow |
| Accountant foundation | Codex first | Claude after backend contract |
| Visual mockup iteration | Claude/Fable or ChatGPT | User taste approval |

## Handoff Packet

Every delegated task should include:

- objective
- route/component
- exact likely files
- source docs to read
- current branch or PR risk
- non-goals
- uncertainty labels
- verification steps
- expected checkpoint update

Template:

```text
Read first:
- docs/00_PROJECT_OS/README.md
- docs/AI_CODERS_READ_THIS_FIRST.md
- [focused doc]

Goal:
- [one sentence]

Lane:
- [Codex / Claude-Fable / ChatGPT / Cursor]

Files likely involved:
- [paths]

Non-goals:
- [what not to touch]

Uncertainty:
- [NEEDS-DIRECTOR / ASSUMPTION / none]

Verify:
- [build/test/preview/manual steps]

Checkpoint:
- update docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md with actor, timestamp, files, verification, and open gaps.
```

## Session Signature Protocol

At the end of a meaningful work session, add or update a checkpoint entry.

Use:

- timestamp with timezone
- actor
- lane
- summary
- files changed
- verification
- unresolved gaps
- token/source note when visible
- signature tag

Signature examples:

- `CODEX:`
- `CLAUDE:`
- `CHATGPT:`
- `CURSOR:`
- `MANUAL:`

## Token Tracking Protocol

Exact token accounting depends on the app or model surface.

When visible, record:

- AI app/model
- approximate or displayed token use
- whether the session looped, stalled, or stayed focused
- what output was produced
- whether the cost felt appropriate for the result

When not visible, record:

- `Token note: exact token total not visible in this tool.`

Do not invent token counts.

## Accountability Standard

A session is accountable when a future reader can answer:

1. Who worked?
2. What lane were they in?
3. What changed?
4. What was verified?
5. What remains unresolved?
6. What should not be overwritten?
7. What is the next safe move?

If those questions cannot be answered, the session is not fully closed.
