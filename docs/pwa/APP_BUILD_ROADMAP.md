# Checkmark Workspace App Build Roadmap

Purpose: keep the app conversion sequenced, safe, and easy to delegate.

Use this roadmap to decide what comes next. This is the master phase order for app, web-interface polish, and future Accountant work.

This roadmap sits under the broader Project OS. Read `docs/00_PROJECT_OS/README.md` and `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md` first when the work affects vision, repo organization, role lanes, accountability, or cross-agent handoff.

Companion docs:

- `docs/00_PROJECT_OS/README.md`: project mission, language, safety laws, roles, accountability, history, and design memory.
- `docs/AI_CODERS_READ_THIS_FIRST.md`: AI coder roles, shortcut phrases, uncertainty labels, and file organization rules.
- `docs/pwa/APP_EXPERIENCE_PLAYBOOK.md`: product feel and app-quality standards.
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`: website clarity work inside the daily workflow phases.
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`: worker-facing friction audit and validation script.

## Guiding Rule

Build from safety to daily usefulness to polish.

Do not start a large visual redesign, Accountant integration, or native wrapper until the installed app can reliably:

- open
- require the right login state
- preserve a valid session
- log out
- navigate without layout failure
- show daily operational work clearly

## Master Phase Order Rule

This file owns phase order.

`docs/00_PROJECT_OS/` owns the north star, shared language, operating laws, accountability, history protocol, and design memory. It does not reorder this roadmap.

Child docs may add detail, but they may not move Accountant, native wrapper work, or broad UI redesign ahead of auth safety and daily workflow clarity.

Current active product principle:

- make the website worker-obvious before starting Accountant implementation.
- treat `/daily` Tasks as the first tactical proof point of the broader website reform, not the full core vision.

## Phase 0: PWA Foundation

Status: in progress on PR `#280`.

Goal:

- make Checkmark Workspace installable without changing product behavior.

Scope:

- manifest
- icons
- mobile metadata
- installed-app login safety
- PWA docs
- install QA

Owner:

- Codex

Exit criteria:

- PR is up to date with `main`
- build passes
- preview install works
- installed preview does not bypass login through preview auto-login
- no private data is cached offline

## Phase 1: Auth And App Shell Safety

Goal:

- make the installed app feel safe and stable before visual route polish.

Scope:

- login screen mobile fit
- logout path
- clock-out completion and optional logout
- recovery/setup link path
- app shell/header/nav behavior
- no blank white screen states
- no unauthenticated private data flash

Owner:

- Codex for auth/session rules
- Claude for focused shell visual refinements after Codex defines scope

Do not mix with:

- broad page redesign
- calendar sync logic
- Accountant
- Supabase security rewrites unless the bug demands it

Exit criteria:

- `MOBILE_AUTH_QA.md` critical flows checked on mobile browser and installed app
- app shell works at phone width
- user can get in and out predictably

## Phase 2: Role-Based Home

Goal:

- make app launch feel immediately useful for admin and employee roles.

Admin launch should surface:

- operational alerts
- clock/calendar/session state
- task and assignment health
- member status

Employee launch should surface:

- clock state
- today's schedule
- assigned tasks
- messages/requests

Owner:

- Codex for role priority and data contract
- Claude for focused layout polish

Exit criteria:

- `/` or Overview has a clear mobile-first priority order
- no horizontal overflow
- no hidden primary action
- desktop Overview remains intact

## Phase 3: Daily Workflows

Goal:

- make the app useful for actual day-to-day studio work.

Route order and website clarity order:

1. `/daily` / Tasks
2. Messages / DMs / Forum discovery
3. Schedule requests, weekly schedule, and vacation/time-off markers
4. `/calendar`
5. `/sessions` / Booking
6. Dashboard/widget hierarchy cleanup

For each route:

- define the one-sentence job
- identify top three actions
- convert dense desktop controls into mobile-friendly surfaces
- preserve backend-confirmed data behavior
- verify dark and light mode

Website polish source docs:

- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md`
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`
- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`

Owner:

- Claude for focused UI implementation
- Codex for data/security review and workflow boundaries

Exit criteria:

- employees can see and complete daily work
- admins can see schedule/task state
- workers can find DMs without being told where they live
- workers can distinguish weekly schedule, one-time change, and vacation/time off
- booking details are legible
- calendar does not mislead users about sync state

## Phase 4: Admin Operations

Goal:

- make admin management usable on mobile without turning it into a cramped spreadsheet.

Route order:

1. `/admin/members`
2. `/admin/assign`
3. `/admin/settings`
4. `/admin` / Analytics

Owner:

- Codex for permissions, destructive-action safety, and Supabase contracts
- Claude for card/table adaptation and visual polish

Exit criteria:

- member setup/recovery actions are clear
- task assign/edit/delete remains backend-confirmed
- settings panels collapse cleanly
- charts/tables summarize before detail

## Phase 5: Accountant Foundation

Goal:

- integrate the accountant concept as a secure native Checkmark module, not a pasted HTML island.

Initial scope:

- admin-only first
- data model design
- permissions model
- route placement
- import/migration plan from the existing HTML concept
- no employee finance access until the model is proven

Owner:

- Codex for architecture, data model, security, and phased plan
- Claude only after UI scope and backend contract are defined

Exit criteria:

- secure schema plan exists
- no shared finance data leaks between users
- first admin view has real data paths, not placeholders

## Phase 6: Native Wrapper Decision

Goal:

- decide whether a native wrapper is actually needed.

Consider Capacitor/native only after:

- PWA install is stable
- auth is stable
- top mobile workflows are usable
- custom domain is configured
- service worker policy is proven safe

Reasons to consider native later:

- App Store / Play Store presence
- native push notifications
- deeper file/share integrations
- platform-specific polish

Reasons to stay PWA:

- faster updates
- one codebase
- lower cost
- simpler maintenance

## Delegation Rules

All AI coders read `docs/AI_CODERS_READ_THIS_FIRST.md` first.

Give Claude:

- one route
- one viewport problem
- one visual target
- known files
- explicit non-goals

Give Codex:

- planning
- architecture
- auth/session safety
- Supabase/data contracts
- PR conflict checks
- app build sequence

Give ChatGPT:

- worker usability scripts
- microcopy and labels
- feedback summaries
- focused handoff prompt drafts
- public UX research summaries with citations
- plain-language tradeoff explanations
- worker interview questions and feedback synthesis

ChatGPT research rule:

- sources and dates are required for public research claims
- uncited research is brainstorming only
- ChatGPT is not the source of truth for repo architecture, branch status, migrations, RLS, or production readiness

Shared rule:

- no one touches a file owned by another active PR without checking first.

## Next Best Step After PR #280

Run Phase 1:

1. Verify installed-app auth.
2. Fix any login/logout/app-shell blockers.
3. Only then start the first mobile route polish slice.

## Current Web Interface Track

For the worker-obviousness work requested after the initial app/PWA planning, run this sequence without starting Accountant:

1. Keep this roadmap as the phase owner.
2. Use `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md` for the website polish plan.
3. Run the worker audit in `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`.
4. Implement Tasks first from `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`.
5. Then improve Messages/DM discovery from `docs/ux/MESSAGES_DISCOVERY_PLAN.md`.
6. Then redesign schedule/vacation flow from `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`.

## Deferred Low-Priority TODOs

### Optional external AI real-app preview

Status: not high priority.

Goal: optionally let ChatGPT or another outside reviewer inspect the real employee UI through a guarded Vercel branch preview, only if screenshot/static-preview feedback is not enough.

Rules:

- use a fake, low-permission employee/member account only
- Vercel env vars must be Preview scope only, never Production
- do not use owner, admin, real employee, Vercel, Supabase, or GitHub secrets
- expect every branch preview to auto-login while the vars are enabled
- remove or rotate the fake account credentials after the review cycle
- this does not replace Codex/Claude preview posting or normal auth QA

Prefer first:

1. screenshots for pinpoint visual issues
2. `public/ai-worker-preview.html` for public-safe fake-data exploration
3. real-app preview auto-login only when the reviewer truly needs route behavior
