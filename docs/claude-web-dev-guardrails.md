# Claude Web Dev Guardrails

Date: 2026-05-05

Use this before and during Claude Code web-development sessions. The goal is to make Claude safer, more efficient, and less likely to drift when building UI, frontend flows, Supabase-backed features, or Vercel previews.

These guardrails support the project cornerstones:

- beautiful, refined, worker-magnetic Checkmark operating system
- clean and DRY code
- performance-conscious UI
- accessible interactions
- secure backend practices

## Start Here

Before editing files:

- For a fresh session, run `.claude/commands/start-session.md` before coding.
- Read `docs/00_PROJECT_OS/README.md`.
- Read `docs/00_PROJECT_OS/01_VISION_AND_PURPOSE.md` when the request affects vision, roadmap, file organization, or broad UI/UX direction.
- Read `docs/AI_CODERS_READ_THIS_FIRST.md`.
- Read `docs/SESSION_CONTEXT.md`.
- Read `docs/PROJECT_STATE.md`.
- Read `docs/pwa/APP_BUILD_ROADMAP.md` when the request affects app/web phase order.
- For UI, layout, theme, widget chrome, spacing, borders, typography, or visual polish, use the repo-local Claude skill at `.claude/skills/ui-consistency/SKILL.md`.
- For broad planning, repo organization, roadmap sequencing, role lanes, accountability, or "where were we" work, use `.claude/skills/project-os/SKILL.md`.
- For worker-facing Tasks, Schedule, Messages, Forum, Dashboard widgets, or navigation clarity, use `.claude/skills/worker-obviousness/SKILL.md`.
- For visual standards, read `docs/ui-standards.md`.
- For Assign, Tasks, task requests, approvals, or related RPCs, read `docs/assign-engine-spec-2026-05-03.md`.
- For merge readiness, use `docs/pr-acceptance-checklist.md`.
- Check open PRs and avoid overlapping active Claude/Codex work.
- Check `git status` and do not overwrite unrelated local changes.

If the user asks for a visual change, identify whether it is:

- a small component polish
- a page layout change
- a behavior change
- a backend/data change hidden behind UI
- a worker-obviousness change that needs a focused UX plan
- a Project OS/source-of-truth change that needs history or role-lane updates

Do not silently turn one category into another.

## Scope Discipline

Keep each PR focused.

- Do not redesign a page unless the user clearly asked for a redesign.
- Do not let layout experiments redefine product behavior.
- Do not refactor unrelated files just because they are nearby.
- Do not mix large visual redesigns with database/security changes unless the user explicitly wants one combined PR.
- If a requested change reveals a backend bug, name it and decide whether it belongs in the current PR.

When the user says something is wrong visually, inspect the full page before patching one element. Many issues are alignment, containment, spacing, or contrast problems across the whole viewport.

## UI Verification

For frontend work:

- Verify on the Vercel preview when possible, not only localhost.
- Inspect the whole page at a realistic desktop viewport.
- Check a narrower viewport if the changed area can wrap or overflow.
- Confirm text does not overlap, clip, or shrink into unreadability.
- Check both light and dark mode when styles or colors changed.
- Check hover, active, loading, empty, error, and partial-success states where applicable.
- Use the actual route and role the user cares about.

Avoid declaring a visual issue fixed from DOM numbers alone. DOM geometry is useful, but the final check is whether the full screen reads correctly.

## UI Consistency

Use `docs/ui-standards.md` as the styling source of truth.

- Colors should come from `src/index.css` tokens.
- Widget chrome should come from `.widget-card` and `DashboardWidgetFrame`.
- Widget-grid layout should come from `WorkspacePanel`.
- Shared visual changes should be made in shared classes/components, not repeated local Tailwind strings.
- Arbitrary values such as `text-[13px]`, `rounded-[17px]`, `border-[#...]`, and `shadow-[...]` need a reason.
- If a border, radius, font size, or color should match across pages, update the shared token/class/component so it changes site-wide.

## Accessibility Rules

- Use real `<button>` elements for actions.
- Icon-only controls need accessible labels.
- Destructive actions need clear labels and confirmation where appropriate.
- Color cannot be the only indicator of status, selection, warnings, or errors.
- Focus should remain visible and predictable.
- Modals should open, close, and return focus without trapping the user.
- Text contrast must remain readable over translucent backgrounds.
- Tiny labels should be used sparingly; do not solve layout pressure by making important text too small.

## Backend + Supabase Rules

Vercel green does not mean Supabase SQL is live.

If a PR includes `supabase/migrations`:

- Read the migration before merge.
- Confirm it is idempotent or safe to rerun.
- Confirm frontend code handles the deploy split if the DB is not applied yet.
- Apply the migration to the target Supabase project before relying on the feature in production.
- Verify with a read-only SQL query after applying.
- Record whether SQL was manual, MCP-applied, or deferred.

RPC expectations:

- Admin/owner permissions are enforced in the database.
- SECURITY DEFINER functions set `search_path TO 'public'`.
- Grants are narrow and intentional.
- Mutations are team-scoped.
- Destructive mutations return affected IDs or counts.
- The frontend should not hide backend failures with optimistic UI.

## Cache + Data Honesty

The app should show what the backend confirmed.

- Do not remove records from the UI after delete/edit/transfer unless the backend confirms the affected IDs or counts.
- Show partial success clearly.
- Show zero-change results clearly.
- Invalidate all affected query keys after confirmed mutations.
- Prefer structured returned data over guessing from request payloads.
- Treat stale cache as a bug to fix, not a user-refresh requirement.

## Performance Guardrails

- Avoid broad page-level fetches when a focused query or existing context is enough.
- Avoid adding polling loops when realtime, invalidation, or a one-shot refresh is enough.
- Clean up subscriptions, timers, and background jobs.
- Do not leave orphan background commands running.
- Do not add heavy libraries for a small UI flourish.
- Keep first-load paths lean; backend-prepared data is preferred for daily operational surfaces.

## Preview + PR Flow

Before opening or merging a PR:

- Build locally if the change touches runtime code.
- Push a feature branch, not `main`.
- Open a PR with a clear title and summary.
- Wait for Vercel checks.
- Give the user the preview URL when visual validation matters.
- Update docs in the same PR when behavior, schema, routes, security, or workflow changed.
- Use squash merge for most Claude/Codex PRs unless preserving commit sequence matters.

If a permission or push hook blocks GitHub push, do not paste large patches into terminals as a workaround. Fix the push guardrail or ask the user to approve the intended feature-branch push.

## Background Task Safety

Do not start unbounded watch loops.

Allowed patterns:

- one-shot wait with a maximum number of attempts
- bounded polling with a hard timeout
- explicit cleanup after a background task finishes

Avoid:

- `until ...; do sleep ...; done` loops with no max tries
- watchers that continue after a PR is merged or closed
- starting multiple preview/check loops without tracking them

If a background task is started, name what it is watching and when it will stop.

## Documentation Rules

Update docs in the same PR when a change affects:

- project state
- session handoff context
- schema, migrations, or RPC behavior
- role/security boundaries
- Assign, Tasks, Calendar, Booking, Members, Forum, Settings, or other core workflows

Use provenance tags in `docs/SESSION_CONTEXT.md` when helpful:

- `CLAUDE:`
- `CODEX:`
- `MANUAL-SUPABASE:`
- `MCP-APPLIED:`
- `LIVE-VERIFIED:`
- `ADVISOR-VERIFIED:`

## Stop And Ask

Stop and ask the user before continuing when:

- the requested visual change conflicts with an existing product contract
- the requested implementation requires destructive SQL
- a page redesign is implied but not explicit
- a migration cannot be verified
- the preview shows a result that technically works but does not match the user's stated intent
- another active PR is touching the same files or workflow

The best Claude session is not the one that changes the most files. It is the one that ships the intended behavior cleanly, verifies it, documents it, and leaves the next session with less uncertainty.
