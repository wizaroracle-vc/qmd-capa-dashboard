-- Action items gain a "started date" (paired with target_date as the
-- Expected Completion date on the Improvement Action Plan).
alter table public.action_items
  add column if not exists started_date text not null default '';
