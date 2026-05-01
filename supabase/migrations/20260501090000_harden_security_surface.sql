-- Security hardening pass for Dashboard-V3 / Checkmark Intern Manager.
--
-- Goals:
--   1. Lock foundational helper functions to an explicit search_path.
--   2. Revoke accidental PUBLIC / anon execution on SECURITY DEFINER RPCs.
--   3. Re-grant only the authenticated RPC surface the app actually uses.
--   4. Convert any known public SECURITY DEFINER views to SECURITY INVOKER
--      when they exist in production, while preserving authenticated reads.
--
-- This migration is intentionally defensive because production appears to
-- contain some schema drift versus the tracked migrations.

-- ─── Foundation helpers: recreate with locked search_path ─────────────

CREATE OR REPLACE FUNCTION public.get_my_team_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT iu.team_id FROM public.intern_users AS iu WHERE iu.id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.intern_users AS iu
    WHERE iu.id = auth.uid() AND iu.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_direct_reports(manager uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT iu.id
  FROM public.intern_users AS iu
  WHERE iu.managed_by = manager
$$;

-- ─── Revoke broad execution from SECURITY DEFINER functions ───────────

DO $$
DECLARE
  v_proc regprocedure;
BEGIN
  FOR v_proc IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_proc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_proc);
  END LOOP;
END;
$$;

-- Trigger / cron / internal-only helpers should never be callable from
-- the browser role, even if they live in public.
DO $$
DECLARE
  v_name text;
  v_proc regprocedure;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'set_team_id_on_insert',
    'task_requests_set_updated_at',
    'clients_set_updated_at',
    'time_clock_entries_set_updated_at',
    'cron_materialize_checklists'
  ]
  LOOP
    FOR v_proc IN
      SELECT p.oid::regprocedure
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_proc);
    END LOOP;
  END LOOP;
END;
$$;

-- ─── Explicitly grant the authenticated app RPC surface ───────────────

DO $$
DECLARE
  v_name text;
  v_proc regprocedure;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'get_my_team_id',
    'is_team_admin',
    'get_direct_reports',
    'intern_generate_checklist',
    'publish_daily_checklist',
    'approve_task_edit_request',
    'assign_session',
    'get_assignment_notifications',
    'assign_custom_task_to_members',
    'assign_custom_tasks_to_members',
    'complete_assigned_task',
    'submit_task_request',
    'get_pending_task_requests',
    'get_my_task_requests',
    'approve_task_request',
    'reject_task_request',
    'get_member_assigned_tasks',
    'get_team_assigned_tasks',
    'get_studio_assigned_tasks',
    'request_task_reassignment',
    'approve_task_reassignment',
    'decline_task_reassignment',
    'get_my_incoming_reassign_requests',
    'admin_list_all_assigned_tasks',
    'admin_update_assigned_task',
    'admin_list_all_sessions',
    'admin_update_session',
    'admin_delete_session',
    'admin_recent_assignments',
    'admin_recent_approvals',
    'mark_all_channels_read',
    'mark_all_assignment_notifications_read',
    'get_channel_notifications',
    'mark_channel_read',
    'member_overview_snapshot',
    'get_task_template_library',
    'get_task_template_detail',
    'create_task_template',
    'update_task_template',
    'delete_task_template',
    'duplicate_task_template',
    'add_task_template_item',
    'update_task_template_item',
    'delete_task_template_item',
    'assign_template_preview',
    'assign_template_to_members',
    'assign_template_items_to_members',
    'cancel_task_assignment_batch',
    'owner_set_member_role',
    'owner_reset_member_password',
    'clock_in',
    'clock_out',
    'get_my_open_clock_entry',
    'admin_currently_clocked_in',
    'create_client',
    'update_client',
    'archive_client',
    'get_clients',
    'search_clients'
  ]
  LOOP
    FOR v_proc IN
      SELECT p.oid::regprocedure
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_proc);
    END LOOP;
  END LOOP;
END;
$$;

-- ─── Harden risky public views when present in production ─────────────

DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'intern_checklist_instances',
    'intern_daily_notes',
    'intern_leads',
    'intern_checklist_templates',
    'creator_performance',
    'platform_conversion_funnel'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_name
        AND c.relkind = 'v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', v_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', v_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_name);
    END IF;
  END LOOP;
END;
$$;
