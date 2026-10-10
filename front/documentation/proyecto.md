# Proyecto y arquitectura

## Resumen

HuellamiGO Front usa Next.js con App Router. La app combina componentes de servidor para cargar datos desde el backend y componentes cliente para formularios, mapas, auth e interacciones.

Flujos principales:

- Crear cuenta, iniciar sesión y cerrar sesión con auth propia del backend.
- Crear reporte de mascota perdida.
- Mostrar reportes activos en mapa y lista.
- Registrar avistamientos con foto, comentario y coordenadas.
- Gestionar reportes con link privado.
- Marcar mascota como reunida y publicar historia de reencuentro.
- Ocultar reportes archivados y avistamientos falsos.
- Activar Web Push por navegador/dispositivo desde el perfil.

Problema de producto vigente:

- La versión actual permite reportar y recibir avistamientos, pero todavía no convierte el reporte en una búsqueda guiada con rastro. La siguiente beta debe enfocarse en seguimiento de pistas; ver [Problema actual de esta versión](./problema-actual-version.md).

## Estructura importante

```text
app/
  page.js
  layout.js
  globals.css
  mascotas/[slug]/page.js
  gestionar/[id]/page.js
  perfil/page.js
components/
  auth-button.js
  auth-provider.js
  bottom-nav.js
  my-reports-button.js
  notifications-button.js
  notification-preferences-panel.js
  push-notification-toggle.js
  profile-button.js
  profile-edit-panel.js
  change-password-panel.js
  email-verification-banner.js
  report-form.js
  report-location-map.js
  location-picker.js
  sighting-form.js
  manage-report-actions.js
  manage-sightings-panel.js
  reunion-story-list.js
  lost-pet-map.js
  leaflet-map.js
  leaflet-map-utils.js
  sighting-activity-map.js
  sighting-activity-map-client.js
lib/
  api.js
  auth.js
  auth-session.js
  reports.js
  sightings.js
  notifications.js
  profile.js
  manage.js
  image-processing.js
  mock-data.js
public/
  huellamigo.png
  huellamigo-sw.js
documentation/
  README.md
  proyecto.md
  guia-de-cambios.md
  problema-actual-version.md
  legacy-supabase.md
  pendientes/
```

## Rutas de la app

### `/`

Archivo:

- `app/page.js`

Responsabilidades:

- Carga reportes activos con `getLostPetReports()`.
- Carga historias publicas con `getPublicReunionStories()`.
- Muestra mapa, lista de mascotas perdidas, formulario de reporte y Comunidad.
- El mapa consulta `/api/reports/map` con `bbox` y `zoom`; el backend responde clusters o reportes.
- Muestra acceso a "Mis reportes" para usuarios autenticados.
- Muestra acceso a perfil, notificaciones y banner de verificación de correo.
- Si no hay datos reales, usa `lib/mock-data.js` como respaldo visual.

### `/mascotas/[slug]`

Archivo:

- `app/mascotas/[slug]/page.js`

Responsabilidades:

- Muestra un reporte público activo.
- Muestra mapa de actividad de avistamientos.
- Permite mandar un avistamiento con el formulario "La vi".
- Convierte 404 reales del backend en `notFound()`.
- Deja pasar errores técnicos para no esconder fallos de backend como 404.

### `/gestionar/[id]#token=...`

Archivo:

- `app/gestionar/[id]/page.js`

Responsabilidades:

- Intercambia el fragmento `#token=...` por una cookie temporal `httpOnly`.
- Carga reporte privado con `GET /api/manage/:id` usando sesión temporal de gestión.
- Permite marcar como reunida o archivar.
- Permite agregar historia de reencuentro.
- Muestra resumen del reporte.
- Permite gestionar avistamientos.
- Si el reporte ya no es público, muestra "Volver al mapa" en vez de enlazar a `/mascotas/[id]`.

### `/perfil`

Archivo:

- `app/perfil/page.js`

Responsabilidades:

- Carga el perfil autenticado con `GET /api/profile`.
- Permite editar nombre visible, bio, teléfono, ciudad y estado.
- Permite subir avatar WebP.
- Permite cambiar contrasena.
- Permite configurar preferencias de notificaciones cercanas.
- Permite activar o desactivar Web Push en el dispositivo actual.

## Datos y API

### Conexion al backend

Archivo:

- `lib/api.js`

Variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`apiFetch()` centraliza llamadas HTTP. Si se pasa `auth: true`, lee el JWT local y manda:

```text
Authorization: Bearer <token>
```

También soporta `FormData` para uploads sin forzar `Content-Type: application/json`.

## Auth

Archivos:

- `lib/auth.js`
- `lib/auth-session.js`
- `components/auth-provider.js`
- `components/auth-button.js`

Funcionamiento:

- `POST /api/auth/register` crea cuenta.
- `POST /api/auth/login` inicia sesión.
- `GET /api/auth/me` valida la sesión guardada.
- `POST /api/auth/password-reset/request` solicita recuperación.
- `POST /api/auth/password-reset/confirm` confirma recuperación.
- `POST /api/auth/password/change` cambia contraseña autenticada.
- `POST /api/auth/email-verification/request` reenvía verificación.
- `POST /api/auth/email-verification/confirm` confirma correo.
- El token se guarda en `localStorage` bajo `HuellamiGO:auth-session`.
- Logout borra la sesión local.

Los usuarios pueden iniciar sesión sin verificar correo, pero crear reportes y avistamientos requiere `emailVerified`.

## Reportes

Archivo principal:

- `lib/reports.js`

Funciones importantes:

- `getLostPetReports()`
- `getMapLostPetReports({ bbox, zoom })`
- `getLostPetReportById(id)`
- `createLostPetReport(report)`
- `getMyReports()`
- `getManagedReport(id, token)`
- `updateManagedReportStatus(id, token, status, reunionStory)`
- `getPublicReunionStories()`
- `uploadPetPhoto(file)`

`uploadPetPhoto()` optimiza la imagen y la sube al backend con `POST /api/uploads/pet-photo`.

Estados usados:

- `active`: reporte visible públicamente.
- `reunited`: reporte marcado como reunido.
- `archived`: reporte oculto y link privado revocado.

## Avistamientos

Archivo principal:

- `lib/sightings.js`

Funciones importantes:

- `getSightings(reportId)`
- `getSightings(reportId, { includeHidden: true })`
- `createSighting(...)`
- `updateManagedSighting(...)`

Estados usados:

- `visible`
- `pending`
- `hidden`

## Notificaciones y perfil

Archivos:

- `lib/notifications.js`
- `lib/profile.js`
- `components/notifications-button.js`
- `components/notification-preferences-panel.js`
- `components/push-notification-toggle.js`
- `components/profile-edit-panel.js`
- `components/change-password-panel.js`

Funciones importantes:

- `getNotifications()`
- `getUnreadNotificationsCount()`
- `markNotificationAsRead(id)`
- `markAllNotificationsAsRead()`
- `getNotificationPreferences()`
- `updateNotificationPreferences(preferences)`
- `getWebPushConfig()`
- `getWebPushSubscriptions()`
- `saveWebPushSubscription(subscription)`
- `deleteWebPushSubscription(endpoint)`
- `getProfile()`
- `updateProfile(profile)`
- `uploadProfileAvatar(file)`

## Imagenes

Archivo principal:

- `lib/image-processing.js`

Responsabilidades:

- Crear previews locales en WebP.
- Preparar foto principal en WebP antes de subir al backend.
- Mantener las fotos grandes bajo control.

Configuracion actual:

- Preview: WebP, ancho maximo `600px`, calidad `0.72`.
- Foto principal: WebP, ancho maximo `1280px`, calidad `0.88`.
- Avatar: WebP pequeno para backend, maximo efectivo de `32KB` segun validacion de API.

Flujos que usan esta optimizacion:

- Reportar mascota perdida.
- Reportar avistamiento.
- Historia de reencuentro.

## Componentes principales

### `components/auth-provider.js`

Mantiene la sesion propia del backend disponible para la UI.

### `components/auth-button.js`

Maneja registro, login, logout, recuperacion de contrasena y confirmacion de correo cuando llegan tokens en la URL.

### `components/my-reports-button.js`

Muestra reportes activos o reunidos del usuario autenticado. No enlaza a la pagina publica si el reporte ya no esta activo.

### `components/report-form.js`

Crea reportes nuevos. Maneja campos, validaciones, recompensa, foto, ubicacion y link privado al terminar.

### `components/sighting-form.js`

Crea avistamientos desde la pagina publica.

### `lib/manage.js`

Centraliza la capa privada de gestión para `/gestionar/[id]`: sesión privada, reporte gestionado, avistamientos privados y acciones de estado. Esta capa consume `/api/manage` y evita mezclar lógica privada en `lib/reports.js` o `lib/sightings.js`.

### `components/manage-report-actions.js`

Marca como reunida, sube fotos para historia y archiva. Al archivar redirige al inicio para evitar caer en 404.

### `components/notifications-button.js`

Muestra notificaciones del usuario autenticado, conteo no leido y acciones para marcar leidas.

### `components/notification-preferences-panel.js`

Configura alertas cercanas: radio, ubicacion manual/automatica, toggles y acceso a Web Push.

### `components/push-notification-toggle.js`

Registra el service worker, solicita permiso del navegador y guarda/desactiva la suscripcion push del dispositivo.

### `components/profile-edit-panel.js`

Actualiza perfil y avatar del usuario autenticado.

## Documentación no vigente

Las notas de pendientes, propuestas e ideas viven en `documentation/pendientes/`. No deben usarse como fuente del estado actual sin revisar primero si fueron reactivadas.

## Estilos

Archivo:

- `app/globals.css`

Regla practica:

- Si cambias estructura HTML/JSX, revisa si necesita clase nueva.
- Mantener bordes en `8px` para seguir el estilo actual.
- La UI usa principalmente `var(--bosque)`, `var(--salvia)`, `var(--coral)`, `var(--marfil)` y `var(--grafito)`.

## Problemas comunes

### El front no conecta al backend

Revisar:

- `NEXT_PUBLIC_API_URL`.
- Que el backend corra en el puerto esperado.
- CORS en el backend.

### Login o registro fallan

Revisar:

- Backend `/api/auth/register` y `/api/auth/login`.
- `JWT_SECRET` en backend.
- Tabla `app_users`.
- Si el correo no está verificado, el login puede funcionar pero publicar reportes/avistamientos seguirá bloqueado.

### El usuario perdió el link privado

Revisar:

- Que haya iniciado sesión con la misma cuenta que creó el reporte.
- Botón "Mis reportes".
- Endpoint `GET /api/reports/mine`.
- Que el reporte no esté archivado.

### No cargan fotos

Revisar:

- Backend `/api/uploads/pet-photo`.
- `PUBLIC_API_URL`.
- Carpeta `back/uploads`.
- Que `photoUrl` llegue en reportes y avistamientos.

### El mapa no muestra todos los reportes

Revisar:

- `components/leaflet-map.js`.
- `lib/reports.js` y `getMapLostPetReports()`.
- Backend `GET /api/reports/map`.
- Que el `bbox` tenga orden `west,south,east,north`.

### Web Push no se activa

Revisar:

- Que el backend responda `GET /api/notifications/push/config` con `enabled: true`.
- Que el front corra en HTTPS o `localhost`.
- Que el navegador soporte Service Worker, PushManager y Notification.
- Que el permiso de notificaciones no esté bloqueado.
