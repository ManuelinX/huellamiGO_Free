# Legacy Supabase

Esta nota existe para evitar confusiones con archivos históricos.

## Estado actual

El flujo vigente ya no usa Supabase para:

- Registro.
- Login.
- Sesión.
- Subida de fotos.

El backend actual usa:

- `public.app_users`
- JWT propio con `JWT_SECRET`
- uploads locales en `/uploads`
- `back/sql/current/001_schema.sql`
- `back/sql/current/002_app_presence.sql`
- `back/sql/current/003_notification_logs.sql`
- `back/sql/current/004_notification_preferences.sql`
- `back/sql/current/005_web_push_subscriptions.sql`
- `back/sql/current/006_geocoding_cache.sql`
- `back/sql/current/007_geocoding_provider_usage.sql`
- `back/sql/current/008_sighting_digest_queue.sql`
- `back/sql/current/009_notification_priority_fields.sql`
- `back/sql/current/010_sighting_rate_limits.sql`
- `back/sql/current/011_nearby_sighting_update_queue.sql`
- `back/sql/current/012_rate_limit_buckets.sql`

## Archivos SQL históricos

Los siguientes scripts pertenecen a la etapa Supabase o transición:

- `back/sql/legacy/supabase/001_nearby_alerts_postgis.sql`
- `back/sql/legacy/supabase/002_core_schema_profiles_first.sql`
- `back/sql/legacy/supabase/003_pet_reports_rpc_functions.sql`
- `back/sql/legacy/supabase/004_auth_profiles_trigger.sql`
- `back/sql/legacy/supabase/005_pet_photos_storage_policies.sql`
- `back/sql/legacy/supabase/006_app_auth.sql`

Para una instalación nueva en VPS/Postgres puro, usar `back/sql/current/`.

## Por qué no usar los scripts legacy en VPS

Algunos scripts anteriores contienen referencias a:

- `auth.users`
- `auth.uid()`
- RLS policies
- `storage.buckets`
- `storage.objects`

Esos objetos son propios de Supabase o de la etapa anterior del proyecto. En Postgres puro no existen salvo que los recrees manualmente, cosa que no es necesaria para el flujo actual.

## Cuando consultar legacy

Solo consultar estos archivos si necesitas entender decisiones anteriores o migrar datos desde una base Supabase existente. No son la ruta recomendada para bases nuevas.
