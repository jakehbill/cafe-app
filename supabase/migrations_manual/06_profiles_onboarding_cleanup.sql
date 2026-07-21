-- Onboarding schema consolidation (run after 04 and 05).
-- 1. Ensures active onboarding columns exist
-- 2. Renames legacy column names to current app names
-- 3. Drops columns from abandoned onboarding iterations

-- Ensure v2 columns exist (safe if 04 already ran).
alter table public.profiles
  add column if not exists is_digital_nomad boolean,
  add column if not exists workspace_type_preferences text[],
  add column if not exists work_style text,
  add column if not exists onboarding_completed boolean;

alter table public.profiles
  add column if not exists current_city text,
  add column if not exists workspace_frustration text;

-- city → current_city (legacy name from early profile schema)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'city'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_city'
  ) then
    alter table public.profiles rename column city to current_city;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'city'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_city'
  ) then
    update public.profiles
    set current_city = coalesce(current_city, city)
    where city is not null;
    alter table public.profiles drop column city;
  end if;
end $$;

-- onboarding_biggest_frustration → workspace_frustration
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_biggest_frustration'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'workspace_frustration'
  ) then
    alter table public.profiles rename column onboarding_biggest_frustration to workspace_frustration;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_biggest_frustration'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'workspace_frustration'
  ) then
    update public.profiles
    set workspace_frustration = coalesce(workspace_frustration, onboarding_biggest_frustration)
    where onboarding_biggest_frustration is not null;
    alter table public.profiles drop column onboarding_biggest_frustration;
  end if;
end $$;

comment on column public.profiles.current_city is 'User base or current city from onboarding.';
comment on column public.profiles.is_digital_nomad is 'True when user selected digital nomad during onboarding.';
comment on column public.profiles.workspace_type_preferences is 'Onboarding workspace type values (venue_type slugs + bar_pub).';
comment on column public.profiles.work_style is 'Onboarding work style id: deep_focus | cafe_creative | social_worker | hybrid_professional.';
comment on column public.profiles.workspace_frustration is 'Biggest workspace-finding challenge from onboarding.';

-- Abandoned onboarding iterations (not read or written by the app).
alter table public.profiles
  drop column if exists onboarding_workspace_discovery,
  drop column if exists onboarding_remote_work_frequency,
  drop column if exists notifications_opt_in;
