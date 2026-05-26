-- 2026-05-26 — Media submissions: any authenticated team member can SEE all rows.
--
-- The /media page used to scope reads to the caller's own submissions plus
-- an admin-only escape hatch. Per user direction (Bridget, who is admin),
-- the page is meant to be a shared library: anyone on the team can browse
-- the files anyone else dropped, since the studio uses them as raw assets
-- for marketing + sessions.
--
-- Insert / update / delete policies are untouched: members still only insert
-- their own row (member_id = auth.uid()), and only the owner email can
-- delete. Public read does NOT imply public write.

ALTER TABLE public.media_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own media submissions" ON public.media_submissions;

-- Any authenticated user who has a row in team_members can read every
-- submission. Anonymous JWTs are still rejected by the EXISTS check.
CREATE POLICY "team members read all media submissions"
  ON public.media_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.id = auth.uid()
    )
  );
