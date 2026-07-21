-- Ensure new auth users must complete onboarding (run after 04_profiles_onboarding_v2.sql).
-- Without this, the handle_new_user_profile trigger may insert onboarding_completed = true
-- and skip the post-signup questionnaire.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text;
  v_first_name text;
  v_last_name text;
  v_email text;
begin
  v_username := lower(
    trim(both '@' from trim(coalesce(meta->>'username', meta->>'display_name', '')))
  );
  v_first_name := trim(coalesce(meta->>'first_name', ''));
  v_last_name := trim(coalesce(meta->>'last_name', ''));
  v_email := lower(trim(coalesce(new.email, meta->>'email', '')));

  insert into public.profiles (
    user_id,
    first_name,
    last_name,
    username,
    display_name,
    email,
    onboarding_completed
  )
  values (
    new.id,
    nullif(v_first_name, ''),
    nullif(v_last_name, ''),
    nullif(v_username, ''),
    nullif(v_username, ''),
    nullif(v_email, ''),
    false
  )
  on conflict (user_id) do update
  set
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    username = coalesce(excluded.username, public.profiles.username),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    email = coalesce(excluded.email, public.profiles.email),
    onboarding_completed = coalesce(public.profiles.onboarding_completed, excluded.onboarding_completed);

  return new;
end;
$$;
