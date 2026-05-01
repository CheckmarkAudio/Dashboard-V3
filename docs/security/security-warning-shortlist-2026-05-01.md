# Security Warning Shortlist — 2026-05-01

Source artifact:
[supabase-security-advisor-2026-05-01.csv](/Users/bridges/GITHUB/Dashboard-V3/docs/security/supabase-security-advisor-2026-05-01.csv:1)

This shortlist is the high-signal reduction of the 75 Supabase Security Advisor warnings.
It is meant to help future Claude/Codex sessions avoid treating all warnings as equally urgent.

## Summary

Warning counts from the CSV:

- `68` — `authenticated_security_definer_function_executable`
- `6` — `function_search_path_mutable`
- `1` — `auth_leaked_password_protection`

High-level interpretation:

- The **single cleanest high-value fix** is enabling leaked password protection in Supabase Auth.
- The **6 mutable `search_path` warnings** are worth fixing and are mostly straightforward.
- The **68 SECURITY DEFINER executable warnings are not all equal**. Many are expected because the app intentionally uses guarded admin/self-service RPCs. These should be triaged by data sensitivity and internal guard strength, not blindly “fixed” to reduce the count.

## Fix Now

These are the best next moves with the highest security value and lowest regression risk.

### 1. Enable leaked password protection

Warning:

- `auth_leaked_password_protection`

Why it matters:

- Prevents users from choosing passwords known to be compromised.
- Very high security value for a low-effort dashboard setting.
- Especially worth enabling because this app stores client, member, and lead data.

Action:

- Enable Supabase Auth leaked-password protection in the dashboard.

### 2. Fix the remaining mutable `search_path` warnings

Warnings:

- `public.intern_generate_checklist`
- `public.publish_daily_checklist`
- `public.approve_task_edit_request`
- `public.intern_get_user_role`
- `public.set_team_id_on_insert`
- `public.task_requests_set_updated_at`

Priority order inside this bucket:

1. `intern_generate_checklist`
2. `publish_daily_checklist`
3. `approve_task_edit_request`
4. `intern_get_user_role`
5. `set_team_id_on_insert`
6. `task_requests_set_updated_at`

Why this bucket matters:

- `search_path` on privileged functions is a real Postgres footgun.
- The top 4 above do real permission-sensitive work.
- The bottom 2 are still worth fixing, but they are lower-value trigger/helper cleanup.

Recommended fix style:

- Recreate the function with `SET search_path = 'public'`
- Keep any explicit schema references where possible.

## Review Carefully

These warnings may represent real risk, but should be audited before changing grants because many are intentional app architecture.

The question is usually not:
"Why is `authenticated` allowed to execute this?"

The real question is:
"Does the function itself strongly enforce owner/admin/team/caller scope?"

### Tier 1 — Most sensitive SECURITY DEFINER RPCs

Audit these first because they touch passwords, roles, clients, bookings, or admin-wide reads/writes.

- `owner_reset_member_password`
- `owner_set_member_role`
- `admin_delete_session`
- `admin_update_session`
- `admin_list_all_sessions`
- `admin_list_all_assigned_tasks`
- `admin_list_clock_entries`
- `admin_update_assigned_task`
- `admin_recent_approvals`
- `admin_recent_assignments`
- `create_client`
- `update_client`
- `archive_client`
- `get_clients`
- `search_clients`

What to confirm:

- They immediately reject non-owner / non-admin callers.
- They scope reads/writes to the caller’s team.
- They do not trust client-provided IDs without validating membership/ownership.
- They use explicit `search_path`.

Current repo read:

- `owner_*` functions appear intentionally owner-guarded by caller email.
- `admin_*session*` functions appear intentionally admin-guarded via `is_team_admin()`.
- `client` RPCs appear intentionally admin-guarded for write paths and team-scoped for reads.

That means these warnings are **not automatically exploitable**, but they are still the right Tier 1 review target.

### Tier 2 — Admin task / assignment workflow RPCs

- `approve_task_edit_request`
- `approve_task_reassignment`
- `approve_task_request`
- `reject_task_request`
- `request_task_reassignment`
- `assign_custom_task_to_members`
- `assign_custom_tasks_to_members`
- `assign_session`
- `assign_template_items_to_members`
- `assign_template_preview`
- `assign_template_to_members`
- `cancel_task_assignment_batch`
- `create_task_template`
- `update_task_template`
- `delete_task_template`
- `duplicate_task_template`
- `add_task_template_item`
- `update_task_template_item`
- `delete_task_template_item`
- `publish_daily_checklist`

Why this bucket is second:

- These affect operations strongly, but are less sensitive than owner password/role or client/session administration.
- Breaking these blindly would likely hurt real workflows quickly.

Review goal:

- Confirm internal `is_team_admin()` / caller checks are present and early.
- Confirm they cannot act cross-team.

## Probably Acceptable For Now

These are still warnings, but many are expected self-service RPC patterns.

- `clock_in`
- `clock_out`
- `get_my_open_clock_entry`
- `get_my_task_requests`
- `get_my_incoming_reassign_requests`
- `get_assignment_notifications`
- `get_channel_notifications`
- `mark_channel_read`
- `mark_all_channels_read`
- `mark_assignment_notification_read`
- `mark_all_assignment_notifications_read`
- `complete_assigned_task`
- `member_overview_snapshot`
- `get_member_assigned_tasks`
- `get_team_assigned_tasks`
- `get_studio_assigned_tasks`
- `get_task_template_detail`
- `get_task_template_library`
- `get_direct_reports`
- `get_my_team_id`
- `is_team_admin`
- `intern_generate_checklist`
- `intern_get_user_role`

Why these are lower urgency:

- The app appears to need them callable by signed-in users.
- Several are read helpers, personal-state helpers, or self-scope operations.
- Their existence as `SECURITY DEFINER` is not ideal by itself, but it is often part of the intended RLS-bypass pattern with caller checks.

## Recommended Next Steps

### Step 1

Enable leaked password protection in Supabase Auth.

### Step 2

Create one focused migration to fix the 6 mutable `search_path` warnings.

### Step 3

Run a targeted audit of Tier 1 SECURITY DEFINER RPCs only.

Suggested audit output:

- function name
- sensitive data touched
- current guard pattern
- whether `authenticated` execute is acceptable
- whether a safer grant/scope model exists

### Step 4

Only after Tier 1 is reviewed, move to Tier 2.

## What Not To Do

- Do **not** blindly revoke `EXECUTE` from every `authenticated` SECURITY DEFINER function.
- Do **not** optimize for warning-count reduction over app safety.
- Do **not** assume every warning is equally dangerous.
- Do **not** conflate UI/runtime bugs with these warnings.

## Recommended Claude Prompt

Ask Claude to do this narrowly:

1. Review `docs/security/supabase-security-advisor-2026-05-01.csv`
2. Read this shortlist doc
3. Audit the Tier 1 SECURITY DEFINER RPCs only
4. Propose the safest next migration(s)
5. Avoid broad revokes that could break working flows
