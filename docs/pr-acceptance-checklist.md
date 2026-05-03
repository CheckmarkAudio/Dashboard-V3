# PR Acceptance Checklist

Date: 2026-05-03

Use this before merging any meaningful PR into `main`. The goal is to keep the project aligned with the cornerstones: clean and DRY code, performance-conscious UI, accessibility, and secure backend practices.

## Quick Decision

Do not merge until each applicable item is true:

- The PR scope is clear and matches the title.
- Vercel checks are green.
- The preview URL has been opened and clicked through for the changed flow.
- Supabase migrations, if present, have a plan and have been applied or explicitly deferred.
- Docs are updated in the same PR when behavior, schema, routes, security, or workflow changed.
- No known production-risk issue is being hidden by optimistic UI, stale cache, or local-only state.

## Code Quality

- The change follows existing repo patterns instead of adding a new style without need.
- Repeated logic was reused through existing helpers, hooks, components, or RPCs where practical.
- The PR avoids unrelated refactors.
- The diff is small enough to review, or the PR description explains why it must be broad.
- Console logs, throwaway comments, and temporary debug UI are removed.

## Frontend UX

- The changed flow works in the Vercel preview, not only on localhost.
- Buttons that perform actions are real buttons.
- Interactive controls are keyboard reachable.
- Text remains readable in light and dark mode.
- Loading, empty, success, partial-success, and error states are honest.
- The UI does not remove records optimistically unless the backend confirms the mutation.

## Accessibility

- Icons that are the only visible label have an accessible label or clear surrounding text.
- Destructive actions use clear labels and confirmation where appropriate.
- Color is not the only signal for status, errors, warnings, or selection.
- Focus is not trapped or lost when modals open and close.
- Text contrast is readable over translucent backgrounds.

## Backend + Data Safety

- Admin or owner actions are enforced by RPC/RLS, not only by frontend checks.
- SECURITY DEFINER functions set `search_path TO 'public'`.
- RPC grants are intentional: revoke from `PUBLIC` and `anon`; grant only what the app needs.
- Team-scoped data mutations use `team_id = get_my_team_id()` or an equivalent proven ownership path.
- Destructive operations return counts or IDs so the UI can verify what actually changed.
- Hard deletes are tightly scoped. Prefer archive/test-data flows for business records.

## Supabase Migrations

If the PR includes `supabase/migrations`:

- Read every migration before merge.
- Confirm whether it is idempotent or safe to rerun.
- Confirm whether frontend code gracefully handles old and new DB shapes during deploy split.
- Apply migrations to the target Supabase project before relying on the feature in production.
- Verify with a read-only SQL query after apply.
- Record manual or MCP-applied SQL in the PR notes or docs when relevant.

Important: Vercel green means the frontend built and deployed. It does not mean Supabase SQL is live.

## Performance

- The PR does not add broad page-level fetches when a narrower query or existing context will do.
- Expensive derived data is prepared by the backend when it affects first-load experience.
- New subscriptions, intervals, or background tasks clean up after themselves.
- Large visual or library additions are justified by the user-facing value.

## Documentation

Update docs in the same PR when the change affects:

- current project state
- session handoff context
- schema, migrations, or RPC behavior
- role/security boundaries
- core workflows such as Assign, Tasks, Calendar, Booking, Members, Forum, or Settings

Suggested docs:

- `docs/PROJECT_STATE.md`
- `docs/SESSION_CONTEXT.md`
- feature-specific docs under `docs/`

## Merge Choice

Use squash and merge for most Claude/Codex PRs. It keeps `main` readable when a branch has exploratory or iterative commits.

Use regular merge only when preserving the branch's commit sequence is important.

## Final Merge Note

Before clicking merge, write down:

- what changed
- what was verified
- whether migrations were applied
- what remains deferred

That note becomes the first draft for the docs update and the next-session handoff.
