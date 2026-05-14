-- ============================================================================
-- 2026-05-14 — Add Media feature
--
-- New table `media_submissions` records every file uploaded through the
-- "Add Media" tab. The actual file lives in Google Drive (per-member
-- folder under "Checkmark Media"); this table stores the metadata so:
--   - the member can see their own submission history
--   - admins can see everyone's submissions for review/audit
--   - we get a click-through link to the file in Drive
--
-- One column added to `team_members.preferences` (no schema change — it's
-- already a freeform jsonb): `drive_folder_id` caches the Drive folder ID
-- for each member's per-member subfolder so we don't re-create it on
-- every upload.
-- ============================================================================

create table if not exists public.media_submissions (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.team_members(id) on delete cascade,
  drive_file_id   text not null,
  drive_view_url  text,
  original_filename text not null,
  stored_filename text not null,
  size_bytes      bigint not null,
  content_type    text,
  created_at      timestamptz not null default now()
);

create index if not exists media_submissions_member_created_idx
  on public.media_submissions (member_id, created_at desc);

create index if not exists media_submissions_created_idx
  on public.media_submissions (created_at desc);

alter table public.media_submissions enable row level security;

-- Members see their own submissions; admins see everyone's. Mirrors the
-- pattern used by other "personal data + admin oversight" tables in this
-- codebase (assigned_tasks, sessions).
create policy "members read own media submissions"
  on public.media_submissions for select
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.team_members
      where id = auth.uid() and role = 'admin'
    )
  );

-- Inserts are written by the upload-to-drive edge function (service-role
-- key, bypasses RLS). No INSERT policy needed for the client — this
-- prevents a client from forging a row that points at a Drive file they
-- never uploaded.

-- Owner-only delete (in case admin needs to cleanup an orphan row after
-- a Drive file was manually removed). Members shouldn't delete their own
-- history rows since the corresponding Drive files would still exist.
create policy "owner deletes media submissions"
  on public.media_submissions for delete
  using (
    exists (
      select 1 from public.team_members
      where id = auth.uid()
        and lower(coalesce(email, '')) = 'checkmarkaudio@gmail.com'
    )
  );

comment on table public.media_submissions is
  'One row per file uploaded through the Add Media tab. Files live in Google Drive; this table stores the metadata for history + audit.';
