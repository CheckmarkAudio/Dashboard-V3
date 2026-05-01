# Supabase Schema Security Assessment

Date: 2026-05-01
Scope: Review of stitched "Complete Database Schema" SQL script and current hardening migrations.

## Executive Verdict

The stitched script is not catastrophically broken, but it is too risky to treat as a single production "run once" source of truth. It should be treated as legacy bootstrap SQL and superseded by versioned, tested migrations.

## Primary Risks

### 1) High: SECURITY DEFINER hardening gaps

- Core helpers in the stitched SQL (`get_my_team_id()`, `is_team_admin()`, `get_direct_reports()`) are `SECURITY DEFINER` without pinned `search_path`.
- This creates `function_search_path_mutable` advisor warnings and can increase privilege-escalation risk.
- Existing repo migrations already move in the correct direction:
  - `supabase/migrations/20260501090000_harden_security_surface.sql`
  - `supabase/migrations/20260501103000_fix_function_search_path_warnings.sql`

### 2) High: "Idempotent" claim is operationally weak

- The script uses many `ALTER`, `UPDATE`, `DROP POLICY`, and trigger recreation statements.
- Mid-run failures can leave the DB partially migrated.
- Large one-shot SQL is difficult to validate and roll back safely compared to small migrations.

### 3) High: Potential over-broad team access

- Many table policies grant access based only on `team_id = get_my_team_id()`.
- For sensitive tables, this may exceed intended least-privilege behavior.
- `intern_users` includes PII-like fields (`phone`, `start_date`, status metadata) and likely needs tighter row-level controls.

### 4) Medium: Tenant integrity is not strictly enforced

- Many tables have nullable `team_id` and no hard FK to `teams(id)`.
- Insert triggers help populate `team_id`, but they do not replace relational constraints.
- Missing `NOT NULL` + FK leaves room for drift/inconsistent rows.

### 5) Medium: RLS performance under growth

- RLS predicates frequently rely on `team_id`, but indexing is not consistently declared in the stitched SQL.
- As row count grows, policy checks and common filters can degrade.

### 6) Low/Medium: Schema drift risk

- Current hardening migrations indicate production drift relative to tracked migration history.
- Drift increases deployment unpredictability and troubleshooting cost.

## Assessment of Current Local Hardening Work

- `20260501090000_harden_security_surface.sql`:
  - Recreates key helpers with `SET search_path = 'public'`.
  - Revokes broad execute grants on `SECURITY DEFINER` routines.
  - Re-grants only intended authenticated RPC surface.
  - Hardens selected views to `security_invoker`.
- `20260501103000_fix_function_search_path_warnings.sql`:
  - Applies defensive `ALTER FUNCTION ... SET search_path = public` for known warning sources, including drifted functions if present.

These are positive and aligned with Supabase security guidance.

## Recommended Implementation Plan

1. Treat stitched SQL as historical reference only
   - Do not re-run as canonical production setup.
   - Keep all future change management in `supabase/migrations`.

2. Complete function hardening
   - Ensure every `SECURITY DEFINER` function has explicit `SET search_path = 'public'`.
   - Revoke `PUBLIC`/`anon` execution by default.
   - Grant `authenticated` execution only for explicit app RPCs.

3. Tighten RLS to intended access model
   - Member-owned rows: `intern_id = auth.uid()` (or equivalent) plus admin override.
   - Admin-only operations: require `is_team_admin()`.
   - Sensitive profile data: separate self-view/self-update vs admin scopes.

4. Enforce tenant integrity in schema
   - Add `team_id NOT NULL` where appropriate.
   - Add `FOREIGN KEY (team_id) REFERENCES teams(id)` on tenant tables.
   - Backfill/repair null or orphaned values before enabling strict constraints.

5. Add supporting indexes
   - Prioritize indexes on `team_id`, owner keys (`intern_id`, `assigned_to`), and frequent timeline keys (`created_at`, `metric_date`, etc.).
   - Validate with query plans for the heaviest pages/reports.

6. Build and run a policy verification matrix
   - Validate per table and role (`admin`, `member`) for select/insert/update/delete.
   - Store this as a living artifact to prevent future policy drift.

7. Standardize migration discipline
   - Run changes in staging first.
   - Require security advisor clean (or accepted exceptions with rationale).
   - Avoid one-shot dashboard SQL except for controlled emergency patches.

## Suggested Next Tasking for Codex/Claude

- Produce a migration-by-migration execution plan that:
  - Identifies all tenant tables needing `team_id` constraints and indexes.
  - Proposes specific RLS rewrites for sensitive tables.
  - Includes safe backfill steps and rollback notes.
  - Defines a repeatable role-test harness for policy verification.

