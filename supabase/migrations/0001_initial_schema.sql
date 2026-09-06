-- CAPA Management System — initial schema, RLS and helpers.
-- Hierarchy: LOCALE -> MONTH -> DEPARTMENT -> CAPA PLAN -> CAPA SET[] -> ACTION ITEM[]
-- Nested sub-structures (6M, vital causes, 5 whys, verification) are jsonb.
-- Date fields are text ("YYYY-MM-DD") to match the app's existing date helpers.

-- ------------------------------------------------------------------ tables ---

create table public.locales (
  id text primary key,
  name text not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('LOCALE', 'QMD')),
  full_name text not null default ''
);

-- One shared login per branch. `visible_password` is a QMD-only recoverable copy
-- (deliberate tradeoff): RLS below restricts the whole table to QMD, and
-- auth_locale_id() is SECURITY DEFINER so LOCALE users still resolve their branch.
create table public.locale_accounts (
  locale_id text primary key references public.locales (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  visible_password text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.months (
  id uuid primary key default gen_random_uuid(),
  locale_id text not null references public.locales (id) on delete cascade,
  year int not null,
  month_num int not null,
  label text not null,
  unique (locale_id, year, month_num)
);

create table public.capa_plans (
  id uuid primary key default gen_random_uuid(),
  capa_id text not null unique,
  locale_id text not null references public.locales (id) on delete cascade,
  month_id uuid not null references public.months (id) on delete cascade,
  year int not null,
  month_num int not null,
  department text not null,
  date_created text not null default '',
  source text not null default '',
  prepared_by text not null default '',
  stage text not null default 'draft'
    check (stage in ('draft', 'submitted', 'closed', 'monitoring', 'reopened')),
  submitted_date text not null default '',
  archived boolean not null default false,
  verification jsonb not null
    default '{"date":"","verifiedBy":"","evidence":"","result":"","remarks":""}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index capa_plans_locale_id_idx on public.capa_plans (locale_id);
create index capa_plans_month_id_idx on public.capa_plans (month_id);

create table public.capa_sets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.capa_plans (id) on delete cascade,
  set_number int not null,
  set_code text not null,
  archived boolean not null default false,
  issue text not null default '',
  six_m jsonb not null default '{}'::jsonb,
  vital_causes jsonb not null default '[]'::jsonb,
  five_whys jsonb not null
    default '{"why1":"","why2":"","why3":"","why4":"","why5":"","rootCause":""}'::jsonb,
  unique (plan_id, set_number)
);
create index capa_sets_plan_id_idx on public.capa_sets (plan_id);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.capa_sets (id) on delete cascade,
  corrective_action text not null default '',
  preventive_action text not null default '',
  responsible_person text not null default '',
  target_date text not null default '',
  status text not null default 'Not Started',
  date_completed text not null default '',
  verification text not null default '',
  remarks text not null default '',
  order_index int not null default 0
);
create index action_items_set_id_idx on public.action_items (set_id);

-- --------------------------------------------------------------- functions ---

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger capa_plans_touch_updated_at
  before update on public.capa_plans
  for each row execute function public.touch_updated_at();

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_locale_id()
returns text language sql stable security definer set search_path = public as $$
  select locale_id from public.locale_accounts
  where user_id = auth.uid() and enabled = true;
$$;

create or replace function public.is_qmd()
returns boolean language sql stable as $$
  select coalesce(public.auth_role() = 'QMD', false);
$$;

-- --------------------------------------------------------------------- RLS ---

alter table public.locales enable row level security;
alter table public.profiles enable row level security;
alter table public.locale_accounts enable row level security;
alter table public.months enable row level security;
alter table public.capa_plans enable row level security;
alter table public.capa_sets enable row level security;
alter table public.action_items enable row level security;

-- locales: readable by any signed-in user; writable only by QMD
create policy locales_read on public.locales
  for select to authenticated using (true);
create policy locales_qmd_write on public.locales
  for all to authenticated using (public.is_qmd()) with check (public.is_qmd());

-- profiles: a user sees their own; QMD sees/writes all
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_qmd());
create policy profiles_qmd_write on public.profiles
  for all to authenticated using (public.is_qmd()) with check (public.is_qmd());

-- locale_accounts: QMD only (hides visible_password from LOCALE users)
create policy locale_accounts_qmd_all on public.locale_accounts
  for all to authenticated using (public.is_qmd()) with check (public.is_qmd());

-- months / capa_plans: QMD everything; LOCALE only their own branch
create policy months_access on public.months
  for all to authenticated
  using (public.is_qmd() or locale_id = public.auth_locale_id())
  with check (public.is_qmd() or locale_id = public.auth_locale_id());

create policy capa_plans_access on public.capa_plans
  for all to authenticated
  using (public.is_qmd() or locale_id = public.auth_locale_id())
  with check (public.is_qmd() or locale_id = public.auth_locale_id());

-- capa_sets / action_items: inherit scope from the parent plan
create policy capa_sets_access on public.capa_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.capa_plans p
      where p.id = plan_id
        and (public.is_qmd() or p.locale_id = public.auth_locale_id())
    )
  )
  with check (
    exists (
      select 1 from public.capa_plans p
      where p.id = plan_id
        and (public.is_qmd() or p.locale_id = public.auth_locale_id())
    )
  );

create policy action_items_access on public.action_items
  for all to authenticated
  using (
    exists (
      select 1 from public.capa_sets s
      join public.capa_plans p on p.id = s.plan_id
      where s.id = set_id
        and (public.is_qmd() or p.locale_id = public.auth_locale_id())
    )
  )
  with check (
    exists (
      select 1 from public.capa_sets s
      join public.capa_plans p on p.id = s.plan_id
      where s.id = set_id
        and (public.is_qmd() or p.locale_id = public.auth_locale_id())
    )
  );
