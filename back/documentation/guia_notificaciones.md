# Guia de notificaciones HuellamiGO

Estado general: MVP implementado en backend/front. Falta ejecutar migraciones nuevas en VPS/Postgres y probar los modos de actividad en beta cerrada.

## Operacion obligatoria

Antes de probar avistamientos/digest en VPS/Postgres, ejecutar en orden:

1. `back/sql/current/008_sighting_digest_queue.sql`
2. `back/sql/current/009_notification_priority_fields.sql`
3. `back/sql/current/010_sighting_rate_limits.sql`

Variables relevantes:

- `SIGHTING_DIGEST_PROCESSOR_ENABLED=false` desactiva el processor de digest si hace falta depurar.

## Prioridad de reportes

Estado: COMPLETADO para MVP.

Implementado:

- `calculateReportNotificationPriority(report)` calcula prioridad en caliente.
- Devuelve `score`, `level`, `radiusKm`, `shouldPush` y `reasons`.
- Radios actuales:
  - `high`: 7 km
  - `medium`: 4 km
  - `low`: 1.5 km
  - `none`: sin push
- El score considera:
  - recencia
  - foto
  - ubicacion clara
  - vulnerable/urgente
  - necesita medicamento
  - etapa de vida sensible (`puppy` o `senior`)
  - avistamientos recientes
- `notifyNearbyUsersAboutReport()` ya usa esta prioridad.
- `priority_score` no se guarda en DB; se calcula en caliente.

Pendiente futuro:

- Guardar `priority_score` y `priority_level` solo si se necesita auditoria, admin, ordenamiento o metricas.

## Radio de alertas

Estado: COMPLETADO para MVP.

Decision:

- El usuario no controla kilometros exactos.
- El usuario controla:
  - activar/desactivar alertas cercanas
  - definir zona base
  - activar/desactivar push en el dispositivo
- El radio real lo decide el sistema segun prioridad del reporte.

Implementado:

- Se quito el slider de radio del panel de preferencias.
- El backend conserva `radius_km` por compatibilidad, pero ya no acepta cambios desde `PATCH /api/notifications/preferences`.
- `notifyNearbyUsersAboutReport()` usa solo el radio por prioridad del reporte.

Pendiente futuro:

- Si se requiere control avanzado, usar opciones simples tipo `cerca`, `normal`, `amplia`, no kilometros exactos.

## Campos de prioridad del reporte

Estado: COMPLETADO para MVP.

Implementado:

- Migracion: `back/sql/current/009_notification_priority_fields.sql`.
- Campos nuevos en `public.pet_reports`:
  - `is_vulnerable`
  - `is_urgent`
  - `needs_medication`
  - `pet_life_stage`: `puppy`, `adult`, `senior`
- El formulario de reporte ya captura estas senales.
- El calculo de prioridad ya las usa.

Pendiente futuro:

- Agregar edicion de estos campos en gestion/admin si se necesita corregir reportes ya publicados.

## Fuente y confianza de avistamientos

Estado: COMPLETADO para MVP.

Implementado:

- Migracion: `back/sql/current/009_notification_priority_fields.sql`.
- Campo nuevo en `public.sightings`: `source_type`.
- Valores soportados:
  - `anonymous`
  - `normal`
  - `verified_business`
  - `rescuer`
  - `trusted`
- El formulario publico siempre guarda `source_type = normal` para evitar que un usuario se autodeclare verificado.
- El backend calcula `trust_score`; ya no confia en el valor enviado por el cliente publico.
- Reglas:
  - `trust_score >= 80`: notificacion inmediata
  - `verified_business`, `rescuer` o `trusted`: notificacion inmediata
  - resto: reglas de actividad/digest

Pendiente futuro:

- Crear flujo/admin para asignar `verified_business`, `rescuer` o `trusted`.
- Definir si habra avistamientos anonimos sin cuenta.

## Flujo de avistamientos

Estado: COMPLETADO para MVP.

Implementado:

- `createSighting()` guarda el avistamiento.
- Despues delega a `handleSightingCreated()`.
- `handleSightingCreated()` decide entre inmediata, digest o skip.
- Si el dueno reporta su propio avistamiento, no se notifica.
- Si el dueno desactivo actualizaciones, se registra `skipped`.

Reglas actuales:

- Fuentes confiables o `trust_score >= 80`: notificacion inmediata.
- Avistamientos normales (`trust_score < 80`):
  - primeras 2 pistas en una ventana de 5 min: notificacion inmediata
  - desde la tercera pista en esa ventana: digest
- El digest resume solo avistamientos adicionales no notificados inmediatamente.

Prioridad de testeo: ALTAMENTE PRIORITARIO para beta cerrada.

## Cola y processor de digest

Estado: COMPLETADO para MVP.

Implementado:

- Migracion: `back/sql/current/008_sighting_digest_queue.sql`.
- Servicio: `back/src/services/sighting-digest-queue.js`.
- Tablas:
  - `sighting_digest_queue`
  - `sighting_digest_items`
- `startSightingDigestProcessor()` arranca con `src/index.js`.
- Cada minuto procesa filas `pending` cuya ventana ya cerro.
- Usa `FOR UPDATE SKIP LOCKED`.
- Crea notificacion in-app y Web Push si hay suscripcion activa.
- Marca cada fila como `processed`, `skipped` o `failed`.
- Dedupe normal:
  - `nearby_sighting_digest:<report_id>:<window_start>`

## Zona principal del digest

Estado: COMPLETADO para MVP.

Implementado:

- Al procesar digest, se toman los avistamientos de la ventana.
- Se agrupan por proximidad usando radio local de 350 m.
- Se toma el grupo principal.
- Se calcula centroide.
- Se llama `reverseGeocode()` solo para ese punto representativo.
- `reverseGeocode()` consulta primero `geocoding_cache`.
- Si no hay cache util, llama Mapbox.
- Si Mapbox se usa, cuenta contra `geocoding_provider_usage`.
- El texto usa, en orden:
  - colonia/neighborhood
  - municipio
  - ciudad
  - estado
  - zona original del reporte

Pendiente futuro:

- Persistir etiqueta de zona por avistamiento si se necesita historico por colonia.
- Mejorar agrupacion si hay varios grupos importantes en una misma ventana.

## Alta actividad

Estado: COMPLETADO para MVP.

Prioridad de testeo: ALTAMENTE PRIORITARIO para beta cerrada.

Regla implementada:

- 12+ avistamientos normales en 10 min activan alta actividad.
- Mientras hay alta actividad, el digest normal de 5 min se marca como `skipped`.
- Se manda resumen amplio maximo cada 12 min usando dedupe por bucket.
- Dedupe:
  - `nearby_sighting_high_activity:<report_id>:<bucket_12_min>`
- Usa el mismo calculo de zona principal por cluster y reverse geocoding.

Texto ejemplo:

`Alta actividad en el reporte de Luna: 18 avistamientos recientes la ubican cerca de Col. Centro.`

## Pendientes futuros

### Actualizacion cercana por nuevo avistamiento

Implementado con Version 2 configurable, apagado por default.

Objetivo:

- Si un avistamiento cambia la zona probable, notificar usuarios cercanos a ese nuevo punto.

Estado:

- Cada `Lo vi` encola una ventana en `nearby_sighting_update_queue`.
- El processor agrupa avistamientos recientes en clusters.
- Se elige el cluster con mayor confianza.
- Se compara contra el ultimo cluster notificado.
- Se exige distancia minima, confianza minima, cooldown y dedupe.
- Configuracion editable en `back/src/config/nearby-sighting-updates.js`.
- Dedupe: `nearby_sighting_update:<report_id>:<YYYY-MM-DD>`.
- Limite default: 1 cada 12h por reporte y 1 por usuario/reporte/dia.
- `enabled=false` y `dryRun=true` por default para betas controladas.

Falta validar en beta cerrada:

- Que no genere spam.
- Que los umbrales de confianza sean correctos.
- Que el radio de 2 km sea suficiente.
- Que los clusters compactos ganen contra avistamientos aislados o dispersos.

### Rate limits

Estado: COMPLETADO para MVP.

Objetivo:

- Limitar spam de `Lo vi`.

Implementado:

- Migracion: `back/sql/current/010_sighting_rate_limits.sql`.
- Se guarda `created_ip` en `public.sightings`.
- El backend valida antes de insertar el avistamiento.
- Valores por defecto configurables por env:
  - `SIGHTING_USER_REPORT_HOURLY_LIMIT=5`
  - `SIGHTING_USER_REPORT_COOLDOWN_SECONDS=60`
  - `SIGHTING_IP_REPORT_HOURLY_LIMIT=8`
  - `SIGHTING_USER_GLOBAL_HOURLY_LIMIT=32`
  - `SIGHTING_IP_GLOBAL_HOURLY_LIMIT=60`
- Si se excede un limite, responde `429`.
- El rate limit de frontend/localStorage queda solo como apoyo UX.

Pendiente futuro:

- Ajustar valores con datos reales de beta.
- Dar limites mas altos a `rescuer`, `trusted` o `verified_business` si hace falta.

### Privacidad de textos

Estado actual: OK para MVP.

Reglas:

- No mostrar direccion exacta ni coordenadas en push.
- Usar zona aproximada.
- La ubicacion detallada vive dentro del reporte.

## Checklist beta cerrada

Prioridad alta:

- Ejecutar migraciones `008`, `009` y `010` en VPS/Postgres.
- Usuario A activa push y zona base.
- Usuario B crea reporte cerca.
- A recibe alerta una vez.
- Crear reporte `low`, `medium`, `high` y revisar radio esperado.
- Probar reporte urgente/vulnerable/medicamento/cachorro/senior.
- Probar primeras 2 pistas inmediatas por ventana de 5 min.
- Probar digest desde la tercera pista.
- Probar alta actividad con 12+ avistamientos en 10 min.
- Confirmar cooldown de alta actividad de 12 min.
- Confirmar que no se dupliquen inmediata + digest + alta actividad.
- Confirmar que `source_type` publico queda como `normal`.
- Confirmar que `trust_score` lo calcula backend.
