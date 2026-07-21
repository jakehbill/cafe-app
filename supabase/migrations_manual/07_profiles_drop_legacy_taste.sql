-- Drop legacy onboarding taste / research columns (run after 06_profiles_onboarding_cleanup.sql).
-- New onboarding stores answers in workspace_type_preferences, work_style, current_city, etc.
-- Covers alternate column names from earlier schema iterations.

alter table public.profiles
  drop column if exists coffee_preference,
  drop column if exists vibe_preferences,
  drop column if exists intent_preferences,
  drop column if exists vibe_preference,
  drop column if exists intent_preference,
  drop column if exists remote_work_frequency,
  drop column if exists workspace_discovery_sources,
  drop column if exists onboarding_workspace_discovery,
  drop column if exists onboarding_remote_work_frequency,
  drop column if exists notifications_opt_in;
