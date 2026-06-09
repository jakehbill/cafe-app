-- Optional: run in Supabase SQL editor so pre-signup username checks work under RLS.
-- Without this, signup still proceeds but relies on the profile insert unique constraint.

create or replace function public.is_username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where username = lower(trim(both '@' from trim(coalesce(p_username, ''))))
  );
$$;

grant execute on function public.is_username_taken(text) to anon, authenticated;
