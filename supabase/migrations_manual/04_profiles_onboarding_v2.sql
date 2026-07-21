-- Onboarding v2 profile fields (run in Supabase SQL editor).
-- Collects workspace preferences and product-research answers; no ranking logic yet.

alter table public.profiles
  add column if not exists is_digital_nomad boolean,
  add column if not exists workspace_type_preferences text[],
  add column if not exists work_style text,
  add column if not exists onboarding_biggest_frustration text,
  add column if not exists onboarding_workspace_discovery text,
  add column if not exists onboarding_remote_work_frequency text,
  add column if not exists notifications_opt_in boolean;

comment on column public.profiles.is_digital_nomad is 'True when user selected digital nomad during onboarding.';
comment on column public.profiles.workspace_type_preferences is 'Onboarding workspace type values (venue_type slugs + bar_pub).';
comment on column public.profiles.work_style is 'Onboarding work style id: deep_focus | cafe_creative | social_worker | hybrid_professional.';
comment on column public.profiles.onboarding_biggest_frustration is 'Product research — biggest workspace frustration.';
comment on column public.profiles.onboarding_workspace_discovery is 'Product research — where user discovers workspaces.';
comment on column public.profiles.onboarding_remote_work_frequency is 'Product research — remote work frequency.';
