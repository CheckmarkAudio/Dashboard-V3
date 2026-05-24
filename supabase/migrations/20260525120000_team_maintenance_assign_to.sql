-- Checklist revamp — rename claim_type 'everyone' → 'all_members'
-- and add 'individual' mode (one specific assignee). Per user:
-- "Assigned to: anyone | individual | all_members".
--
-- Net data change is small (just a value rename + a new column);
-- behavior change is bigger and lives in the RPCs + UI.

-- ─── 1. Drop old CHECK constraint so we can re-key the enum ─────────
ALTER TABLE public.team_maintenance_items
  DROP CONSTRAINT IF EXISTS team_maintenance_items_claim_type_check;

-- ─── 2. Rename existing 'everyone' rows → 'all_members' ────────────
UPDATE public.team_maintenance_items
   SET claim_type = 'all_members'
 WHERE claim_type = 'everyone';

-- ─── 3. Add assigned_to (required when claim_type='individual') ────
ALTER TABLE public.team_maintenance_items
  ADD COLUMN IF NOT EXISTS assigned_to uuid NULL
    REFERENCES public.team_members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_maintenance_items.assigned_to IS
  'When claim_type=individual, the single team member responsible for this item. NULL otherwise. ON DELETE SET NULL so removing a member doesn''t cascade-kill their assigned checklist items (they go orphan and admin can reassign).';

-- ─── 4. Re-add CHECK with the new value set ────────────────────────
ALTER TABLE public.team_maintenance_items
  ADD CONSTRAINT team_maintenance_items_claim_type_check
    CHECK (claim_type IN ('anyone', 'all_members', 'individual'));

-- 'individual' MUST carry an assignee (caught at write time, not at
-- read time, so a stale 'individual' item with NULL assignee can
-- never enter the table). If a member is deleted, ON DELETE SET NULL
-- nulls assigned_to and this constraint would flag the row — so we
-- pair this with a small admin-recovery affordance in the UI to
-- prompt re-assignment.
ALTER TABLE public.team_maintenance_items
  ADD CONSTRAINT team_maintenance_items_individual_has_assignee
    CHECK ((claim_type <> 'individual') OR (assigned_to IS NOT NULL));

COMMENT ON COLUMN public.team_maintenance_items.claim_type IS
  'anyone (legacy default — first to check wins) | all_members (each member individually checks) | individual (one specific assignee only, paired with assigned_to)';

-- ─── 5. List RPC — return assigned_to + assigned_to_name ───────────
DROP FUNCTION IF EXISTS public.team_maintenance_list();
CREATE OR REPLACE FUNCTION public.team_maintenance_list()
RETURNS TABLE (
  id                 uuid,
  title              text,
  description        text,
  cadence            text,
  claim_type         text,
  assigned_to        uuid,
  assigned_to_name   text,
  sort_order         int,
  created_at         timestamptz,
  period_key         text,
  completions        jsonb
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
      i.assigned_to,
      atm.display_name AS assigned_to_name,
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
    LEFT JOIN public.team_members atm ON atm.id = i.assigned_to
    WHERE i.team_id = v_team
      AND i.is_archived = false
    ORDER BY
      CASE i.cadence WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 WHEN 'monthly' THEN 2 ELSE 3 END,
      i.sort_order,
      i.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_maintenance_list() TO authenticated;

-- ─── 6. Toggle RPC — branch on three claim_types ───────────────────
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

  -- Individual mode: only the assignee can toggle (admin can too,
  -- but the natural workflow is the assignee themselves).
  IF v_item.claim_type = 'individual'
     AND v_item.assigned_to IS DISTINCT FROM v_member
     AND NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'only the assignee can check this item' USING ERRCODE = '42501';
  END IF;

  v_period := public.team_maintenance_period_key(v_item.cadence, now());

  IF p_check THEN
    IF v_item.claim_type = 'anyone' THEN
      -- "First to claim wins" — clear any existing claim, then insert.
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id AND period_key = v_period;
    ELSIF v_item.claim_type = 'individual' THEN
      -- Individual mode persists the check as the ASSIGNEE's row
      -- (so the bookkeeping is "is the assignee done?", not "did
      -- the admin click on the assignee's behalf"). Admins ticking
      -- on behalf still records the assignee as the checker.
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id AND period_key = v_period;
    END IF;

    INSERT INTO public.team_maintenance_completions (
      item_id, team_id, period_key, checked_by
    ) VALUES (
      v_item.id,
      v_team,
      v_period,
      CASE
        WHEN v_item.claim_type = 'individual' THEN v_item.assigned_to
        ELSE v_member
      END
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
      'checked_by', v_check.checked_by
    );
  ELSE
    -- Uncheck: delete the relevant row.
    --   anyone      → delete any completion for this period
    --   all_members → delete caller's own
    --   individual  → delete the assignee's (whether caller is
    --                 assignee or an admin acting on their behalf)
    IF v_item.claim_type = 'individual' THEN
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id
         AND period_key = v_period
         AND checked_by = v_item.assigned_to;
    ELSIF v_item.claim_type = 'anyone' THEN
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id
         AND period_key = v_period;
    ELSE
      DELETE FROM public.team_maintenance_completions
       WHERE item_id = v_item.id
         AND period_key = v_period
         AND checked_by = v_member;
    END IF;
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

-- ─── 7. Admin create/update RPCs accept assigned_to ────────────────
CREATE OR REPLACE FUNCTION public.admin_team_maintenance_create(
  p_title       text,
  p_cadence     text,
  p_description text DEFAULT NULL,
  p_sort_order  int  DEFAULT 0,
  p_claim_type  text DEFAULT 'anyone',
  p_assigned_to uuid DEFAULT NULL
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
  IF p_claim_type NOT IN ('anyone', 'all_members', 'individual') THEN
    RAISE EXCEPTION 'claim_type must be anyone, all_members, or individual' USING ERRCODE = '22023';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;
  IF p_claim_type = 'individual' AND p_assigned_to IS NULL THEN
    RAISE EXCEPTION 'individual items require an assignee' USING ERRCODE = '22023';
  END IF;
  IF p_claim_type <> 'individual' AND p_assigned_to IS NOT NULL THEN
    -- Drop spurious assignee on non-individual modes — keeps the
    -- table clean + the row meaningful.
    p_assigned_to := NULL;
  END IF;

  SELECT id INTO v_member
    FROM public.team_members
   WHERE id = v_user AND team_id = v_team
   LIMIT 1;

  -- Sanity-check assignee belongs to the same team.
  IF p_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members WHERE id = p_assigned_to AND team_id = v_team
    ) THEN
      RAISE EXCEPTION 'assignee not in team' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.team_maintenance_items (
    team_id, title, description, cadence, sort_order, created_by, claim_type, assigned_to
  ) VALUES (
    v_team,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_cadence,
    coalesce(p_sort_order, 0),
    v_member,
    p_claim_type,
    p_assigned_to
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_create(text, text, text, int, text, uuid) TO authenticated;

-- Drop old signature so callers can't silently bind to it.
DROP FUNCTION IF EXISTS public.admin_team_maintenance_create(text, text, text, int, text);

CREATE OR REPLACE FUNCTION public.admin_team_maintenance_update(
  p_item_id           uuid,
  p_title             text DEFAULT NULL,
  p_cadence           text DEFAULT NULL,
  p_description       text DEFAULT NULL,
  p_clear_description boolean DEFAULT false,
  p_sort_order        int  DEFAULT NULL,
  p_claim_type        text DEFAULT NULL,
  p_assigned_to       uuid DEFAULT NULL,
  p_clear_assigned_to boolean DEFAULT false
)
RETURNS public.team_maintenance_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid := public.get_my_team_id();
  v_row  public.team_maintenance_items;
  v_next_claim_type text;
  v_next_assigned_to uuid;
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_cadence IS NOT NULL AND p_cadence NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'cadence must be daily, weekly, or monthly' USING ERRCODE = '22023';
  END IF;
  IF p_claim_type IS NOT NULL AND p_claim_type NOT IN ('anyone', 'all_members', 'individual') THEN
    RAISE EXCEPTION 'claim_type must be anyone, all_members, or individual' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.team_maintenance_items
   WHERE id = p_item_id AND team_id = v_team;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'maintenance item not found' USING ERRCODE = 'P0002';
  END IF;

  v_next_claim_type := COALESCE(p_claim_type, v_row.claim_type);
  -- assigned_to resolution: explicit clear wins; explicit value wins;
  -- else preserve. Then enforce individual-requires-assignee.
  IF p_clear_assigned_to THEN
    v_next_assigned_to := NULL;
  ELSIF p_assigned_to IS NOT NULL THEN
    v_next_assigned_to := p_assigned_to;
  ELSE
    v_next_assigned_to := v_row.assigned_to;
  END IF;

  IF v_next_claim_type <> 'individual' THEN
    v_next_assigned_to := NULL; -- non-individual modes carry no assignee
  ELSE
    IF v_next_assigned_to IS NULL THEN
      RAISE EXCEPTION 'individual items require an assignee' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members WHERE id = v_next_assigned_to AND team_id = v_team
    ) THEN
      RAISE EXCEPTION 'assignee not in team' USING ERRCODE = '22023';
    END IF;
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
         claim_type  = v_next_claim_type,
         assigned_to = v_next_assigned_to,
         updated_at  = now()
   WHERE id = p_item_id AND team_id = v_team
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_team_maintenance_update(uuid, text, text, text, boolean, int, text, uuid, boolean) TO authenticated;

-- Drop the prior 7-arg signature.
DROP FUNCTION IF EXISTS public.admin_team_maintenance_update(uuid, text, text, text, boolean, int, text);
