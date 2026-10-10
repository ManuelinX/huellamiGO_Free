# SQL

## Current

Para una instalación nueva en VPS/Postgres puro, ejecutar en orden:

1. `current/001_schema.sql`
2. `current/002_app_presence.sql`
3. `current/003_notification_logs.sql`
4. `current/004_notification_preferences.sql`
5. `current/005_web_push_subscriptions.sql`
6. `current/006_geocoding_cache.sql`
7. `current/007_geocoding_provider_usage.sql`
8. `current/008_sighting_digest_queue.sql`
9. `current/009_notification_priority_fields.sql`
10. `current/010_sighting_rate_limits.sql`
11. `current/011_nearby_sighting_update_queue.sql`
12. `current/012_rate_limit_buckets.sql`
13. `current/013_sighting_trail_keys.sql`
14. `current/014_reviewed_search_zones.sql`
15. `current/015_beta_testers.sql`
16. `current/016_mobile_push_tokens.sql`

Estos archivos son la fuente vigente del schema de HuellamiGO.

## Legacy

Los scripts históricos de la etapa Supabase están en:

- `legacy/supabase/`

No usarlos para una base nueva de VPS/Postgres puro.
