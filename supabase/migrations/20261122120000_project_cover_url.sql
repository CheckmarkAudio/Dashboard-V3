-- Optional cover art for the Projects grid and project hero.
-- NOT APPLIED by creating this file. Do not run this migration until Bridget
-- or Gavin explicitly approves it. The app already works without this column:
-- it uses a project's cover_url when present and otherwise picks default art
-- in the frontend.
BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.projects.cover_url IS
  'Optional public URL for project cover art. Shown as the Projects grid card image and the project page hero. NULL means the app should choose default catalog art.';

COMMIT;
