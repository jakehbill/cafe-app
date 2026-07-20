# Production schema diagnosis (inspected live)

**Project:** `fhmtmibghmjuurzyncyh.supabase.co`  
**Method:** PostgREST column probes (`GET /rest/v1/<table>?select=<col>&limit=0`) with the anon key.  
**Not available in this environment:** Supabase CLI, `psql`, service-role key, direct `information_schema` (indexes / triggers / RLS catalog). Those need a DB URL or `supabase db dump` with a linked project.

There is **no** generated `database.types.ts` in the repo.

---

## 1. Actual production columns (present = OK via schema cache)

### `cafes`
**Present:** `id`, `name`, `slug`, `area`, `latitude`, `longitude`, `address`, `google_maps_url`, `short_description`, `tags`, `image_urls`, `venue_type`, `status`, `is_certified`, `created_at`  

**Absent (probed):** `neighborhood`, `google_place_id`, `website`, `phone_number`, `image_url`, `work_score`, `vibe_score`, `coffee_score`, `updated_at`

### `cafe_submissions`
**Present:** `id`, `user_id`, `cafe_name`, `address_text`, `area`, `google_maps_url`, `google_place_id`, `latitude`, `longitude`, `website`, `phone_number`, `notes`, `selected_tags`, `source`, `coffee_rating`, `status`, `moderation_status`, `reviewed_at`, `approved_cafe_id`, `created_at`, `updated_at`  

**Absent (probed):** `submitted_by_user_id`, `venue_type`, `is_certified`

### `user_cafe_visits`
**Present:** `id`, `user_id`, `cafe_id`, `submission_id`, `created_at`, `updated_at`, `rating`, `tags`, `note`, `is_public`, `stay_duration`, `cost_to_work`, `wifi_reliability`, `busyness`, `coffee_quality`, `food_quality`, `hidden_from_bulletin`  

**Absent (probed):** `image_url`, `storage_path` (legacy; app uses `visit_photos` instead)

### `cafe_photos`
**Present:** `id`, `user_id`, `cafe_id`, `storage_path`, `image_url`, `caption`, `status`, `share_publicly`, `source_visit_id`, `reviewed_at`, `created_at`  

**Absent (probed):** `is_primary`, `sort_order`

### `visit_photos`
**Present:** `id`, `visit_id`, `user_id`, `storage_path`, `sort_order`, `share_publicly`, `is_public`, `public_status`, `created_at`  

**Absent (probed):** none of the app-required set

### Related (also probed)
| Object | Status |
|--------|--------|
| `cafe_submission_photos` | Present; columns match app |
| `ratings` / `rating_tags` | Present |
| `user_saved_cafes` / `user_visited_cafes` | Present (includes `id` + composite keys fields) |
| `cafe_public_scores` view | Present |
| RPCs `get_cafes_workspace_review_summaries`, `get_cafes_public_work_scores`, `get_cafe_cost_to_work_summary`, `get_cafes_tag_popularity` | Callable (200) |

---

## 2. Compare to frontend / migrations

| Need | Production | Verdict |
|------|------------|---------|
| Suggest a Space writes `cafe_submissions.venue_type` | **Missing** | **Blocks Create Space** |
| Client wrongly wrote `cafe_submissions.is_certified` | Correctly absent | Client fixed; do **not** add |
| Live Google Place dup check uses `cafes.google_place_id` | **Missing** | Falls back to maps URL scrape; add for correctness |
| Moderation primary photo (`is_primary`, `sort_order`) | **Missing** on `cafe_photos` | Breaks primary-photo tools |
| Full visit review columns | Present | OK |
| Visit / submission photos | Present | OK |
| `submitted_by_user_id` | Missing | App already falls back to `user_id` |
| `cafes.neighborhood` | Missing | App maps `area` → neighborhood; OK |
| `cafes.work_score` / `vibe_score` | Missing | Scores come from visits / `cafe_public_scores`; OK to leave |

Repo SQL never contained a full `CREATE TABLE` for `cafes` / `cafe_submissions`; only partial ALTERs. Production is ahead of those scripts in some places (visit review columns, photo tables) and behind in others (`venue_type` on submissions).

---

## 3. Indexes / triggers / RLS

**Not inspected** (no DB superuser / `information_schema` access from this environment).  
To dump them locally after linking:

```bash
supabase link --project-ref fhmtmibghmjuurzyncyh
supabase db dump --schema public -f supabase/prod_schema.dump.sql
```

---

## 4. Why `reconcile_app_schema.sql` failed

The script wrapped everything in a single transaction (`BEGIN` … `COMMIT`). **Any error aborts and rolls back every successful change**, including any column that had already been added.

### First high-risk statement that likely stopped execution

In the `cafe_submissions` section, after no-ops on existing columns, the **first column that does not exist on production** and is added with an `auth.users` FK is:

```sql
alter table public.cafe_submissions
  add column if not exists submitted_by_user_id uuid
  references auth.users (id) on delete set null;
```

That runs **before**:

```sql
alter table public.cafe_submissions add column if not exists venue_type text;
```

So if adding `submitted_by_user_id` fails (common on Supabase when the SQL role cannot create FKs into `auth.users`, or permissions differ), the transaction dies **before `venue_type` is ever added**. Even if `venue_type` were added later in the same script, a later failure (e.g. rating `CHECK` constraint, unique index on duplicate `google_place_id` rows) would **roll it back**.

Guessing production and bulk-adding unrelated columns/FKs/policies is why this approach was unsafe.

---

## 5. Small migrations (real gaps only)

See:

1. `supabase/migrations_manual/01_cafe_submissions_venue_type.sql`
2. `supabase/migrations_manual/02_cafes_google_place_id.sql`
3. `supabase/migrations_manual/03_cafe_photos_primary_sort.sql`

Run them **in order**, one at a time, in the SQL Editor. Do not re-run the old `reconcile_app_schema.sql`.
