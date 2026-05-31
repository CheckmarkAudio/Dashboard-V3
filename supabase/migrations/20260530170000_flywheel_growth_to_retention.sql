-- Rename the 5th flywheel stage: growth → retention.
--
-- "Retention" names the *action* in the loop that fuels growth — recurring
-- clients, 5-star reviews, re-engaging past clients for deals/events.
-- "Growth" is the overall outcome we observe across the whole flywheel, not
-- a stage in it. Companion to the canonical module change in
-- src/lib/flywheel/stages.ts. Applied to prod via MCP at PR-open; validated
-- by rollback (retention accepted, growth rejected, 0 existing growth rows).

-- Defensive remaps (all expected to touch 0 rows today — nothing emits to
-- the 5th stage yet, and no KPIs/tasks were tagged growth).
update public.flywheel_events    set stage='retention'          where stage='growth';
update public.member_kpis         set flywheel_stage='retention' where lower(flywheel_stage)='growth';
update public.assigned_tasks      set category='retention'       where lower(category)='growth';
update public.task_requests       set category='retention'       where lower(category)='growth';
update public.task_template_items set category='retention'       where lower(category)='growth';

alter table public.flywheel_events drop constraint if exists flywheel_events_stage_check;
alter table public.flywheel_events add constraint flywheel_events_stage_check
  check (stage in ('discovery','workflow','production','education','retention'));

create or replace function public.record_flywheel_event(
  p_stage text, p_source_type text, p_source_id uuid default null,
  p_member_id uuid default null, p_metadata jsonb default '{}'::jsonb, p_occurred_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_event_id uuid; v_team_id uuid; v_member uuid;
begin
  if p_stage not in ('discovery','workflow','production','education','retention') then
    raise exception 'Invalid flywheel stage: %', p_stage using errcode='check_violation'; end if;
  if p_source_type is null or length(p_source_type)=0 then raise exception 'source_type is required'; end if;
  v_member := coalesce(p_member_id, auth.uid());
  v_team_id := get_my_team_id();
  if v_team_id is null then raise exception 'Cannot record flywheel event without a team context'; end if;
  insert into public.flywheel_events (stage, source_type, source_id, member_id, team_id, metadata, occurred_at)
  values (p_stage, p_source_type, p_source_id, v_member, v_team_id, coalesce(p_metadata, '{}'::jsonb), p_occurred_at)
  returning id into v_event_id;
  return v_event_id;
end; $$;
