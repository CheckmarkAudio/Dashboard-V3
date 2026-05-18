-- Phase 1 of the Flywheel event ledger revamp.
--
-- Adds a single append-only events table that captures every action
-- in the studio that maps to one of the 5 flywheel stages
-- (Deliver → Capture → Share → Attract → Book). The existing
-- `member_kpis` / `member_kpi_entries` tables stay in place — they
-- track manually-defined goals + readings, separate concern from
-- "what actually happened today."
--
-- Decisions baked in:
--   - One row per event. No upserts, no deletes from app code (RLS
--     denies UPDATE/DELETE except for the team's owners — see
--     policies below).
--   - `stage` is a 5-value CHECK constraint, not an enum, so future
--     stage additions/removals are a CHECK rewrite rather than an
--     enum migration (Postgres makes enums painful).
--   - `source_type` is a free-text discriminator (`task`, `session`,
--     `client`, `media_upload`) so we can add new event sources
--     without DDL.
--   - `source_id` nullable so deleting the source row doesn't
--     orphan/CASCADE the historical event. The KPI snapshot is
--     immutable history.
--   - `member_id` nullable for system events (none today, but
--     reserves the option).
--   - `metadata` is jsonb so any source can attach context for later
--     drill-down without schema change (e.g. session_type, room,
--     client_id).
--
-- Stage → source mapping that Phase 1 client code will emit:
--   - **Deliver**:  source_type=task,           when a task transitions to is_completed
--   - **Book**:     source_type=session,        when a non-consult session is created with status confirmed
--   - **Capture**:  source_type=session,        same event as Book BUT only when this is the client's FIRST paid session
--   - **Attract**:  source_type=client,         when a client row is created
--   - **Share**:    source_type=media_upload,   when an AddMedia upload completes successfully
--
-- Phase 2 will add aggregation RPCs + swap BusinessHealth's stub
-- arrays + the AdminFlywheelWidget data source over to this table.

-- ─── Table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flywheel_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stage text NOT NULL CHECK (stage IN ('deliver', 'capture', 'share', 'attract', 'book')),
  source_type text NOT NULL,
  source_id uuid,
  member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  team_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the two read patterns Phase 2 will use:
--   (team_id, stage, occurred_at)  for "events for my team, stage X, date range Y"
--   (team_id, member_id, occurred_at)  for "per-member breakdown"
CREATE INDEX IF NOT EXISTS flywheel_events_team_stage_occurred_idx
  ON flywheel_events (team_id, stage, occurred_at DESC);
CREATE INDEX IF NOT EXISTS flywheel_events_team_member_occurred_idx
  ON flywheel_events (team_id, member_id, occurred_at DESC);

COMMENT ON TABLE flywheel_events IS
  'Append-only ledger of every studio action mapped to a flywheel stage. Powers the BusinessHealth dashboards + AdminFlywheelWidget (Phase 2). Insert ONLY via record_flywheel_event() RPC.';

-- ─── RLS ──────────────────────────────────────────────────────────

ALTER TABLE flywheel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flywheel_events_select" ON flywheel_events;
DROP POLICY IF EXISTS "flywheel_events_insert" ON flywheel_events;
DROP POLICY IF EXISTS "flywheel_events_update" ON flywheel_events;
DROP POLICY IF EXISTS "flywheel_events_delete" ON flywheel_events;

-- Members see their own team's events (drives BusinessHealth +
-- widgets). Cross-team isolation enforced.
CREATE POLICY "flywheel_events_select" ON flywheel_events
  FOR SELECT TO authenticated USING (team_id = get_my_team_id());

-- App code never INSERTs directly — must go through the RPC below
-- (which resolves team_id and validates the stage). No INSERT
-- policy = no direct INSERT from authenticated clients.

-- Events are immutable history. UPDATE / DELETE not permitted from
-- the app (no policies = denied). If a row truly needs deleting it
-- has to be done at the SQL level by an operator.

-- ─── RPC: record_flywheel_event ──────────────────────────────────
--
-- The single insert path for the table. SECURITY DEFINER so it can
-- INSERT despite the table having no INSERT policy. Validates stage
-- + auto-resolves team_id from the caller. Returns the new event id.

CREATE OR REPLACE FUNCTION record_flywheel_event(
  p_stage         text,
  p_source_type   text,
  p_source_id     uuid    DEFAULT NULL,
  p_member_id     uuid    DEFAULT NULL,
  p_metadata      jsonb   DEFAULT '{}'::jsonb,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_team_id  uuid;
  v_member   uuid;
BEGIN
  -- Defensive validation (the CHECK constraint also enforces this,
  -- but we want a clearer error message for the client).
  IF p_stage NOT IN ('deliver', 'capture', 'share', 'attract', 'book') THEN
    RAISE EXCEPTION 'Invalid flywheel stage: %', p_stage
      USING ERRCODE = 'check_violation';
  END IF;

  -- source_type must be non-empty so analytics queries can group on
  -- it without hitting a NULL.
  IF p_source_type IS NULL OR length(p_source_type) = 0 THEN
    RAISE EXCEPTION 'source_type is required';
  END IF;

  v_member  := COALESCE(p_member_id, auth.uid());
  v_team_id := get_my_team_id();

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Cannot record flywheel event without a team context';
  END IF;

  INSERT INTO flywheel_events
    (stage, source_type, source_id, member_id, team_id, metadata, occurred_at)
  VALUES
    (p_stage, p_source_type, p_source_id, v_member, v_team_id, COALESCE(p_metadata, '{}'::jsonb), p_occurred_at)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_flywheel_event(text, text, uuid, uuid, jsonb, timestamptz) TO authenticated;

COMMENT ON FUNCTION record_flywheel_event IS
  'Insert a row into flywheel_events. The ONLY supported insert path (the table has no INSERT policy). Validates stage + auto-resolves team_id from auth.uid(). Returns the new event id.';
