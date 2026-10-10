# Documentación de HuellamiGO Back

HuellamiGO Back es una API Express sobre Postgres. El runtime actual usa:

- Postgres directo mediante `pg`.
- Auth propia con `app_users`, password hash y JWT.
- Uploads locales servidos desde `/uploads`.
- PostGIS para alertas cercanas.
- Notificaciones in-app con preferencias por usuario.
- Web Push como canal opcional para navegadores/dispositivos suscritos.
- Perfil editable con avatar local en WebP.

Supabase ya no es requerido para el flujo nuevo de autenticación, reportes ni fotos.

## Documentación vigente

- [Proyecto y arquitectura](./proyecto.md): estructura actual del backend, rutas, auth, uploads y datos.
- [Guía de archivos por cambio](./guia-de-cambios.md): dónde tocar código según el cambio.
- [Operación VPS/Postgres](./vps-postgres.md): pasos para desplegar en VPS con Postgres puro.
- [Guía de notificaciones](./guia_notificaciones.md): preferencias, Web Push y colas de notificación.
- [Generar llaves VAPID](./GENERAR-LLAVES-VAPID.md): setup de Web Push.
- [Vaciar base de datos](./vaciar-base-datos.md): operación controlada para entornos de prueba.
- [Legacy Supabase](./legacy-supabase.md): notas de los scripts/documentos anteriores basados en Supabase.
- [Pendientes y stand by](./pendientes/README.md): propuestas y análisis no vigentes.
- [Problema actual de esta versión](../../front/documentation/problema-actual-version.md): problema de producto que afecta front y back.

## Rutas principales

- `GET /`: health check básico.
- `GET /api/db-test`: prueba de conexión a base de datos.
- `/api/auth`: registro, login y usuario actual.
- `/api/uploads`: subida de fotos.
- `/api/reports`: reportes publicos, propios, historias y avistamientos.
- `/api/manage`: gestion privada por `manage_token`.
- `/api/nearby-alerts`: búsqueda geoespacial de reportes y avistamientos cercanos.
- `/api/notifications`: bandeja, conteo no leído y preferencias.
- `/api/notifications/push`: configuración y suscripciones Web Push.
- `/api/profile`: lectura/edición de perfil y avatar.
- `/api/presence`: contador ligero de visitantes activos.

## Comandos útiles

```bash
npm run dev
npm run start
```

## Variables necesarias

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
PUBLIC_API_URL=http://localhost:4000
DATABASE_URL=postgres://...
DATABASE_SSL=false
JWT_SECRET=una_clave_larga_random
POSTGIS_SCHEMA=gis
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=smtp
EMAIL_FROM=HuellamiGO <contacto@tu-dominio.com>
SMTP_HOST=smtp.ionos.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contacto@tu-dominio.com
SMTP_PASS=
RESEND_API_KEY=
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:contacto@tu-dominio.com
```

## SQL vigente para VPS/Postgres puro

Ejecutar en orden:

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

Los scripts históricos de la etapa Supabase/desarrollo quedan en `back/sql/legacy/supabase/`. No usarlos para una instalación nueva de VPS salvo que sepas exactamente qué parte necesitas.

## Estado de esta versión

El backend ya cubre reporte, avistamientos, auth, correo, notificaciones y geoespacial básico. La siguiente brecha es modelar seguimiento de búsqueda: pistas priorizadas, rastro temporal, zona activa y acciones privadas del dueño; ver [Problema actual de esta versión](../../front/documentation/problema-actual-version.md).
