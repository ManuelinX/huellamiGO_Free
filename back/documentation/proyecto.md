# Proyecto y arquitectura

## Resumen

HuellamiGO Back usa Express y `pg` para hablar con Postgres. La arquitectura vigente ya no depende de Supabase Auth ni Supabase Storage:

- Los usuarios viven en `public.app_users`.
- Las sesiones se firman con JWT propio usando `JWT_SECRET`.
- Las fotos se suben al backend y se guardan en `back/uploads`.
- Los reportes, avistamientos y gestion privada pasan por rutas Express.
- Las alertas cercanas usan PostGIS.
- Web Push usa VAPID y suscripciones por navegador/dispositivo.

## Estructura importante

```text
src/
  app.js
  index.js
  db.js
  routes/
    auth.js
    notifications.js
    profile.js
    uploads.js
    reports.js
    manage.js
    nearby-alerts.js
  services/
    report-mapper.js
    nearby-alerts.js
    postgis.js
    notifications.js
    notification-preferences.js
    nearby-report-notifications.js
    web-push.js
    profile.js
  utils/
    auth.js
    rate-limit.js
    passwords.js
    http.js
    photos.js
sql/
  README.md
  current/
    001_schema.sql
    002_app_presence.sql
    003_notification_logs.sql
    004_notification_preferences.sql
    005_web_push_subscriptions.sql
  legacy/
    supabase/
documentation/
  README.md
  proyecto.md
  guia-de-cambios.md
  pendientes/
  vps-postgres.md
  legacy-supabase.md
```

## Entrada de la API

### `src/index.js`

- Carga variables con `dotenv`.
- Crea la app con `createApp()`.
- Levanta el servidor en `PORT` o `4000`.

### `src/app.js`

- Configura CORS.
- Configura `express.json()`.
- Sirve archivos estáticos desde `/uploads`.
- Declara health checks.
- Monta routers:
  - `/api/auth`
  - `/api/uploads`
  - `/api/reports`
  - `/api/manage`
  - `/api/nearby-alerts`
  - `/api/presence`
  - `/api/notifications`
  - `/api/profile`
- Centraliza manejo de errores.

## Base de datos

### Conexion

Archivo:

- `src/db.js`

Variables:

```env
DATABASE_URL=
DATABASE_SSL=false
```

Reglas:

- Si `DATABASE_SSL` existe, se respeta `true` o `false`.
- Si no existe y `DATABASE_URL` no apunta a `localhost`/`127.0.0.1`, se usa SSL.

### Schema vigente

Para una base nueva usar:

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

Tablas principales:

- `app_users`
- `profiles`
- `pet_reports`
- `pet_photos`
- `sightings`
- `notifications`
- `notification_logs`
- `notification_preferences`
- `web_push_subscriptions`
- `app_presence`
- `password_reset_tokens`
- `email_verification_tokens`
- `geocoding_cache`
- `geocoding_provider_usage`
- `sighting_digest_queue`
- `sighting_rate_limits`
- `nearby_sighting_update_queue`
- `rate_limit_buckets`

Extensiones:

- `pgcrypto`
- `postgis` en schema `gis`

## Auth

### Rutas

Archivo:

- `src/routes/auth.js`

Endpoints:

- `POST /api/auth/register`: crea usuario, perfil y devuelve JWT.
- `POST /api/auth/login`: valida credenciales y devuelve JWT.
- `GET /api/auth/me`: devuelve usuario actual usando `Authorization`.
- `POST /api/auth/password-reset/request`: genera enlace temporal de recuperación.
- `POST /api/auth/password-reset/confirm`: cambia la contraseña usando el token temporal.
- `POST /api/auth/password/change`: cambia la contraseña del usuario autenticado.
- `POST /api/auth/email-verification/request`: reenvía enlace de verificación al usuario autenticado.
- `POST /api/auth/email-verification/confirm`: verifica el correo con token temporal.

Los endpoints sensibles de auth tienen rate limiting en memoria por IP:

- Registro: 5 intentos por hora.
- Login: 5 intentos cada 15 minutos.
- Solicitud de recuperación: 3 intentos cada 15 minutos.
- Confirmación de recuperación: 5 intentos cada 15 minutos.
- Cambio de contraseña: 5 intentos cada 15 minutos.
- Solicitud de verificación: 3 intentos cada 15 minutos.
- Confirmación de verificación: 8 intentos cada 15 minutos.

Si se excede el limite, la API responde `429` con `Retry-After`.

Politica de email verificado:

- Usuarios no verificados pueden registrarse, iniciar sesion, navegar y ver reportes.
- `POST /api/reports` requiere correo verificado.
- `POST /api/reports/:id/sightings` requiere correo verificado.
- El backend valida `email_verified_at` contra base de datos antes de permitir esas acciones.

### Passwords

Archivo:

- `src/utils/passwords.js`

Usa `crypto.scrypt` para hash y verificacion de passwords.

### JWT

Archivo:

- `src/utils/auth.js`

Variable:

```env
JWT_SECRET=
```

Funcionamiento:

- Lee `Authorization: Bearer ...`.
- Valida firma HS256.
- Revisa expiracion `exp`.
- Usa `claims.sub` como `user.id`.

### Email transaccional

Archivo:

- `src/services/email.js`

Variables:

```env
FRONTEND_URL=
EMAIL_PROVIDER=smtp
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
RESEND_API_KEY=
```

`EMAIL_PROVIDER` acepta `smtp` o `resend`. Si no se configura, el backend elige `smtp` cuando existen `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`; si no, elige `resend` cuando existe `RESEND_API_KEY`. En desarrollo, `/api/auth/password-reset/request` devuelve `resetUrl` para probar el flujo sin proveedor de email.

## Uploads

Archivo:

- `src/routes/uploads.js`

Endpoint:

- `POST /api/uploads/pet-photo`

Funcionamiento:

- Requiere JWT.
- Recibe `multipart/form-data` con campo `photo`.
- Acepta imagen WebP optimizada por el frontend.
- Guarda en `back/uploads/pet-photos/<userId>/<uuid>.webp`.
- Responde `publicUrl`, `storagePath`, `contentType` y `sizeBytes`.

Variable recomendada:

```env
PUBLIC_API_URL=http://localhost:4000
```

En VPS debe apuntar al dominio público de la API.

## Rutas de reportes

### `/api/reports`

Archivo:

- `src/routes/reports.js`

Endpoints:

- `GET /api/reports`: lista reportes activos.
- `GET /api/reports/reunion-stories`: lista historias publicas de reencuentro.
- `GET /api/reports/mine`: lista reportes propios no archivados.
- `GET /api/reports/map`: devuelve clusters o reportes según `bbox` y `zoom`.
- `POST /api/reports`: crea reporte autenticado.
- `GET /api/reports/:id`: obtiene reporte público activo.
- `GET /api/reports/:id/sightings`: lista avistamientos.
- `POST /api/reports/:id/sightings`: crea avistamiento autenticado.

### `/api/manage`

Archivo:

- `src/routes/manage.js`

Endpoints:

- `GET /api/manage/:id?token=...`
- `PATCH /api/manage/:id/status?token=...`
- `PATCH /api/manage/:id/sightings/:sightingId?token=...`

Reglas:

- El token privado se compara contra `pet_reports.manage_token`.
- Al archivar, `manage_token` se limpia.
- Al marcar reunida, `manage_expires_at` se mueve 7 dias al futuro.
- Reportes archivados no se gestionan.

### `/api/nearby-alerts`

Archivos:

- `src/routes/nearby-alerts.js`
- `src/services/nearby-alerts.js`
- `src/services/postgis.js`

Endpoint:

- `GET /api/nearby-alerts?lat=...&lng=...&radiusKm=3&recentHours=72&limit=30`

Requiere PostGIS instalado en el schema configurado por `POSTGIS_SCHEMA`, por defecto `gis`.

### `/api/notifications`

Archivos:

- `src/routes/notifications.js`
- `src/services/notifications.js`
- `src/services/notification-preferences.js`
- `src/services/nearby-report-notifications.js`

Endpoints:

- `GET /api/notifications?limit=30`: lista notificaciones del usuario autenticado.
- `GET /api/notifications/unread-count`: devuelve conteo de no leidas.
- `GET /api/notifications/preferences`: devuelve preferencias actuales o defaults.
- `PATCH /api/notifications/preferences`: actualiza radio, ubicacion de alerta y toggles.
- `GET /api/notifications/push/config`: devuelve estado y llave publica VAPID.
- `GET /api/notifications/push/subscriptions`: lista suscripciones activas del usuario.
- `POST /api/notifications/push/subscriptions`: guarda o reactiva una suscripcion.
- `DELETE /api/notifications/push/subscriptions`: desactiva una suscripcion o todas las del usuario.
- `PATCH /api/notifications/read-all`: marca todas como leidas.
- `PATCH /api/notifications/:id/read`: marca una notificacion como leida.

Cuando se crea un reporte, `notifyNearbyUsersAboutReport()` busca usuarios con `notification_preferences` dentro del radio configurado y crea notificaciones `nearby_report` con deduplicacion en `notification_logs`.

Si Web Push esta configurado y el usuario tiene una suscripcion activa, tambien intenta enviar canal `web_push`. Si faltan llaves VAPID o no hay suscripcion activa, el log queda como `skipped`.

### `/api/profile`

Archivos:

- `src/routes/profile.js`
- `src/services/profile.js`

Endpoints:

- `GET /api/profile`: devuelve el perfil del usuario autenticado.
- `PATCH /api/profile`: actualiza nombre visible, bio, telefono, ciudad y estado.
- `POST /api/profile/avatar`: sube avatar WebP optimizado a `uploads/profile-avatars`.

### `/api/presence`

Archivo:

- `src/routes/presence.js`

Endpoints:

- `GET /api/presence`: devuelve el número de visitantes activos.
- `POST /api/presence/heartbeat`: registra actividad del navegador y devuelve el conteo activo.

Cuenta como activo a cada visitante visto en los últimos 2 minutos.

## Problema actual de producto

La API ya sostiene reportes, avistamientos, notificaciones y geoespacial básico. La brecha de la siguiente beta es convertir esas piezas en seguimiento de búsqueda: rastro temporal, pistas priorizadas, zona activa y acciones privadas del dueño. Ver [Problema actual de esta versión](../../front/documentation/problema-actual-version.md).

## Documentación no vigente

Las propuestas y análisis futuros viven en `documentation/pendientes/`. No deben leerse como estado operativo actual sin una revisión previa.

## Modelo de datos

### `app_users`

Usuarios de autenticacion propia.

Campos clave:

- `id`
- `email`
- `password_hash`
- `display_name`
- `status`

### `profiles`

Perfil público/operativo del usuario.

Campos clave:

- `id`
- `display_name`
- `username`
- `avatar_url`
- `city`, `state`, `country`

### `pet_reports`

Reporte principal de mascota perdida.

Estados:

- `active`: visible publicamente.
- `reunited`: cerrado como reunido.
- `archived`: oculto y sin gestion publica.

### `pet_photos`

Metadata de fotos. El archivo fisico vive en `back/uploads` o en el storage que se configure mas adelante.

Tipos:

- `report`
- `sighting`
- `reunion`

### `sightings`

Avistamientos enviados por usuarios.

Estados:

- `visible`
- `pending`
- `hidden`

### `app_presence`

Presencia ligera para estadisticas de comunidad.

Campos clave:

- `visitor_id`
- `profile_id`
- `first_seen_at`
- `last_seen_at`
- `user_agent`

### `notification_logs`

Registro de notificaciones creadas/enviadas para evitar duplicados.

Campos clave:

- `profile_id`
- `notification_type`
- `channel`
- `dedupe_key`
- `status`

### `notification_preferences`

Preferencias de alertas por perfil.

Campos clave:

- `notify_sighting_updates`
- `notify_nearby_reports`
- `radius_km`
- `alert_lat`
- `alert_lng`
- `alert_place_label`
- `location_source`

### `web_push_subscriptions`

Suscripciones Web Push por navegador/dispositivo.

Campos clave:

- `profile_id`
- `endpoint`
- `p256dh`
- `auth`
- `expiration_time`
- `disabled_at`

### `password_reset_tokens`

Tokens temporales hasheados para recuperación de contraseña.

Campos clave:

- `user_id`
- `token_hash`
- `expires_at`
- `used_at`

### `email_verification_tokens`

Tokens temporales hasheados para verificar el correo de una cuenta.

Campos clave:

- `user_id`
- `token_hash`
- `expires_at`
- `used_at`

## Problemas comunes

### La API no conecta a Postgres

Revisar:

- `DATABASE_URL`.
- `DATABASE_SSL`.
- `GET /api/db-test`.
- Que el usuario de Postgres tenga permisos sobre `public` y `gis`.

### Registro o login fallan

Revisar:

- `JWT_SECRET`.
- Que exista `public.app_users`.
- Que `profiles.id` referencie `app_users(id)`.
- Endpoint `/api/auth/register`.

### Peticiones autenticadas fallan

Revisar:

- Header `Authorization`.
- Token en el frontend.
- Expiración del JWT.
- `JWT_SECRET` igual entre sesiones del backend.

### Fotos no aparecen

Revisar:

- Carpeta `back/uploads`.
- Permisos de escritura.
- `PUBLIC_API_URL`.
- Que Express sirva `/uploads`.
- Que `pet_photos.public_url` sea accesible desde el navegador.

### Avatar no aparece

Revisar:

- Carpeta `back/uploads/profile-avatars`.
- Permisos de escritura.
- `PUBLIC_API_URL`.
- Que el frontend suba WebP de maximo 32KB.

### Alertas cercanas fallan

Revisar:

- Extensión PostGIS instalada.
- `POSTGIS_SCHEMA=gis`.
- Indices geoespaciales creados por `back/sql/current/001_schema.sql`.
- `notification_preferences` creado por `back/sql/current/004_notification_preferences.sql`.

### Web Push no se activa

Revisar:

- `WEB_PUSH_VAPID_PUBLIC_KEY`.
- `WEB_PUSH_VAPID_PRIVATE_KEY`.
- `WEB_PUSH_SUBJECT`.
- `back/sql/current/005_web_push_subscriptions.sql`.
- Que el frontend corra en HTTPS o `localhost`.
- Que el navegador no tenga bloqueado el permiso de notificaciones.
