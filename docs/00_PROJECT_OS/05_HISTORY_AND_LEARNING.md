# History And Learning

Purpose: make "where were we?" a history-focused process, not a vague re-declaration of the north star.

The north star tells us why we are building. History tells us where we left the tools on the table.

## Where Were We Protocol

When the user asks "where were we?", answer from evidence in this order:

1. `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`
2. `docs/SESSION_CONTEXT.md`
3. `docs/PROJECT_STATE.md`
4. `docs/pwa/APP_BUILD_ROADMAP.md`
5. active focused plan in `docs/ux/` or `docs/pwa/`
6. `git status --short --branch`
7. latest relevant commit or PR status if needed

Answer:

- last meaningful checkpoint
- current phase
- current tactical target
- files already changed
- verified behavior
- unresolved gaps
- likely conflict risks
- next safe move

Do not answer "where were we?" with only the mission. The mission belongs in `01_VISION_AND_PURPOSE.md`; the answer belongs in project history.

## Current History Sources

| Source | Use For |
|---|---|
| `CHECKPOINT_LEDGER.md` | New append-only work signatures and session checkpoints. |
| `docs/SESSION_CONTEXT.md` | Broad handoff history, recent + next, lessons, provenance tags. |
| `docs/PROJECT_STATE.md` | Current live/in-flight state and production context. |
| `docs/LEARNING_LOG.md` | Durable concepts learned from real project work. |
| `docs/pwa/APP_BUILD_ROADMAP.md` | Master phase order. |
| `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md` | Current website polish sequence. |
| `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md` | Current usability friction and worker-test script. |

## Learning Protocol

Record learning when:

- a bug exposed a reusable lesson
- an AI or human made a recurring mistake
- a process failed and the fix is now known
- the user explicitly says "remember this" or "add this to my learning log"
- a better pattern was proven by implementation and verification

Do not record a fix as resolved unless it was actually resolved.

Use this shape for project-process lessons:

```text
## YYYY-MM-DD - [Lesson name]

Problem:
- What went wrong or hurt.

Cause:
- What actually caused it.

Resolution:
- What fixed it, if fixed.

Status:
- Resolved / Partially resolved / Open.

Future rule:
- What future sessions must do differently.

Evidence:
- File, PR, command, or verification note.
```

## Mistake And Pain Log Standard

If a painful pattern repeats, document it instead of letting each new AI rediscover it.

Examples:

- branch and PR confusion
- Supabase migrations not applied even though Vercel is green
- placeholder data looking real
- UI components drifting from shared tokens
- information walls on daily workflow pages
- icon-only controls hiding important actions
- AI sessions over-spending tokens by scanning too broadly

## Reference Lists

Useful references should live where they are useful:

- design references: `docs/visual-refs/`, `docs/mockups/`, `docs/pages/`
- UI rules: `docs/ui-standards.md`, `docs/CANONICAL-MOCKUPS.md`
- backend/security: `docs/security/`, `docs/pr-acceptance-checklist.md`
- app/PWA: `docs/pwa/`
- worker UX: `docs/ux/`
- personal dev learning: `docs/LEARNING_LOG.md`

Do not paste large outside references into docs unless they are summarized, sourced, and still useful.

## Historical Cleanup Rule

A historical file can be archived, merged, or removed only after:

- current references are checked
- live accuracy is understood
- the replacement location is identified
- the user approves if there is doubt

When unsure, keep the file and add an index note instead.
