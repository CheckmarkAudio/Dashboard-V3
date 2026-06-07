-- Review-received capture (Retention epic, phase A).
--
-- Records a received client review AND emits a Retention flywheel event,
-- atomically, via the log_client_review() SECURITY DEFINER RPC (the only
-- write path — the table has no direct INSERT policy). Reads are team-scoped.
-- Applied to prod via MCP at PR-open; validated by rollback.
create table if not exists public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  source text not null default 'manual' check (source in ('manual','google','other')),
  body text,
  reviewed_at timestamptz not null default now(),
  logged_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_reviews_team on public.client_reviews(team_id, reviewed_at desc);
create index if not exists idx_client_reviews_client on public.client_reviews(client_id);

alter table public.client_reviews enable row level security;
drop policy if exists client_reviews_select on public.client_reviews;
create policy client_reviews_select on public.client_reviews
  for select to authenticated using (team_id = get_my_team_id());
-- No INSERT/UPDATE/DELETE policies — writes go through log_client_review().

create or replace function public.log_client_review(
  p_client_id uuid, p_rating int, p_source text default 'manual', p_body text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_team uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  v_team := get_my_team_id();
  if v_team is null then raise exception 'no team context'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;
  if coalesce(p_source,'manual') not in ('manual','google','other') then raise exception 'invalid source'; end if;
  insert into public.client_reviews (team_id, client_id, rating, source, body, logged_by)
  values (v_team, p_client_id, p_rating, coalesce(p_source,'manual'), nullif(btrim(coalesce(p_body,'')),''), v_me)
  returning id into v_id;
  insert into public.flywheel_events (stage, source_type, source_id, member_id, team_id, metadata, occurred_at)
  values ('retention','review', v_id, v_me, v_team,
          jsonb_build_object('rating',p_rating,'client_id',p_client_id,'source',coalesce(p_source,'manual')), now());
  return v_id;
end; $$;
grant execute on function public.log_client_review(uuid,int,text,text) to authenticated;
