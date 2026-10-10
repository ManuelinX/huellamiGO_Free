# Preversion Cacatua Campana: flujo Lo vi

Objetivo: preparar una primera version centrada en que una persona pueda enviar un "Lo vi" util, que el dueno reciba una notificacion clara, que la actividad no genere spam y que el mapa privado muestre el rastro de forma entendible.

Alcance inicial: no redisenar todo el sistema de reportes. Mantener el radio automatico de publicacion de reportes como esta y concentrar el trabajo en avistamientos.

## Estado base actual

- El formulario "Lo vi" ya exige usuario autenticado y correo verificado.
- La ubicacion ya es obligatoria en el formulario.
- La nota y la foto ya son opcionales.
- El backend ya guarda avistamientos en `public.sightings`.
- El backend ya notifica al dueno del reporte cuando entra un avistamiento de otra persona.
- Los avistamientos normales ya pueden agruparse en digest para evitar saturar al dueno.
- Existe una cola separada para avisar a usuarios cercanos cuando varios "Lo vi" sugieren una nueva zona probable, pero esta apagada por defecto.

## Secuencia de trabajo

### 1. [echo] Confirmar contrato de "Lo vi"

Archivos a revisar:

- `front/components/sighting-form.js`
- `front/lib/sightings.js`
- `back/src/routes/reports.js`
- `back/src/services/sightings.js`

Checks:

- [echo] Confirmar que ubicacion sea obligatoria antes de enviar.
- [echo] Confirmar que nota corta siga siendo opcional.
- [echo] Confirmar que foto siga siendo opcional.
- [echo] Confirmar que solo usuarios con correo verificado puedan enviar.
- [echo] Confirmar que el backend no acepte coordenadas invalidas.

Resultado esperado:

- [echo] El flujo minimo queda definido como: ubicacion obligatoria, nota opcional, foto opcional, usuario verificado.

### 2. [echo] Afinar copia y accion de la notificacion al dueno

Archivos a revisar:

- `back/src/services/notification-rules.js`
- `back/src/services/sighting-notifications.js`
- `front/components/notifications-button.js`

Checks:

- [echo] La notificacion debe decir claramente que alguien envio un "Lo vi".
- [echo] Debe incluir el nombre de la mascota.
- [echo] Debe llevar al reporte en la seccion de avistamientos: `/mascotas/:id#avistamiento`.
- [echo] Debe incluir `reportId`, `sightingId`, `lat`, `lng`, `status`, `seenAt` y `createdAt` en `data`.
- [echo] Debe ser accionable desde in-app y Web Push.

Resultado esperado:

- [echo] El dueno entiende rapido que hay una pista nueva y puede abrirla sin buscar manualmente.

### 3. [echo] Confirmar reglas anti-spam para el dueno

Archivos a revisar:

- `back/src/services/sighting-notifications.js`
- `back/src/services/sighting-digest-queue.js`
- `back/src/services/notifications.js`

Reglas actuales a validar:

- [echo] Avistamiento confiable: notificacion inmediata.
- [echo] Avistamiento normal: los primeros 2 en una ventana de 5 minutos salen inmediatos.
- [echo] Despues de esos 2, se agrupan en digest por ventana de 5 minutos.
- [echo] Si hay 12 o mas avistamientos normales en 10 minutos, usar notificacion de alta actividad.
- [echo] Usar `notification_logs` y `dedupe_key` para evitar duplicados.

Resultado esperado:

- [echo] El dueno recibe senales utiles sin que cada "Lo vi" se convierta en spam cuando hay mucha actividad.

### 4. [echo] Revisar limites de envio de "Lo vi"

Archivos a revisar:

- `front/components/sighting-form.js`
- `back/src/services/sighting-rate-limits.js`
- `back/sql/current/010_sighting_rate_limits.sql`

Reglas actuales a validar:

- [echo] Cooldown local en frontend: 60 segundos por reporte.
- [echo] Limite backend por usuario y reporte.
- [echo] Limite backend por IP y reporte.
- [echo] Limite backend global por usuario.
- [echo] Limite backend global por IP.

Resultado esperado:

- [echo] El sistema reduce abuso sin bloquear el uso normal de personas que ayudan.

### 5. [echo] Definir agrupacion visual de multiples "Lo vi" cercanos

Archivos a revisar:

- `back/src/services/nearby-sighting-update-notifications.js`
- `back/src/services/manage-sighting-map.js`
- `front/components/manage-search-map.js`
- `front/components/manage-search-map-client.js`
- `front/components/search-trail-panel.js`

Decisiones para preversion:

- [echo] Usar clusters por cercania para explicar actividad repetida.
- [echo] Mantener puntos individuales disponibles para gestion privada.
- En mapa privado, distinguir visualmente:
  - [echo] avistamiento normal
  - [echo] avistamiento pendiente
  - [echo] avistamiento marcado util
  - [echo] pista clave
  - [echo] oculto/no sirve

Resultado esperado:

- [echo] El mapa privado muestra un rastro entendible, no solo una lista de marcadores sueltos.

### 6. [echo] Validar si se activa la cola de nueva zona probable

Archivos a revisar:

- `back/src/config/nearby-sighting-updates.js`
- `back/src/services/nearby-sighting-update-notifications.js`
- `back/src/index.js`
- `back/sql/current/011_nearby_sighting_update_queue.sql`

Reglas actuales de esta cola:

- [echo] Esta desactivada por defecto con `NEARBY_SIGHTING_UPDATE_ENABLED=false`.
- [echo] Agrupa avistamientos en ventanas de 10 minutos.
- [echo] Clusteriza avistamientos dentro de 500 metros.
- [echo] No avisa si el cluster esta a menos de 1 km del punto original del reporte.
- [echo] No avisa si esta a menos de 700 metros del ultimo cluster ya notificado.
- [echo] Requiere normalmente 2 avistamientos y confianza minima 70.
- [echo] Permite un solo avistamiento si es de fuente confiable y confianza alta.
- [echo] Notifica usuarios cercanos al cluster en radio de 2 km.

Decision pendiente:

- [echo] Para preversion, mantenerla apagada salvo que se quiera probar solo en ambiente controlado.

Resultado esperado:

- [echo] Evitar mandar alertas comunitarias por pistas debiles antes de validar bien el comportamiento.

### 7. [echo] Revisar experiencia de gestion privada

Archivos a revisar:

- `front/components/manage-report-page-client.js`
- `front/components/manage-sightings-panel.js`
- `front/components/manage-search-map-client.js`
- `back/src/services/manage-sighting-map.js`

Checks:

- [echo] El dueno puede ver cada "Lo vi" con fecha, nota, foto y ubicacion.
- [echo] El dueno puede marcar algo como util.
- [echo] El dueno puede marcar algo como no sirve.
- [echo] El dueno puede marcar pista clave.
- [echo] El mapa refleja esos estados sin confundirlos.
- [echo] La lista y el mapa usan el mismo orden/identidad visual.

Resultado esperado:

- [echo] Gestionar el reporte se siente como seguir pistas, no como revisar datos crudos.

### 8. Pruebas manuales de la preversion

Escenarios:

- Usuario A publica reporte activo.
- Usuario B envia "Lo vi" con solo ubicacion.
- Usuario A recibe notificacion y abre el reporte en avistamientos.
- Usuario B envia "Lo vi" con nota.
- Usuario B envia "Lo vi" con foto.
- Varios usuarios envian "Lo vi" en pocos minutos y se confirma que aparece digest/alta actividad.
- Usuario A marca un avistamiento como util.
- Usuario A marca otro como no sirve.
- Usuario A marca uno como pista clave.
- El mapa privado muestra claramente el rastro y los estados.

Resultado esperado:

- La preversion esta lista cuando esos escenarios se pueden completar sin confusion y sin spam.

## Orden recomendado de implementacion

1. Validar contrato actual de "Lo vi".
2. Ajustar copia/data de notificacion al dueno si hace falta.
3. Probar digest y dedupe de avistamientos.
4. Pulir estados de gestion privada.
5. Pulir mapa privado del rastro.
6. Evaluar despues si se prende la cola de nueva zona probable.
