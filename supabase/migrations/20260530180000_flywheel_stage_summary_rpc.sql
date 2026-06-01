-- Phase 2 aggregation: per-stage flywheel event counts for the caller's
-- team over an optional date range (and optional single member). Drives
-- the Flywheel Activity chart + member flywheel chart off REAL events
-- instead of task-category aggregation / placeholder proxies.
--
-- Always returns all five stages (zero-filled via the VALUES left join)
-- so charts render a complete axis. SECURITY DEFINER + explicit
-- team_id = get_my_team_id() filter keeps it team-scoped.
-- Applied to prod via MCP at PR-open; validated by rollback.
create or replace function public.get_flywheel_stage_summary(
  p_since timestamptz default null, p_until timestamptz default null, p_member uuid default null
) returns table(stage text, event_count integer)
language sql stable security definer set search_path = public as $$
  select s.stage, count(e.id)::int
  from (values ('discovery'),('workflow'),('production'),('education'),('retention')) as s(stage)
  left join public.flywheel_events e
    on e.stage = s.stage
   and e.team_id = get_my_team_id()
   and (p_since is null or e.occurred_at >= p_since)
   and (p_until is null or e.occurred_at <= p_until)
   and (p_member is null or e.member_id = p_member)
  group by s.stage;
$$;
grant execute on function public.get_flywheel_stage_summary(timestamptz, timestamptz, uuid) to authenticated;
