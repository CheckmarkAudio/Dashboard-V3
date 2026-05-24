-- Per-person checklist items — claim_type column + completion model
-- extension. Today every maintenance item is "anyone can claim" —
-- whoever checks it first marks it done for the team. PR B adds an
-- "everyone must do" mode where each team member has their own
-- check state (e.g. "Drop your media to Dropbox" — every member
-- owes this, not just one).
--
-- Model decisions:
--   * claim_type = 'anyone'   (default) → ONE completion per period.
--                                          Current behavior.
--   * claim_type = 'everyone'           → ONE completion per period
--                                          per member. Each member
--                                          can only toggle their own.
--
-- The two flavors coexist in the same items table. The completions
-- table's old UNIQUE (item_id, period_key) is too strict for the
-- everyone case — replaced with UNIQUE (item_id, period_key,
-- checked_by) which works for both: anyone items still effectively
-- have one row per period (toggle RPC enforces single-claim
-- semantics by replacing any existing completion before insert).

-- ─── 1. Add claim_type column ──────────────────────────────────────
ALTER TABLE public.team_maintenance_items
  ADD COLUMN IF NOT EXISTS claim_type text NOT NULL DEFAULT 'anyone'
    CHECK (claim_type IN ('anyone', 'everyone'));

COMMENT ON COLUMN public.team_maintenance_items.claim_type IS
  'anyone = one completion per period (first to check wins) · everyone = one completion per period per member (each member checks their own avatar)';

-- ─── 2. Replace UNIQUE constraint on completions ───────────────────
-- Drop the old (item_id, period_key) uniqueness and replace with
-- (item_id, period_key, checked_by). For anyone items the toggle RPC
-- enforces single-claim via DELETE-then-INSERT so the effective shape
-- is still one row per period. For everyone items the new constraint
-- prevents a member from double-checking the same item in the same
-- period.
ALTER TABLE public.team_maintenance_completions
  DROP CONSTRAINT IF EXISTS team_maintenance_completions_item_id_period_key_key;

ALTER TABLE public.team_maintenance_completions
  ADD CONSTRAINT team_maintenance_completions_unique_member_period
    UNIQUE (item_id, period_key, checked_by);

-- ─── 3. List RPC — return all completions for the current period ───
-- Replaces the prior LEFT JOIN that returned at most one completion.
-- Now returns a JSONB array so the UI can render either:
--   * anyone items → completions[0]?.checked_by_name → "by Sara · 2m ago"
--   * everyone items → for each active team member, "checked" if their
--                       id is in completions, "pending" otherwise
DROP FUNCTION IF EXISTS public.team_maintenance_list();
CREATE OR REPLACE FUNCTION public.team_maintenance_list()
RETURNS TABLE (
  id              uuid,
  title           text,
  description     text,
  cadence         text,
  claim_type      text,
  sort_order      int,
  created_at      timestamptz,
  period_key      text,
  completions     jsonb
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
      i.claim_type,
      i.sort_order,
      i.created_at,
      public.team_maintenance_period_key(i.cadence, now()) AS period_key,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'checked_by',      c.checked_by,
              'checked_by_name', tm.display_name,
              'checked_at',      c.checked_at
            )
            ORDER BY c.checked_at
          )
          FROM public.team_maintenance_completions c
          LEFT JOIN public.team_members tm ON tm.id = c.checked_by
          WHERE c.item_id = i.id
            AND c.period_key = public.team_maintenance_period_key(i.cadence, now())
        ),
        '[]'::jsonb
      ) AS completions
    FROM public.team_maintenance_items i
    WHERE i.team_id = v_team
      AND i.is_archived = false
    ORDER BY
      CASE i.cadence WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 WHEN 'monthly' THEN 2 ELSE 3 END,
      i.sort_order,
      i.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_maintenance_list() TO authenticated;

-- ─── 4. Toggle RPC — handle both claim modes ───────────────────────
-- Anyone mode: clearing the row + re-inserting on check is the
-- safest way to express "this period now belongs to caller" without
-- relying on the old single-row uniqueness.
-- Everyone mode: just insert (or delete) the caller's own row.
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
    IF v_item.claim_type = 'anyone' THEN
      -- "First to claim wins" model — clear any existing completion
      -- for this period, then insert caller's. Net effect: caller
      -- now owns the period.
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id AND period_key = v_period;
    END IF;
    -- For both modes: insert caller's row. ON CONFLICT
    -- (item_id, period_key, checked_by) handles the case where the
    -- caller is re-checking their own already-checked item.
    INSERT INTO public.team_maintenance_completions (
      item_id, team_id, period_key, checked_by
    ) VALUES (
      v_item.id, v_team, v_period, v_member
    )
    ON CONFLICT (item_id, period_key, checked_by) DO UPDATE
      SET checked_at = now()
    RETURNING * INTO v_check;
    RETURN jsonb_build_object(
      'item_id', v_item.id,
      'period_key', v_period,
      'claim_type', v_item.claim_type,
      'checked', true,
      'checked_at', v_check.checked_at,
      'checked_by', v_member
    );
  ELSE
    -- Uncheck: delete caller's row for this period (anyone or
    -- everyone — uncheck only removes YOUR claim).
    DELETE FROM public.team_maintenance_completions
     WHERE item_id = v_item.id
       AND period_key = v_period
       AND checked_by = v_member;
    RETURN jsonb_build_object(
      'item_id', v_item.id,
      'period_key', v_period,
      'claim_type', v_item.claim_type,
      'checked', false
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_maintenance_toggle(uuid, boolean) TO authenticated;

-- ─── 5. Admin create + update RPCs accept claim_type ───────────────
CREATE OR REPLACE FUNCTION public.admin_team_maintenance_create(
  p_title       text,
  p_cadence     text,
  p_description text DEFAULT NULL,
  p_sort_order  int  DEFAULT 0,
  p_claim_type  text DEFAULT 'anyone'
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
  IF p_claim_type NOT IN ('anyone', 'everyone') THEN
    RAISE EXCEPTION 'claim_type must be anyone or everyone' USING ERRCODE = '22023';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_member
    FROM public.team_members
   WHERE id = v_user AND team_id = v_team
   LIMIT 1;

  INSERT INTO public.team_maintenance_items (
    team_id, title, description, cadence, sort_order, created_by, claim_type
  ) VALUES (
    v_team,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_cadence,
    coalesce(p_sort_order, 0),
    v_member,
    p_claim_type
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_create(text, text, text, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_team_maintenance_update(
  p_item_id          uuid,
  p_title            text DEFAULT NULL,
  p_cadence          text DEFAULT NULL,
  p_description      text DEFAULT NULL,
  p_clear_description boolean DEFAULT false,
  p_sort_order       int  DEFAULT NULL,
  p_claim_type       text DEFAULT NULL
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
  IF p_claim_type IS NOT NULL AND p_claim_type NOT IN ('anyone', 'everyone') THEN
    RAISE EXCEPTION 'claim_type must be anyone or everyone' USING ERRCODE = '22023';
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
         claim_type  = COALESCE(p_claim_type, claim_type),
         updated_at  = now()
   WHERE id = p_item_id AND team_id = v_team
   RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'maintenance item not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_update(uuid, text, text, text, boolean, int, text) TO authenticated;
