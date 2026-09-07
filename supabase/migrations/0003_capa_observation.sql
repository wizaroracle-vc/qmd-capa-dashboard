-- CAPA observation period.
-- After a branch submits (stage 'submitted'), QMD puts the plan under observation
-- for a configurable window before the effectiveness verification. The window
-- elapses purely by date (planStatus() computes "For QMD Verification" once the
-- end date passes) — no background job.

alter table public.capa_plans
  add column if not exists observation_started_date  text    not null default '',
  add column if not exists observation_duration_days integer not null default 90,
  add column if not exists observation_started_by    text    not null default '';

alter table public.capa_plans drop constraint if exists capa_plans_stage_check;
alter table public.capa_plans add constraint capa_plans_stage_check
  check (stage in ('draft', 'submitted', 'observing', 'closed', 'monitoring', 'reopened'));
