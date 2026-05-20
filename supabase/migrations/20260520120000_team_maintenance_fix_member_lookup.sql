-- 2026-05-20 — Fix `column "auth_user_id" does not exist` in the
-- team_maintenance RPCs.
--
-- The original migration (20260519200000_team_checklist.sql) looked
-- up the calling team_members row via `auth_user_id = auth.uid()` —
-- but this schema doesn't HAVE an auth_user_id column on
-- team_members. `team_members.id` IS the auth.users.id directly,
-- so the lookup just needs to match `id = auth.uid()`.
--
-- Applied to prod via MCP first (admins were blocked from adding
-- checklist items); this file captures the change in the migration
-- history so a fresh deploy / DB reset gets the same RPC bodies.

CREATE OR REPLACE FUNCTION public.team_maintenance_toggle(
  p_item_id uuid,
  p_check   boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team    uuid := public.get_my_team_id();
  v_user    uuid := auth.uid();
  v_member  uuid;
  v_item    public.team_maintenance_items%ROWTYPE;
  v_period  text;
  v_check   public.team_maintenance_completions%ROWTYPE;
BEGIN
  IF v_team IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- team_members.id is the auth.users.id directly on this schema.
  SELECT id INTO v_member
    FROM public.team_members
   WHERE id = v_user AND team_id = v_team
   LIMIT 1;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'caller not a team member' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
    FROM public.team_maintenance_items
   WHERE id = p_item_id AND team_id = v_team AND is_archived = false;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'maintenance item not found' USING ERRCODE = 'P0002';
  END IF;

  v_period := public.team_maintenance_period_key(v_item.cadence, now());

  IF p_check THEN
    INSERT INTO public.team_maintenance_completions (
      item_id, team_id, period_key, checked_by
    ) VALUES (
      v_item.id, v_team, v_period, v_member
    )
    ON CONFLICT (item_id, period_key) DO UPDATE
      SET checked_by = EXCLUDED.checked_by,
          checked_at = now()
    RETURNING * INTO v_check;
    RETURN jsonb_build_object(
      'item_id', v_item.id,
      'period_key', v_period,
      'checked', true,
      'checked_at', v_check.checked_at,
      'checked_by', v_member
    );
  ELSE
    DELETE FROM public.team_maintenance_completions
     WHERE item_id = v_item.id AND period_key = v_period;
    RETURN jsonb_build_object(
      'item_id', v_item.id,
      'period_key', v_period,
      'checked', false
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_team_maintenance_create(
  p_title       text,
  p_cadence     text,
  p_description text DEFAULT NULL,
  p_sort_order  int  DEFAULT 0
)
RETURNS public.team_maintenance_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team    uuid := public.get_my_team_id();
  v_user    uuid := auth.uid();
  v_member  uuid;
  v_row     public.team_maintenance_items;
BEGIN
  IF v_user IS NULL OR NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_cadence NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'cadence must be daily, weekly, or monthly' USING ERRCODE = '22023';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;

  -- team_members.id is the auth.users.id directly on this schema.
  SELECT id INTO v_member
    FROM public.team_members
   WHERE id = v_user AND team_id = v_team
   LIMIT 1;

  INSERT INTO public.team_maintenance_items (
    team_id, title, description, cadence, sort_order, created_by
  ) VALUES (
    v_team, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_cadence, coalesce(p_sort_order, 0), v_member
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
