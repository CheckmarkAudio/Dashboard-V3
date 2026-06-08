-- Admin triage for support_reports: FK to team_members (so the triage
-- list can embed the reporter's display name) + admin-only status-update
-- RPC. The table stays SELECT-only at the RLS layer; status changes go
-- through this SECURITY DEFINER RPC (admin-gated). Applied to prod via
-- MCP at PR open; validated by rollback.
alter table public.support_reports
  add constraint support_reports_reported_by_fkey
  foreign key (reported_by) references public.team_members(id) on delete set null;

create or replace function public.set_support_report_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_admin() then raise exception 'admin only'; end if;
  if p_status not in ('open','in_progress','resolved','dismissed') then raise exception 'invalid status'; end if;
  update public.support_reports
     set status = p_status
   where id = p_id and team_id = get_my_team_id();
end; $$;
grant execute on function public.set_support_report_status(uuid,text) to authenticated;
