-- Re-key member_kpis.flywheel_stage to the new five-stage vocabulary so
-- existing KPI definitions map onto the new stage cards (KPIDashboard,
-- MemberKPIPanel, AdminFlywheelWidget). Case-insensitive; idempotent.
-- Applied to prod via MCP at PR-open.
update public.member_kpis set flywheel_stage = case lower(flywheel_stage)
  when 'deliver' then 'production'
  when 'capture' then 'workflow'
  when 'share'   then 'discovery'
  when 'attract' then 'discovery'
  when 'book'    then 'workflow'
  else flywheel_stage
end
where lower(flywheel_stage) in ('deliver','capture','share','attract','book');
