# Guia de archivos por cambio

Esta guia responde: "si quiero cambiar algo en el backend, que archivo tengo que tocar?".

## Servidor y configuracion

Cambiar puerto, arranque o carga de variables:

- `src/index.js`
- `.env`

Cambiar CORS, middlewares globales, rutas montadas o archivos estaticos:

- `src/app.js`

Cambiar conexion a base de datos:

- `src/db.js`
- Variables: `DATABASE_URL`, `DATABASE_SSL`

Cambiar manejo global de errores:

- `src/app.js`
- `src/utils/http.js`

## Auth propia

Cambiar registro, login o usuario actual:

- `src/routes/auth.js`
- `src/utils/passwords.js`
- `src/utils/auth.js`

Cambiar recuperacion de contrasena:

- `src/routes/auth.js`
- `src/services/email.js`
- `src/utils/rate-limit.js`
- `sql/current/001_schema.sql`
- Front: `front/components/auth-button.js`
- Front: `front/lib/auth.js`

Cambiar limites de intentos en auth:

- `src/routes/auth.js`
- `src/utils/rate-limit.js`

Cambiar verificacion de correo:

- `src/routes/auth.js`
- `src/routes/reports.js`
- `src/utils/auth.js`
- `src/services/email.js`
- `src/utils/rate-limit.js`
- `sql/current/001_schema.sql`
- Front: `front/components/auth-button.js`
- Front: `front/components/email-verification-banner.js`
- Front: `front/lib/auth.js`

Cambiar emision o validacion de JWT:

- `src/utils/auth.js`
- Variable: `JWT_SECRET`

Cambiar hash de passwords:

- `src/utils/passwords.js`

Cambiar tabla de usuarios o perfiles:

- `sql/current/001_schema.sql`

Cambiar perfil editable o avatar:

- `src/routes/profile.js`
- `src/services/profile.js`
- `sql/current/001_schema.sql`
- Front: `front/app/perfil/page.js`
- Front: `front/components/profile-edit-panel.js`
- Front: `front/lib/profile.js`

## Uploads

Cambiar subida de fotos:

- `src/routes/uploads.js`
- `src/app.js`
- `src/utils/auth.js`

Cambiar URL publica generada para fotos:

- `src/routes/uploads.js`
- Variable: `PUBLIC_API_URL`

Cambiar carpeta persistente:

- `src/routes/uploads.js`
- `src/app.js`
- Configuracion de VPS/Nginx/PM2.

## Reportes publicos

Cambiar lista de reportes activos:

- `src/routes/reports.js`
- `src/services/report-mapper.js`

Cambiar mapa por viewport o clustering:

- `src/routes/reports.js`
- `src/services/report-map.js`
- SQL si hay indices nuevos: `sql/current/001_schema.sql`
- Front: `front/components/leaflet-map.js`
- Front: `front/components/leaflet-map-utils.js`
- Front: `front/lib/reports.js`

Cambiar historial de reportes propios:

- `src/routes/reports.js`
- `src/services/report-mapper.js`
- Front: `front/components/my-reports-button.js`
- Front: `front/lib/reports.js`

Cambiar detalle publico de reporte:

- `src/routes/reports.js`
- `src/services/report-mapper.js`

Cambiar creacion de reportes:

- `src/routes/reports.js`
- `src/utils/photos.js`
- SQL si hay columnas nuevas: `sql/current/001_schema.sql`

Cambiar campos enviados al front:

- `src/services/report-mapper.js`
- Front si cambia contrato: `front/lib/reports.js`

## Gestion privada

Cambiar carga privada por token:

- `src/routes/manage.js`

Cambiar reglas para marcar `active`, `reunited` o `archived`:

- `src/routes/manage.js`
- SQL si hay columnas nuevas: `sql/current/001_schema.sql`

Cambiar expiracion del link privado:

- `src/routes/manage.js`

Cambiar historia de reencuentro:

- `src/routes/manage.js`
- `src/routes/reports.js`
- `src/services/report-mapper.js`
- SQL si hay columnas nuevas: `sql/current/001_schema.sql`

## Avistamientos

Cambiar lista publica o privada de avistamientos:

- `src/routes/reports.js`
- `src/services/report-mapper.js`

Cambiar creacion de avistamientos:

- `src/routes/reports.js`
- `src/utils/photos.js`
- SQL si hay columnas nuevas: `sql/current/001_schema.sql`

Cambiar estados de avistamientos:

- `src/routes/manage.js`
- SQL constraint: `sql/current/001_schema.sql`

Cambiar confianza o reglas de pendiente/visible:

- `src/routes/reports.js`
- SQL si cambia rango: `sql/current/001_schema.sql`

## Alertas cercanas

Cambiar endpoint o filtros HTTP:

- `src/routes/nearby-alerts.js`

Cambiar consulta geoespacial:

- `src/services/nearby-alerts.js`

Cambiar esquema de PostGIS:

- `src/services/postgis.js`
- Variable: `POSTGIS_SCHEMA`
- SQL: `sql/current/001_schema.sql`

## Notificaciones

Cambiar bandeja, lectura o conteo no leido:

- `src/routes/notifications.js`
- `src/services/notifications.js`
- SQL: `sql/current/001_schema.sql`
- SQL: `sql/current/003_notification_logs.sql`
- Front: `front/components/notifications-button.js`
- Front: `front/lib/notifications.js`

Cambiar preferencias de notificaciones:

- `src/routes/notifications.js`
- `src/services/notification-preferences.js`
- SQL: `sql/current/004_notification_preferences.sql`
- Front: `front/components/notification-preferences-panel.js`
- Front: `front/lib/notifications.js`

Cambiar Web Push:

- `src/routes/notifications.js`
- `src/services/web-push.js`
- `src/services/notifications.js`
- SQL: `sql/current/005_web_push_subscriptions.sql`
- Front: `front/components/push-notification-toggle.js`
- Front: `front/public/huellamigo-sw.js`
- Front: `front/lib/notifications.js`

Cambiar notificaciones automaticas por reporte cercano:

- `src/services/nearby-report-notifications.js`
- `src/services/notifications.js`
- `src/services/postgis.js`
- SQL: `sql/current/003_notification_logs.sql`
- SQL: `sql/current/004_notification_preferences.sql`
- SQL: `sql/current/005_web_push_subscriptions.sql`

## SQL y base de datos

Para instalaciones nuevas de VPS/Postgres puro:

- `sql/current/001_schema.sql`
- `sql/current/002_app_presence.sql`
- `sql/current/003_notification_logs.sql`
- `sql/current/004_notification_preferences.sql`
- `sql/current/005_web_push_subscriptions.sql`
- `sql/current/006_geocoding_cache.sql`
- `sql/current/007_geocoding_provider_usage.sql`
- `sql/current/008_sighting_digest_queue.sql`
- `sql/current/009_notification_priority_fields.sql`
- `sql/current/010_sighting_rate_limits.sql`
- `sql/current/011_nearby_sighting_update_queue.sql`
- `sql/current/012_rate_limit_buckets.sql`

Los scripts de `sql/legacy/supabase/` son historicos de la etapa Supabase. Consultar [Legacy Supabase](./legacy-supabase.md) antes de usarlos.

## Cuando agregues algo nuevo

1. Define si el cambio es API, SQL, auth, upload o contrato con front.
2. Cambia la ruta o servicio correspondiente.
3. Actualiza `src/services/report-mapper.js` si cambia el shape que consume el front.
4. Actualiza `sql/current/001_schema.sql` si hay columnas, indices o constraints nuevos.
5. Actualiza documentacion en `back/documentation/` y, si afecta UI, tambien en `front/documentation/`.
6. Ejecuta el flujo manual o prueba el endpoint afectado.
