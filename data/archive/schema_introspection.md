# Live `public` schema introspection

- Database: `postgres`
- Connected as: `postgres`
- Generated: 2026-09-15T19:15:08.029Z
- Server: PostgreSQL 17.6 on x86_64-pc-linux-gnu

## Tables

- `artwork_terms`
- `artworks`
- `inquiries`
- `media_assets`
- `pages`
- `profiles`
- `schema_migrations`
- `settings`
- `taxonomies`

## Columns


### `artwork_terms`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `artwork_id` | uuid | NO |  |
| `term_id` | uuid | NO |  |

### `artworks`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `slug` | text | NO |  |
| `title` | text | NO |  |
| `year` | text | YES |  |
| `medium` | text | YES |  |
| `dimensions` | text | YES |  |
| `price` | text | YES |  |
| `status` | text | YES | `'Available'::text` |
| `gallery_series` | text | YES |  |
| `edition` | text | YES |  |
| `location` | text | YES |  |
| `image_url` | text | YES |  |
| `hero_slider` | boolean | YES | `false` |
| `enabled` | boolean | YES | `true` |
| `archived` | boolean | YES | `false` |
| `trashed` | boolean | YES | `false` |
| `trashed_at` | timestamp with time zone | YES |  |
| `narrative` | text | YES |  |
| `metadata` | jsonb | YES | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |
| `draft` | boolean | NO | `false` |

### `inquiries`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO |  |
| `email` | text | NO |  |
| `phone` | text | YES |  |
| `artwork_slug` | text | YES |  |
| `artwork_title` | text | YES |  |
| `inquiry_type` | text | YES | `'General Inquiry'::text` |
| `message` | text | NO |  |
| `status` | text | YES | `'new'::text` |
| `created_at` | timestamp with time zone | YES | `now()` |
| `email_status` | text | NO | `'unknown'::text` |
| `email_error` | text | YES |  |
| `email_sent_at` | timestamp with time zone | YES |  |
| `email_studio_id` | text | YES |  |
| `email_collector_id` | text | YES |  |

### `media_assets`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `public_id` | text | NO |  |
| `url` | text | NO |  |
| `thumbnail_url` | text | YES |  |
| `format` | text | YES |  |
| `bytes` | bigint | YES |  |
| `width` | integer | YES |  |
| `height` | integer | YES |  |
| `folder` | text | YES |  |
| `artwork_slug` | text | YES |  |
| `created_at` | timestamp with time zone | YES | `now()` |
| `updated_at` | timestamp with time zone | YES | `now()` |
| `lqip` | text | YES |  |
| `renditions` | jsonb | YES |  |

### `pages`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `slug` | text | NO |  |
| `title` | text | NO |  |
| `content` | text | NO |  |
| `updated_at` | timestamp with time zone | YES | `now()` |

### `profiles`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO |  |
| `email` | text | NO |  |
| `full_name` | text | YES |  |
| `role` | text | NO | `'viewer'::text` |
| `is_active` | boolean | NO | `true` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

### `schema_migrations`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `filename` | text | NO |  |
| `applied_at` | timestamp with time zone | NO | `now()` |

### `settings`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `key` | text | NO |  |
| `value` | jsonb | NO | `'null'::jsonb` |
| `updated_at` | timestamp with time zone | NO | `now()` |
| `updated_by` | uuid | YES |  |

### `taxonomies`

| column | type | null | default |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `type` | text | NO | `'series'::text` |
| `slug` | text | NO |  |
| `name` | text | NO |  |
| `sort_order` | integer | NO | `0` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | `now()` |

## Constraints (PK / FK / UNIQUE / CHECK)

- `artwork_terms` **FK** `artwork_terms_artwork_id_fkey`: FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE
- `artwork_terms` **PK** `artwork_terms_pkey`: PRIMARY KEY (artwork_id, term_id)
- `artwork_terms` **FK** `artwork_terms_term_id_fkey`: FOREIGN KEY (term_id) REFERENCES taxonomies(id) ON DELETE CASCADE
- `artworks` **PK** `artworks_pkey`: PRIMARY KEY (id)
- `artworks` **UNIQUE** `artworks_slug_key`: UNIQUE (slug)
- `inquiries` **PK** `inquiries_pkey`: PRIMARY KEY (id)
- `media_assets` **PK** `media_assets_pkey`: PRIMARY KEY (id)
- `media_assets` **UNIQUE** `media_assets_public_id_key`: UNIQUE (public_id)
- `pages` **PK** `pages_pkey`: PRIMARY KEY (slug)
- `profiles` **FK** `profiles_id_fkey`: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
- `profiles` **PK** `profiles_pkey`: PRIMARY KEY (id)
- `profiles` **CHECK** `profiles_role_check`: CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])))
- `schema_migrations` **PK** `schema_migrations_pkey`: PRIMARY KEY (filename)
- `settings` **PK** `settings_pkey`: PRIMARY KEY (key)
- `settings` **FK** `settings_updated_by_fkey`: FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
- `taxonomies` **PK** `taxonomies_pkey`: PRIMARY KEY (id)
- `taxonomies` **CHECK** `taxonomies_type_check`: CHECK ((type = ANY (ARRAY['series'::text, 'tag'::text, 'medium'::text, 'location'::text])))
- `taxonomies` **UNIQUE** `taxonomies_type_slug_key`: UNIQUE (type, slug)

## Indexes

- `artwork_terms`: CREATE UNIQUE INDEX artwork_terms_pkey ON public.artwork_terms USING btree (artwork_id, term_id)
- `artwork_terms`: CREATE INDEX artwork_terms_term_idx ON public.artwork_terms USING btree (term_id)
- `artworks`: CREATE UNIQUE INDEX artworks_pkey ON public.artworks USING btree (id)
- `artworks`: CREATE UNIQUE INDEX artworks_slug_key ON public.artworks USING btree (slug)
- `artworks`: CREATE INDEX idx_artworks_drafts ON public.artworks USING btree (updated_at DESC) WHERE (draft = true)
- `artworks`: CREATE INDEX idx_artworks_hero ON public.artworks USING btree (hero_slider)
- `artworks`: CREATE INDEX idx_artworks_published ON public.artworks USING btree (updated_at DESC) WHERE ((draft = false) AND (trashed = false))
- `artworks`: CREATE INDEX idx_artworks_series ON public.artworks USING btree (gallery_series)
- `artworks`: CREATE INDEX idx_artworks_slug ON public.artworks USING btree (slug)
- `artworks`: CREATE INDEX idx_artworks_status ON public.artworks USING btree (status)
- `inquiries`: CREATE INDEX idx_inquiries_created ON public.inquiries USING btree (created_at DESC)
- `inquiries`: CREATE INDEX idx_inquiries_email ON public.inquiries USING btree (email)
- `inquiries`: CREATE UNIQUE INDEX inquiries_pkey ON public.inquiries USING btree (id)
- `media_assets`: CREATE INDEX media_assets_artwork_slug_idx ON public.media_assets USING btree (artwork_slug) WHERE (artwork_slug IS NOT NULL)
- `media_assets`: CREATE UNIQUE INDEX media_assets_pkey ON public.media_assets USING btree (id)
- `media_assets`: CREATE UNIQUE INDEX media_assets_public_id_key ON public.media_assets USING btree (public_id)
- `pages`: CREATE UNIQUE INDEX pages_pkey ON public.pages USING btree (slug)
- `profiles`: CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)
- `schema_migrations`: CREATE UNIQUE INDEX schema_migrations_pkey ON public.schema_migrations USING btree (filename)
- `settings`: CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key)
- `taxonomies`: CREATE UNIQUE INDEX taxonomies_pkey ON public.taxonomies USING btree (id)
- `taxonomies`: CREATE UNIQUE INDEX taxonomies_type_slug_key ON public.taxonomies USING btree (type, slug)
- `taxonomies`: CREATE INDEX taxonomies_type_sort_idx ON public.taxonomies USING btree (type, sort_order)

## Triggers

- `artworks` `trg_artworks_draft_guard`:
  ```sql
  CREATE TRIGGER trg_artworks_draft_guard BEFORE INSERT OR UPDATE OF draft, enabled ON public.artworks FOR EACH ROW EXECUTE FUNCTION artworks_draft_forces_disabled()
  ```
- `artworks` `trg_artworks_slug_guard`:
  ```sql
  CREATE TRIGGER trg_artworks_slug_guard BEFORE INSERT OR UPDATE OF slug ON public.artworks FOR EACH ROW EXECUTE FUNCTION artworks_slug_not_numeric()
  ```
- `auth.users` `on_auth_user_created`:
  ```sql
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()
  ```
- `media_assets` `trg_media_assets_touch`:
  ```sql
  CREATE TRIGGER trg_media_assets_touch BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION media_assets_touch_updated_at()
  ```
- `profiles` `trg_profiles_touch`:
  ```sql
  CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_touch_updated_at()
  ```
- `realtime.subscription` `tr_check_filters`:
  ```sql
  CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters()
  ```
- `storage.buckets` `enforce_bucket_name_length_trigger`:
  ```sql
  CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length()
  ```
- `storage.buckets` `protect_buckets_delete`:
  ```sql
  CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()
  ```
- `storage.objects` `protect_objects_delete`:
  ```sql
  CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()
  ```
- `storage.objects` `update_objects_updated_at`:
  ```sql
  CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column()
  ```

## Functions


#### `artworks_draft_forces_disabled`

```sql
CREATE OR REPLACE FUNCTION public.artworks_draft_forces_disabled()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.draft IS TRUE AND NEW.enabled IS TRUE THEN
    NEW.enabled := false;
  END IF;
  RETURN NEW;
END;
$function$

```

#### `artworks_slug_not_numeric`

```sql
CREATE OR REPLACE FUNCTION public.artworks_slug_not_numeric()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.slug ~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'artworks.slug must not be purely numeric (got "%")', NEW.slug;
  END IF;
  RETURN NEW;
END;
$function$

```

#### `handle_new_user`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$

```

#### `is_admin`

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$function$

```

#### `is_admin_or_editor`

```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_editor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
  );
$function$

```

#### `media_assets_touch_updated_at`

```sql
CREATE OR REPLACE FUNCTION public.media_assets_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$

```

#### `profiles_touch_updated_at`

```sql
CREATE OR REPLACE FUNCTION public.profiles_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$

```

## Row Level Security

| table | rls_enabled | forced |
| :--- | :--- | :--- |
| `artwork_terms` | true | false |
| `artworks` | true | false |
| `inquiries` | true | false |
| `media_assets` | true | false |
| `pages` | true | false |
| `profiles` | true | false |
| `schema_migrations` | true | false |
| `settings` | true | false |
| `taxonomies` | true | false |

## Policies


- `artwork_terms` **Admins manage artwork_terms** (ALL) roles={authenticated}
  - USING: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'editor'::text])))))`
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'editor'::text])))))`

- `artwork_terms` **Public read artwork_terms** (SELECT) roles={public}
  - USING: `true`

- `artworks` **Admins full access to artworks** (ALL) roles={authenticated}
  - USING: `is_admin_or_editor()`
  - WITH CHECK: `is_admin_or_editor()`

- `artworks` **Public can view active artworks** (SELECT) roles={public}
  - USING: `((trashed = false) AND (draft = false))`

- `artworks` **Service role full access to artworks** (ALL) roles={service_role}
  - USING: `true`
  - WITH CHECK: `true`

- `inquiries` **Admins can view and manage inquiries** (ALL) roles={authenticated}
  - USING: `is_admin_or_editor()`
  - WITH CHECK: `is_admin_or_editor()`

- `inquiries` **Public can submit inquiries** (INSERT) roles={public}
  - WITH CHECK: `true`

- `inquiries` **Service role full access to inquiries** (ALL) roles={service_role}
  - USING: `true`
  - WITH CHECK: `true`

- `media_assets` **Admins full access to media assets** (ALL) roles={authenticated}
  - USING: `is_admin_or_editor()`
  - WITH CHECK: `is_admin_or_editor()`

- `media_assets` **Public can view media assets** (SELECT) roles={public}
  - USING: `true`

- `media_assets` **Service role full access to media assets** (ALL) roles={service_role}
  - USING: `true`
  - WITH CHECK: `true`

- `pages` **Admins full access to pages** (ALL) roles={authenticated}
  - USING: `is_admin_or_editor()`
  - WITH CHECK: `is_admin_or_editor()`

- `pages` **Public can view pages** (SELECT) roles={public}
  - USING: `true`

- `pages` **Service role full access to pages** (ALL) roles={service_role}
  - USING: `true`
  - WITH CHECK: `true`

- `profiles` **profiles_select_admin** (SELECT) roles={public}
  - USING: `is_admin()`

- `profiles` **profiles_select_own** (SELECT) roles={public}
  - USING: `(auth.uid() = id)`

- `settings` **Admins manage settings** (ALL) roles={authenticated}
  - USING: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))`
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))`

- `settings` **Public read settings** (SELECT) roles={public}
  - USING: `true`

- `taxonomies` **Admins manage taxonomies** (ALL) roles={authenticated}
  - USING: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'editor'::text])))))`
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'editor'::text])))))`

- `taxonomies` **Public read taxonomies** (SELECT) roles={public}
  - USING: `true`

## Row counts

| table | rows |
| :--- | ---: |
| `artwork_terms` | 0 |
| `artworks` | 138 |
| `inquiries` | 1 |
| `media_assets` | 152 |
| `pages` | 4 |
| `profiles` | 4 |
| `schema_migrations` | 12 |
| `settings` | 5 |
| `taxonomies` | 3 |

## Applied migrations (public.schema_migrations)

- `2026_09_01_baseline_core_tables.sql` — 2026-09-14T05:43:36.249Z
- `2026_09_12_cms_v1_1_slug_backfill.sql` — 2026-09-12T19:19:50.318Z
- `2026_09_12_cms_v1_profiles_roles.sql` — 2026-09-12T17:42:00.081Z
- `2026_09_12_cms_v1_taxonomies_settings.sql` — 2026-09-12T17:42:00.525Z
- `2026_09_13_cms_v2_1_artwork_drafts.sql` — 2026-09-13T20:21:10.432Z
- `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql` — 2026-09-13T23:59:54.706Z
- `2026_09_13_cms_v2_source_of_truth_backfill.sql` — 2026-09-12T20:31:24.912Z
- `2026_09_13_v2_9_security_rls_hardening.sql` — 2026-09-14T05:45:27.342Z
- `2026_09_14_v2_12_1_staff_scoped_policies.sql` — 2026-09-14T17:55:07.989Z
- `2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql` — 2026-09-14T17:27:29.096Z
- `2026_09_14_v2_13_1_inquiry_email_status.sql` — 2026-09-14T21:01:03.608Z
- `2026_09_v3_media_assets_extend.sql` — 2026-09-14T05:45:27.652Z
