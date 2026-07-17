-- Rename venue type climbing_gym → gym (app display: "Gym").
-- Safe to re-run.

update public.cafes
set venue_type = 'gym'
where venue_type = 'climbing_gym';

update public.cafe_submissions
set venue_type = 'gym'
where venue_type = 'climbing_gym';
