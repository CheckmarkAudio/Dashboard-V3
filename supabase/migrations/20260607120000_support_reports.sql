-- Feedback button backend. Stores in-app feedback / bug reports.
-- Write path is the submit_support_report() SECURITY DEFINER RPC (the
-- table has no direct INSERT policy). Reads are team-scoped so admins
-- can triage. Applied to prod via MCP at PR open; validated by rollback.
create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  reported_by uuid,
  description text not null,
  what_tried text,
  severity text not null default 'Medium' check (severity in ('Low','Medium','High','Critical')),
  page_url text,
  user_agent text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_support_reports_team on public.support_reports(team_id, created_at desc);

alter table public.support_reports enable row level security;
drop policy if exists support_reports_select on public.support_reports;
create policy support_reports_select on public.support_reports
  for select to authenticated using (team_id = get_my_team_id());
-- No INSERT/UPDATE/DELETE policies — writes go through submit_support_report().

create or replace function public.submit_support_report(
  p_description text, p_what_tried text default null, p_severity text default 'Medium',
  p_page_url text default null, p_user_agent text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_team uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  v_team := get_my_team_id();
  if v_team is null then raise exception 'no team context'; end if;
  if btrim(coalesce(p_description,'')) = '' then raise exception 'description required'; end if;
  if coalesce(p_severity,'Medium') not in ('Low','Medium','High','Critical') then raise exception 'invalid severity'; end if;
  insert into public.support_reports (team_id, reported_by, description, what_tried, severity, page_url, user_agent)
  values (v_team, v_me, btrim(p_description), nullif(btrim(coalesce(p_what_tried,'')),''),
          coalesce(p_severity,'Medium'), nullif(btrim(coalesce(p_page_url,'')),''), nullif(btrim(coalesce(p_user_agent,'')),''))
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.submit_support_report(text,text,text,text,text) to authenticated;
