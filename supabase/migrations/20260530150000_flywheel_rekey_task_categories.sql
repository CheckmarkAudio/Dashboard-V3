-- Re-key flywheel-stage `category` values to the new five-stage vocabulary
-- (discovery/workflow/production/education/growth) on the task tables.
-- Companion to the UI canonicalization in src/lib/flywheel/stages.ts.
--
-- Only recognized legacy stage values are touched; free-text categories
-- (e.g. "Brand Knowledge", "Training", "Tools", "Profile", "Outreach") and
-- the unrelated checklist/performance `category` columns are left alone.
-- Applied to prod via MCP at PR-open; idempotent (re-running maps nothing).
do $$
declare t text;
begin
  foreach t in array array['assigned_tasks','task_requests','task_template_items'] loop
    execute format($f$
      update public.%I set category = case lower(category)
        when 'deliver' then 'production'
        when 'capture' then 'workflow'
        when 'share'   then 'discovery'
        when 'attract' then 'discovery'
        when 'book'    then 'workflow'
      end
      where lower(category) in ('deliver','capture','share','attract','book')
    $f$, t);
  end loop;
end $$;
