-- Studio hours of operation — one row per weekday tracking when
-- the studio is "open for business". Drives the gold/8% in-hours
-- band on the /calendar week grid (Apple-Calendar-style frame) so
-- admins + members see at a glance when the studio is staffed +
-- bookable. Independent from per-member work schedules (those live
-- in team_schedule_recurring / team_schedule_blocks); a member can
-- still be scheduled outside studio hours (off-site work, prep,
-- etc.).
--
-- One row per weekday makes the typical "Tue–Sat 10–8" pattern
-- trivially expressible and gives the admin a clean Settings UI:
-- 7 rows, each toggleable + time-pickable.

CREATE TABLE IF NOT EXISTS public.studio_hours_of_operation (
  id           uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 0=Sun ... 6=Sat. Matches Postgres EXTRACT(DOW) + JS getDay().
  weekday      smallint      NOT NULL UNIQUE CHECK (weekday BETWEEN 0 AND 6),
  open_time    time          NOT NULL,
  close_time   time          NOT NULL,
  -- false = closed that day (open/close times kept so toggling on
  -- restores the previous hours instead of forcing re-entry).
  active       boolean       NOT NULL DEFAULT true,
  updated_by   uuid          NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT studio_hours_time_order CHECK (close_time > open_time)
);

COMMENT ON TABLE public.studio_hours_of_operation IS
  'Studio operating hours per weekday. Drives the gold in-hours band on /calendar. One row per weekday (0=Sun..6=Sat) seeded with the default Tue–Sat 10:00–20:00 working week.';

-- ─── updated_at trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.studio_hours_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS studio_hours_updated_at ON public.studio_hours_of_operation;
CREATE TRIGGER studio_hours_updated_at
  BEFORE UPDATE ON public.studio_hours_of_operation
  FOR EACH ROW EXECUTE FUNCTION public.studio_hours_set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────
-- Everyone authenticated SELECTs (so the calendar overlay works for
-- members too). Only admins INSERT/UPDATE/DELETE.

ALTER TABLE public.studio_hours_of_operation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_hours_read ON public.studio_hours_of_operation;
CREATE POLICY studio_hours_read
  ON public.studio_hours_of_operation FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS studio_hours_admin_write ON public.studio_hours_of_operation;
CREATE POLICY studio_hours_admin_write
  ON public.studio_hours_of_operation FOR ALL
  TO authenticated
  USING (public.is_team_admin())
  WITH CHECK (public.is_team_admin());

-- ─── Seed Tue–Sat 10:00–20:00 ───────────────────────────────────────
-- Sun (0) + Mon (1) seeded inactive so toggling them on later
-- doesn't require time-pickers; admin just flips the active switch.
INSERT INTO public.studio_hours_of_operation (weekday, open_time, close_time, active)
VALUES
  (0, '10:00', '20:00', false),
  (1, '10:00', '20:00', false),
  (2, '10:00', '20:00', true),
  (3, '10:00', '20:00', true),
  (4, '10:00', '20:00', true),
  (5, '10:00', '20:00', true),
  (6, '10:00', '20:00', true)
ON CONFLICT (weekday) DO NOTHING;
