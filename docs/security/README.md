# Security Audit Artifacts

> Snapshot artifacts from the **2026-05-01 security stabilization** session +
> the **Tier 1 SECURITY DEFINER RPC audit** that followed. These are
> point-in-time records — newer state lives in the live Supabase Security
> Advisor.

## What's in this folder

| File | What it is |
|--|--|
| `supabase-security-advisor-2026-05-01.csv` | Raw export of all 75 Supabase Security Advisor warnings on 2026-05-01 BEFORE the hardening sweep. Reference baseline. |
| `security-warning-shortlist-2026-05-01.md` | High-signal triage doc — Tier 1 / Tier 2 / "probably acceptable" buckets + recommended fix order + what NOT to do. The reference for Tier 1 audits. |

## Provenance

- Codex authored both files in the 2026-05-01 stabilization session
  (commit `4d2e267 "security updates"` on main).
- The shortlist doc is **not exhaustive** — it omits expected `authenticated`-
  callable SECURITY DEFINER RPCs that are part of the intended app
  architecture. See the doc's "Probably Acceptable For Now" section.

## Live state since then

| Concern | 2026-05-01 baseline | Current (post Tier 1 audit + PR #76) |
|--|--|--|
| `ERROR` count | 10 (`security_definer_view`) | **0** ✅ |
| `anon_security_definer_function_executable` | 69 | **0** ✅ |
| `rls_policy_always_true` (chat tables) | 2 | **0** ✅ |
| `function_search_path_mutable` | 6 | **0** ✅ |
| `auth_leaked_password_protection` | 1 | 1 (Pro plan paywall — unchanged) |
| `authenticated_security_definer_function_executable` | 68 | 68 (by-design — every SECURITY DEFINER RPC granted to `authenticated` triggers it) |

## When to re-read these files

1. **Before another security pass.** Use the shortlist's Tier 2 list (admin
   task / assignment workflow RPCs) as the next audit target if you go
   deeper than Tier 1.
2. **When debugging a permissions bug.** If a regression appears in
   leads / clients / bookings / sessions and smells like RLS, the migrations
   referenced in the shortlist are the most likely point of regression.
3. **NEVER as a prescription to "reduce the warning count."** Per the
   shortlist's explicit "What Not To Do" section: do not blindly revoke
   `EXECUTE` from `authenticated` SECURITY DEFINER functions. The remaining
   warnings are intentional architecture, not unfixed defects.

## Related repo files

- `supabase/migrations/20260501090000_harden_security_surface.sql` — Codex's
  bulk REVOKE / GRANT / search_path / `security_invoker` sweep
- `supabase/migrations/20260501093000_lock_remaining_intern_views.sql` —
  follow-up cleanup on 6 intern_* compat views
- `supabase/migrations/20260501103000_fix_function_search_path_warnings.sql`
  — closed the 6 `function_search_path_mutable` warnings
- `supabase/migrations/20260501000000_chat_rls_tighten.sql` — chat surface
  hardening (PR #74; closed 2 `rls_policy_always_true` warnings)
- `supabase/migrations/20260501110000_team_scope_admin_writes.sql` —
  Tier 1 audit follow-up (PR #76; team-scoped 3 admin write/delete RPCs)
- `vercel.json` — browser security headers (CSP, frame-deny, nosniff,
  referrer-policy, permissions-policy)
