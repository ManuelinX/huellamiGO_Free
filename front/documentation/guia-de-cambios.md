# Guia de archivos por cambio

Esta guia responde: "si quiero cambiar algo en el front, que archivo tengo que tocar?".

## Pagina principal

Cambiar textos, secciones, comunidad, estadisticas, aliados o estructura del home:

- `app/page.js`
- `app/globals.css`

Cambiar el mapa principal de mascotas perdidas:

- `components/lost-pet-map.js`
- `components/leaflet-map.js`
- `components/leaflet-map-utils.js`
- `lib/reports.js`
- `app/page.js`
- `app/globals.css`
- Backend: `back/src/routes/reports.js`
- Backend: `back/src/services/report-map.js`

Cambiar acciones rapidas o barra inferior:

- `app/page.js`
- `components/bottom-nav.js`
- `app/globals.css`

## Auth y sesion

Cambiar registro, login o logout:

- `components/auth-button.js`
- `components/auth-provider.js`
- `lib/auth.js`
- `lib/auth-session.js`

Cambiar recuperacion de contrasena:

- `components/auth-button.js`
- `components/change-password-panel.js`
- `lib/auth.js`
- Backend: `back/src/routes/auth.js`
- Backend: `back/src/services/email.js`
- Backend: `back/src/utils/rate-limit.js`
- SQL: `back/sql/current/001_schema.sql`

Cambiar verificacion de correo:

- `components/auth-button.js`
- `components/email-verification-banner.js`
- `components/report-form.js`
- `components/sighting-form.js`
- `lib/auth.js`
- Backend: `back/src/routes/auth.js`
- Backend: `back/src/routes/reports.js`
- Backend: `back/src/utils/auth.js`
- Backend: `back/src/services/email.js`
- Backend: `back/src/utils/rate-limit.js`
- SQL: `back/sql/current/001_schema.sql`

Cambiar perfil de usuario o avatar:

- `app/perfil/page.js`
- `components/profile-button.js`
- `components/profile-edit-panel.js`
- `lib/profile.js`
- `lib/image-processing.js`
- Backend: `back/src/routes/profile.js`
- Backend: `back/src/services/profile.js`
- SQL: `back/sql/current/001_schema.sql`

Cambiar como se guarda o valida la sesion local:

- `lib/auth-session.js`
- `components/auth-provider.js`

Cambiar como se manda el token al backend:

- `lib/api.js`
- Backend: `back/src/utils/auth.js`

Cambiar historial de reportes del usuario:

- `components/my-reports-button.js`
- `lib/reports.js`
- Backend: `back/src/routes/reports.js`

## Reportar mascota perdida

Cambiar campos del formulario:

- `components/report-form.js`
- `components/report-location-map.js`
- `components/location-picker.js`
- `lib/reports.js`
- Backend: `back/src/routes/reports.js`
- SQL si hay columnas nuevas: `back/sql/current/001_schema.sql`

Cambiar validaciones:

- `components/report-form.js`
- Backend si aplica: `back/src/routes/reports.js`

Cambiar subida de fotos:

- `components/report-form.js`
- `lib/reports.js`
- `lib/image-processing.js`
- Backend: `back/src/routes/uploads.js`

Cambiar recompensa:

- `components/report-form.js`
- `lib/reports.js`
- `app/page.js`
- `app/mascotas/[slug]/page.js`
- `app/gestionar/[id]/page.js`
- Backend: `back/src/routes/reports.js`
- SQL: `back/sql/current/001_schema.sql`

## Pagina publica de mascota

Cambiar layout o textos de `/mascotas/[slug]`:

- `app/mascotas/[slug]/page.js`
- `app/globals.css`

Cambiar informacion que se muestra del reporte publico:

- `app/mascotas/[slug]/page.js`
- `lib/reports.js`
- Backend: `back/src/services/report-mapper.js`
- Backend: `back/src/routes/reports.js`

Cambiar el formulario "La vi":

- `components/sighting-form.js`
- `lib/image-processing.js`
- `lib/sightings.js`
- Backend: `back/src/routes/reports.js`
- SQL si hay columnas nuevas: `back/sql/current/001_schema.sql`

Cambiar lista publica de avistamientos:

- `app/mascotas/[slug]/page.js`
- `lib/sightings.js`
- `app/globals.css`
- Backend: `back/src/routes/reports.js`

Cambiar mapa de actividad:

- `components/sighting-activity-map.js`
- `components/sighting-activity-map-client.js`
- `app/globals.css`

## Gestion privada

Cambiar pagina `/gestionar/[id]?token=...`:

- `app/gestionar/[id]/page.js`
- `components/manage-report-page-client.js`
- `lib/manage.js`
- `app/globals.css`
- Backend: `back/src/routes/manage.js`

Cambiar acciones como "Marcar como reunida" u "Ocultar reporte":

- `components/manage-report-actions.js`
- `lib/manage.js`
- `lib/reports.js` para subida de fotos
- Backend: `back/src/routes/manage.js`
- SQL si hay columnas nuevas: `back/sql/current/001_schema.sql`

Cambiar historia de reencuentro:

- `components/manage-report-actions.js`
- `lib/manage.js`
- `lib/reports.js` para subida de fotos
- `components/reunion-story-list.js`
- `app/globals.css`
- Backend: `back/src/routes/manage.js`
- Backend: `back/src/routes/reports.js`

Cambiar gestion de avistamientos privados:

- `components/manage-sightings-panel.js`
- `lib/manage.js`
- `lib/sightings.js` para normalización de pistas
- `app/gestionar/[id]/page.js`
- `app/globals.css`
- Backend: `back/src/routes/manage.js`

## Historias y finales felices

Cambiar bloque "Finales felices":

- `components/reunion-story-list.js`
- `app/page.js`
- `lib/reports.js`
- `app/globals.css`
- Backend: `back/src/routes/reports.js`

Cambiar que historias se muestran:

- `lib/reports.js`
- Backend: `back/src/routes/reports.js`

## Notificaciones

Cambiar boton, bandeja o lectura de notificaciones:

- `components/notifications-button.js`
- `lib/notifications.js`
- Backend: `back/src/routes/notifications.js`
- Backend: `back/src/services/notifications.js`
- SQL: `back/sql/current/003_notification_logs.sql`

Cambiar preferencias de notificaciones cercanas:

- `app/perfil/page.js`
- `components/notification-preferences-panel.js`
- `lib/notifications.js`
- Backend: `back/src/routes/notifications.js`
- Backend: `back/src/services/notification-preferences.js`
- Backend: `back/src/services/nearby-report-notifications.js`
- SQL: `back/sql/current/004_notification_preferences.sql`

Cambiar Web Push:

- `components/push-notification-toggle.js`
- `public/huellamigo-sw.js`
- `lib/notifications.js`
- `app/globals.css`
- Backend: `back/src/routes/notifications.js`
- Backend: `back/src/services/web-push.js`
- Backend: `back/src/services/notifications.js`
- SQL: `back/sql/current/005_web_push_subscriptions.sql`

## Datos y API

Cambiar URL base, headers, cache, `FormData` o manejo de errores HTTP:

- `lib/api.js`

Lectura, creacion y gestion de reportes:

- `lib/reports.js`
- Backend: `back/src/routes/reports.js`
- Backend: `back/src/routes/manage.js`

Lectura, creacion y gestion de avistamientos:

- `lib/sightings.js`
- Backend: `back/src/routes/reports.js`
- Backend: `back/src/routes/manage.js`

Optimizacion de imagenes antes de subir:

- `lib/image-processing.js`
- `lib/reports.js`

Datos de respaldo/demo:

- `lib/mock-data.js`

## Estilos

Cambiar la mayoria de estilos visuales:

- `app/globals.css`

Cambiar logo o imagen publica:

- `public/huellamigo.png`

## Legacy Supabase

El front actual no usa Supabase. Si aparece una referencia a `supabase`, `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, tratarla como legacy y revisar [Legacy Supabase](./legacy-supabase.md).

## Cuando agregues algo nuevo

1. Si es UI, empieza por el componente o pagina.
2. Si necesita datos, revisa `lib/reports.js`, `lib/sightings.js`, `lib/notifications.js`, `lib/profile.js` o `lib/api.js`.
3. Si necesita auth, revisa `lib/auth.js`, `lib/auth-session.js` y backend `/api/auth`.
4. Si necesita un contrato nuevo, cambia el backend.
5. Si necesita columnas o indices, actualiza el script correspondiente en `back/sql/current/`.
6. Si necesita estilo, agrega clases en `app/globals.css`.
7. Corre `npm run build`.
