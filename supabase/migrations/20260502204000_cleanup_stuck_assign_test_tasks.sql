-- One-time cleanup for test assigned_tasks rows that were created
-- before the team_id guard/RPC hardening landed.
--
-- These rows were already attempted for admin deletion and are test
-- data. They can remain visible if the old delete RPC ignored them
-- because assigned_tasks.team_id was NULL. Keep this tightly scoped to
-- the exact titles/dates reported by the admin.

BEGIN;

DELETE FROM public.assigned_tasks
 WHERE (
     (title = 'Shadow two client sessions' AND due_date = DATE '2026-05-05')
     OR (title = 'Set up profile photo (edited)' AND due_date = DATE '2026-04-29')
     OR (title = 'Connect to content calendar' AND due_date = DATE '2026-05-01')
   );

COMMIT;
