-- Follow-up hardening pass for the remaining SECURITY DEFINER views
-- that were still flagged by Supabase Security Advisor after the
-- broader RPC/view sweep.
--
-- Applied manually in production on 2026-05-01, then captured here so
-- the repo stays aligned with the live database.

ALTER VIEW public.intern_users SET (security_invoker = true);
ALTER VIEW public.intern_lead_activities SET (security_invoker = true);
ALTER VIEW public.intern_performance_reviews SET (security_invoker = true);
ALTER VIEW public.intern_checklist_items SET (security_invoker = true);
ALTER VIEW public.intern_schedule_templates SET (security_invoker = true);
ALTER VIEW public.intern_performance_scores SET (security_invoker = true);

REVOKE ALL ON TABLE public.intern_users FROM PUBLIC;
REVOKE ALL ON TABLE public.intern_lead_activities FROM PUBLIC;
REVOKE ALL ON TABLE public.intern_performance_reviews FROM PUBLIC;
REVOKE ALL ON TABLE public.intern_checklist_items FROM PUBLIC;
REVOKE ALL ON TABLE public.intern_schedule_templates FROM PUBLIC;
REVOKE ALL ON TABLE public.intern_performance_scores FROM PUBLIC;

REVOKE ALL ON TABLE public.intern_users FROM anon;
REVOKE ALL ON TABLE public.intern_lead_activities FROM anon;
REVOKE ALL ON TABLE public.intern_performance_reviews FROM anon;
REVOKE ALL ON TABLE public.intern_checklist_items FROM anon;
REVOKE ALL ON TABLE public.intern_schedule_templates FROM anon;
REVOKE ALL ON TABLE public.intern_performance_scores FROM anon;

GRANT SELECT ON TABLE public.intern_users TO authenticated;
GRANT SELECT ON TABLE public.intern_lead_activities TO authenticated;
GRANT SELECT ON TABLE public.intern_performance_reviews TO authenticated;
GRANT SELECT ON TABLE public.intern_checklist_items TO authenticated;
GRANT SELECT ON TABLE public.intern_schedule_templates TO authenticated;
GRANT SELECT ON TABLE public.intern_performance_scores TO authenticated;
