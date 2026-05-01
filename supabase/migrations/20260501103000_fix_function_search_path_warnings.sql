-- Follow-up hardening for the 6 remaining Supabase advisor warnings
-- in the `function_search_path_mutable` category as exported on
-- 2026-05-01.
--
-- Important: some of these functions appear to exist in production but
-- are not fully captured in the tracked migrations (schema drift). To
-- avoid replay failures on fresh environments, this migration is
-- defensive: it only alters functions that actually exist.

DO $$
DECLARE
  v_proc regprocedure;
BEGIN
  -- Trigger helper
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_team_id_on_insert'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_proc);
  END LOOP;

  -- Drifted helper seen in generated DB types / advisor export
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'intern_get_user_role'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_proc);
  END LOOP;

  -- Trigger helper
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'task_requests_set_updated_at'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_proc);
  END LOOP;

  -- Checklist / approvals RPCs
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'intern_generate_checklist',
        'publish_daily_checklist',
        'approve_task_edit_request'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_proc);
  END LOOP;
END;
$$;
