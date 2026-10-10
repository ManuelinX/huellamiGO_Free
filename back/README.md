# HuellamiGO Back

API Express de HuellamiGO sobre Postgres puro.

## Stack actual

- Node.js + Express.
- Postgres con `pg`.
- Auth propia con JWT.
- Uploads locales servidos desde `/uploads`.
- PostGIS para alertas cercanas.
- Notificaciones in-app, Web Push, preferencias, perfil y presencia.

## Arranque

```bash
npm install
npm run dev
```

Produccion:

```bash
npm run start
```

## Documentación

La documentación vigente está en [`documentation/README.md`](./documentation/README.md).
Las propuestas y pendientes están en [`documentation/pendientes`](./documentation/pendientes/README.md).

Para una base nueva, ejecutar en orden los scripts de [`sql/current`](./sql/current):

1. `001_schema.sql`
2. `002_app_presence.sql`
3. `003_notification_logs.sql`
4. `004_notification_preferences.sql`
5. `005_web_push_subscriptions.sql`
6. `006_geocoding_cache.sql`
7. `007_geocoding_provider_usage.sql`
8. `008_sighting_digest_queue.sql`
9. `009_notification_priority_fields.sql`
10. `010_sighting_rate_limits.sql`
11. `011_nearby_sighting_update_queue.sql`
12. `012_rate_limit_buckets.sql`

No subir `.env`, uploads privados, logs ni backups pesados al repo.
