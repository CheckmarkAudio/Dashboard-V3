# Checkpoint Ledger

Purpose: append-only record of who did what, when, why, with verification and open gaps.

This file helps future sessions answer "where were we?" and "who tackles what?" without relying on chat memory.

## Entry Template

```text
## YYYY-MM-DD HH:MM TZ - ACTOR - Short title

Lane:
- [role lane]

Summary:
- [what changed]

Files changed:
- [paths]

Verification:
- [commands, previews, manual checks, or not run]

Open gaps:
- [NEEDS-DIRECTOR / NEEDS-WORKER-TEST / ASSUMPTION / BLOCKED]

Token/source note:
- [displayed token usage if visible, or exact token total not visible]

Signature:
- ACTOR:
```

## 2026-07-08 18:46 MDT - CODEX - Project OS foundation and daily tasks proof point

Lane:
- Codex: repo/documentation architecture, roadmap wiring, scoped `/daily` implementation, verification.

Summary:
- Created the first Project OS layer so the broad Checkmark vision, shared language, safety laws, roles, history process, design system, and accountability protocol are durable repo infrastructure.
- Preserved `docs/pwa/APP_BUILD_ROADMAP.md` as the master phase order.
- Reframed `/daily` Tasks as the first tactical proof point of the broader website/UI reform, not the core vision itself.
- Converted `/daily` to open on My Tasks with secondary task contexts behind a sidebar/pane system earlier in this session.

Files changed:
- `docs/00_PROJECT_OS/README.md`
- `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md`
- `docs/00_PROJECT_OS/02_LANGUAGE_AND_KEYS.md`
- `docs/00_PROJECT_OS/03_LAWS_AND_SAFETY.md`
- `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
- `docs/00_PROJECT_OS/05_HISTORY_AND_LEARNING.md`
- `docs/00_PROJECT_OS/06_ART_AND_DESIGN_SYSTEM.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`
- `docs/AI_CODERS_READ_THIS_FIRST.md`
- `docs/pwa/APP_BUILD_ROADMAP.md`
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/pwa/PWA_STRATEGY.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- `.claude/commands/start-session.md`
- `.claude/skills/worker-obviousness/SKILL.md`
- `.claude/skills/project-os/SKILL.md`
- `docs/PROJECT_STATE.md`
- `docs/claude-web-dev-guardrails.md`
- `src/pages/DailyChecklist.tsx`

Verification:
- `npm run build` passed earlier in the session after the `/daily` runtime change.
- `git diff --check` passed after Project OS wiring.
- `npm run build` passed after Project OS wiring.
- `rg` checks confirmed Project OS references in startup, roadmap, guardrail, skill, state, and UX files.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Gavin or another worker should test whether `/daily` now clearly starts on My Tasks and whether secondary panes are understandable.
- <span style="color:#d97706">NEEDS-DIRECTOR</span>: vacation/time-off final wording and data model need director approval before backend work.
- <span style="color:#7c3aed">ASSUMPTION</span>: historical docs should be indexed before any destructive consolidation.

Token/source note:
- Exact token total not visible in this repo file. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-08 21:58 MDT - CODEX - Public-safe AI worker preview harness

Lane:
- Codex: safe preview strategy, fake-data static page, worker-obviousness documentation.

Summary:
- Added a public-safe, fake-data preview page that ChatGPT or another AI reviewer can explore without accessing the real login-protected workspace.
- Documented the page as an AI usability preview harness, not live app truth.
- Explicitly warned against exposing `npm run dev` publicly because local dev has a development auth bypass.

Files changed:
- `public/ai-worker-preview.html`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed.
- `npm run build` passed.
- Build copied the page to `dist/ai-worker-preview.html`.
- Browser plugin blocked direct `file://` reload by policy; user will review the generated HTML/browser page manually.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: ChatGPT/AI review can find obvious friction, but real employee testing still needs Gavin or another worker.
- <span style="color:#7c3aed">ASSUMPTION</span>: Vercel preview will serve the static page at `/ai-worker-preview.html` after deployment.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-08 22:56 MDT - CODEX - ChatGPT role boundary and optional preview todo

Lane:
- Codex: AI role policy, safety boundaries, roadmap documentation.

Summary:
- Recorded the real-app ChatGPT preview path as a deferred, low-priority TODO rather than a default QA workflow.
- Expanded ChatGPT's lane toward public research with citations, usability scripts, microcopy, worker roleplay, feedback synthesis, and plain-language tradeoff summaries.
- Reconfirmed that ChatGPT is not a source of truth for current repo architecture, branch status, migrations, RLS, production readiness, or secrets.

Files changed:
- `docs/AI_CODERS_READ_THIS_FIRST.md`
- `docs/00_PROJECT_OS/04_ROLES_AND_ACCOUNTABILITY.md`
- `docs/pwa/APP_BUILD_ROADMAP.md`
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: real employees still need to test worker-obviousness; ChatGPT can help prepare scripts and summarize feedback, but cannot replace worker truth.
- <span style="color:#7c3aed">ASSUMPTION</span>: ChatGPT research is only evidence-grade when the session can browse and cite sources.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:

## 2026-07-09 01:00 MDT - CODEX - Daily clean-audit mobile follow-up

Lane:
- Codex: scoped `/daily` review, mobile polish, verification, checkpointing.

Summary:
- Reviewed Claude's clean-session `/daily` audit output.
- Confirmed the core `/daily` behavior is structurally sound: My Tasks opens first, My Tasks interactions stay inside `MyTasksCard`, and secondary task contexts render as panes.
- Applied the two low-risk mobile fixes from the audit: hid the redundant mobile sidebar heading and made the tall pane/content min-heights desktop-only.

Files changed:
- `src/pages/DailyChecklist.tsx`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/00_PROJECT_OS/CHECKPOINT_LEDGER.md`

Verification:
- `git diff --check` passed before the docs note.
- `npm run build` passed after the `/daily` mobile fixes.

Open gaps:
- <span style="color:#2563eb">NEEDS-WORKER-TEST</span>: real employee testing still needs to confirm Team Tasks vs Studio Tasks wording.
- <span style="color:#7c3aed">ASSUMPTION</span>: Claude's audit was static code review, not a live browser click-through.

Token/source note:
- Exact token total not visible in this tool. Use the Codex app/session token meter if available.

Signature:
- CODEX:
