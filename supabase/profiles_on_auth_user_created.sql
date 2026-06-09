-- Run in Supabase SQL editor.
-- Creates public.profiles automatically when a new auth.users row is inserted.
-- Client signup should pass metadata via auth.signUp options.data:
--   display_name, username, first_name, last_name
-- Email comes from auth.users.email (not only metadata).

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists username text,
  add column if not exists email text;

create unique index if not exists profiles_user_id_key on public.profiles (user_id);

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
    true
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

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();
