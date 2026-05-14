-- Tighten legacy team_members policies to signed-in users.
--
-- The old `admin_all_intern_users` policy was scoped to `public` while
-- calling the authenticated-only helper `intern_get_user_role()`. On
-- production this can surface as:
--   permission denied for function intern_get_user_role
-- when Account Access reads team_members.

DROP POLICY IF EXISTS "admin_all_intern_users" ON public.team_members;

CREATE POLICY "admin_all_intern_users"
ON public.team_members
FOR ALL
TO authenticated
USING (public.intern_get_user_role() = 'admin');

DROP POLICY IF EXISTS "intern_self" ON public.team_members;

CREATE POLICY "intern_self"
ON public.team_members
FOR SELECT
TO authenticated
USING (id = auth.uid());
