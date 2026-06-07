-- Public community notes for a single café (café detail "Community notes").
-- SECURITY DEFINER: same pattern as get_recent_public_visit_notes (Bulletin bypasses RLS).
-- Does NOT filter hidden_from_bulletin (that flag is Bulletin-only).
-- Run in Supabase SQL Editor.

drop function if exists public.get_public_cafe_visit_notes(text, int);

create function public.get_public_cafe_visit_notes(p_cafe_id text, p_limit int default 5)
returns table (
  visit_id uuid,
  cafe_id text,
  note text,
  rating numeric,
  tags text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as visit_id,
    v.cafe_id::text as cafe_id,
    trim(v.note) as note,
    v.rating,
    v.tags,
    v.created_at
  from public.user_cafe_visits v
  left join public.cafes c on c.id::text = v.cafe_id::text
  where length(trim(coalesce(p_cafe_id, ''))) > 0
    and length(trim(coalesce(v.note, ''))) > 0
    and (
      v.cafe_id::text = trim(p_cafe_id)
      or nullif(trim(c.slug), '') = trim(p_cafe_id)
    )
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

grant execute on function public.get_public_cafe_visit_notes(text, int) to anon, authenticated;
