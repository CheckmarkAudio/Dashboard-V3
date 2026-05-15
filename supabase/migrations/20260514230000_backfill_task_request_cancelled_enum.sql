-- Backfill: ensure `task_request_cancelled` is in the
-- `assignment_notification_type` enum on prod.
--
-- Why this exists: PR #98's migration
-- `20260503020000_task_request_cancel_and_status_cancelled.sql`
-- contained the ALTER TYPE ADD VALUE for `task_request_cancelled`
-- and was marked MCP-applied at the time. But the prod enum
-- (verified 2026-05-14) was missing the value — almost certainly
-- because Postgres can't ADD an enum value and use it in the SAME
-- transaction, and the original migration tried both. The CHECK
-- constraint + RPC body landed; the enum value silently did not.
--
-- This migration is isolated (single statement) so the ADD VALUE
-- commits cleanly. Idempotent via IF NOT EXISTS so re-running on
-- environments where it's already there is a no-op.
--
-- MCP-APPLIED: 2026-05-14 to ncljfjdcyswoeitsooty as
-- migration `add_task_request_cancelled_enum_value`.
-- ADVISOR-VERIFIED: not re-run (single ALTER TYPE, no new RPC surface).

ALTER TYPE public.assignment_notification_type
  ADD VALUE IF NOT EXISTS 'task_request_cancelled';
