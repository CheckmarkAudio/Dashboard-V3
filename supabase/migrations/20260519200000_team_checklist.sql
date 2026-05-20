-- 2026-05-19 — Team Maintenance Checklist widget.
--
-- New collaborative maintenance-check surface on the Tasks page (/daily).
-- Distinct from `assigned_tasks` semantically:
--   * Tasks  = "do this work"; completion is a one-shot achievement
--   * Checks = "verify this is still in good shape"; an item resets
--               on each calendar boundary (daily / weekly / monthly)
--
-- User direction (with cables-organized example):
--   "if the cables are already organized, we don't need it as a task,
--    but rather a maintenance check that they are each day. Visible
--    to the team for everyone to partake in ensuring the checklist
--    gets looked at"
--
-- Naming: the `team_checklist_*` namespace is already taken by a
-- legacy daily-checklist materializer (team_checklist_templates +
-- team_checklist_instances + team_checklist_items). To avoid a
-- collision the new feature lives under `team_maintenance_*`. UI
-- still calls it "Checklist" per the user's wording — the table
-- prefix is an internal naming choice.
--
-- Model decisions:
--   * Admins-only can add items (curated maintenance list, not member
--     scratch pad). User answered "Admins only" in the planning
--     question. Members + admins can both check/uncheck within the
--     current period.
--   * Calendar-boundary reset (not rolling 24h). Daily resets at
--     start-of-day Denver. Weekly resets Monday. Monthly resets 1st.
--     User answered "On the calendar boundary" in the planning
--     question. No cron needed — the period key is computed
--     per-fetch from now() so "is this checked for the current
--     period?" is always a fresh question against the same row.

-- ─── 1. team_maintenance_items ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_maintenance_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  cadence       text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  sort_order    int  NOT NULL DEFAULT 0,
  is_archived   boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_maintenance_items_team_active
  ON public.team_maintenance_items (team_id, cadence, sort_order)
  WHERE is_archived = false;

COMMENT ON TABLE public.team_maintenance_items IS
  'Curated maintenance checklist per team. Admins add/edit/archive; everyone checks (see team_maintenance_completions). Resets calendar-bound per cadence.';

-- ─── 2. team_maintenance_completions ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_maintenance_completions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES public.team_maintenance_items(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  period_key  text NOT NULL,
  checked_by  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_team_maintenance_completions_item
  ON public.team_maintenance_completions (item_id, period_key DESC);

CREATE INDEX IF NOT EXISTS idx_team_maintenance_completions_team_recent
  ON public.team_maintenance_completions (team_id, checked_at DESC);

COMMENT ON TABLE public.team_maintenance_completions IS
  'Append-only log of who-verified-what-when. UNIQUE(item_id, period_key) means re-checking the same item in the same period is idempotent. To uncheck, DELETE the row for the current period_key.';

-- ─── 3. period_key helper ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.team_maintenance_period_key(
  p_cadence text,
  p_at      timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local timestamp := (p_at AT TIME ZONE 'America/Denver');
BEGIN
  RETURN CASE p_cadence
    WHEN 'daily'   THEN to_char(v_local, 'YYYY-MM-DD')
    WHEN 'weekly'  THEN to_char(v_local, 'IYYY-"W"IW')
    WHEN 'monthly' THEN to_char(v_local, 'YYYY-MM')
    ELSE NULL
  END;
END;
$$;

-- ─── 4. RLS ────────────────────────────────────────────────────────

ALTER TABLE public.team_maintenance_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_maintenance_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_maintenance_items_select ON public.team_maintenance_items
  FOR SELECT USING (team_id = public.get_my_team_id());

CREATE POLICY team_maintenance_completions_select ON public.team_maintenance_completions
  FOR SELECT USING (team_id = public.get_my_team_id());

CREATE POLICY team_maintenance_items_admin_write ON public.team_maintenance_items
  FOR ALL
  USING (team_id = public.get_my_team_id() AND public.is_team_admin())
  WITH CHECK (team_id = public.get_my_team_id() AND public.is_team_admin());

CREATE POLICY team_maintenance_completions_member_insert ON public.team_maintenance_completions
  FOR INSERT
  WITH CHECK (team_id = public.get_my_team_id());

CREATE POLICY team_maintenance_completions_member_delete ON public.team_maintenance_completions
  FOR DELETE
  USING (team_id = public.get_my_team_id());

-- ─── 5. RPCs ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.team_maintenance_list()
RETURNS TABLE (
  id              uuid,
  title           text,
  description     text,
  cadence         text,
  sort_order      int,
  created_at      timestamptz,
  period_key      text,
  checked_at      timestamptz,
  checked_by      uuid,
  checked_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
BEGIN
  IF v_team IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      i.id,
      i.title,
      i.description,
      i.cadence,
      i.sort_order,
      i.created_at,
      public.team_maintenance_period_key(i.cadence, now()) AS period_key,
      c.checked_at,
      c.checked_by,
      tm.display_name AS checked_by_name
    FROM public.team_maintenance_items i
    LEFT JOIN public.team_maintenance_completions c
      ON c.item_id = i.id
     AND c.period_key = public.team_maintenance_period_key(i.cadence, now())
    LEFT JOIN public.team_members tm
      ON tm.id = c.checked_by
    WHERE i.team_id = v_team
      AND i.is_archived = false
    ORDER BY
      CASE i.cadence WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 WHEN 'monthly' THEN 2 ELSE 3 END,
      i.sort_order,
      i.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_maintenance_list() TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.team_maintenance_toggle(uuid, boolean) TO authenticated;

-- ─── 6. Admin CRUD RPCs ────────────────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_create(text, text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_team_maintenance_update(
  p_item_id     uuid,
  p_title       text DEFAULT NULL,
  p_cadence     text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_clear_description boolean DEFAULT false,
  p_sort_order  int  DEFAULT NULL
)
RETURNS public.team_maintenance_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
  v_row  public.team_maintenance_items;
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_cadence IS NOT NULL AND p_cadence NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'cadence must be daily, weekly, or monthly' USING ERRCODE = '22023';
  END IF;

  UPDATE public.team_maintenance_items
     SET title       = COALESCE(NULLIF(trim(coalesce(p_title, '')), ''), title),
         cadence     = COALESCE(p_cadence, cadence),
         description = CASE
                         WHEN p_clear_description THEN NULL
                         WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '')
                         ELSE description
                       END,
         sort_order  = COALESCE(p_sort_order, sort_order),
         updated_at  = now()
   WHERE id = p_item_id AND team_id = v_team
   RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'maintenance item not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_update(uuid, text, text, text, boolean, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_team_maintenance_archive(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_maintenance_items
     SET is_archived = true,
         updated_at  = now()
   WHERE id = p_item_id AND team_id = v_team;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_archive(uuid) TO authenticated;

-- ─── 7. Realtime publication ───────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_maintenance_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_maintenance_completions;
