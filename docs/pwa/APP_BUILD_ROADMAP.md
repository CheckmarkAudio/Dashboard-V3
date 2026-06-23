# Checkmark Workspace App Build Roadmap

Purpose: keep the app conversion sequenced, safe, and easy to delegate.

Use this roadmap to decide what comes next after the PWA foundation is merged.

## Guiding Rule

Build from safety to daily usefulness to polish.

Do not start a large visual redesign, Accountant integration, or native wrapper until the installed app can reliably:

- open
- require the right login state
- preserve a valid session
- log out
- navigate without layout failure
- show daily operational work clearly

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

Route order:

1. `/daily` / Tasks
2. `/calendar`
3. `/sessions` / Booking
4. `/forum`

For each route:

- define the one-sentence job
- identify top three actions
- convert dense desktop controls into mobile-friendly surfaces
- preserve backend-confirmed data behavior
- verify dark and light mode

Owner:

- Claude for focused UI implementation
- Codex for data/security review and workflow boundaries

Exit criteria:

- employees can see and complete daily work
- admins can see schedule/task state
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

Shared rule:

- no one touches a file owned by another active PR without checking first.

## Next Best Step After PR #280

Run Phase 1:

1. Verify installed-app auth.
2. Fix any login/logout/app-shell blockers.
3. Only then start the first mobile route polish slice.
