# Plan secuencial Mapache Migajas

Este plan ordena los cambios para completar la versión **Mapache Migajas** sin convertirla en una reescritura. La meta es pasar de "publicar un reporte" a "seguir una búsqueda con pistas".

Regla vigente para la versión actual:

- El sistema no debe decidir ni recomendar qué zona revisar.
- El sistema no debe mostrar "siguientes puntos a revisar" ni instrucciones operativas generadas automáticamente.
- El sistema puede mostrar datos privados organizados: pistas, rastro, filtros, zonas revisadas y acciones del dueño.
- Cualquier bloque que convierta pistas en recomendación queda marcado como `[NO APLICA PARA VERSIÓN ACTUAL]`.

## Estado inicial

Completado:

- Modelo de búsqueda documentado.
- Avistamientos/pistas normalizados en front y back.
- Vista pública y gestión privada separadas en el front.

Base disponible:

- Reportes.
- Avistamientos.
- Gestión privada.
- Mapa.
- Notificaciones cercanas.
- Web Push.
- PostGIS.

## Estrategia previa de volumen

Estado: completado.

Antes de seguir con más funciones sobre pistas, aplicar la estrategia documentada en `front/documentation/estrategia-carga-inteligente-pistas.md`.

Decisión: la versión no debe ocultar información con límites finales. Debe cargar la información de manera inteligente: mapa por viewport y clusters, lista paginada real, rastro operativo reducido, resumen y detalle bajo demanda.

Implementado:

- El mapa privado carga pistas por `bbox` y `zoom`.
- En zoom bajo/medio usa clusters.
- En zoom alto usa puntos individuales.
- El rastro operativo no depende de renderizar todas las pistas visibles.

## 1. Rastro privado de búsqueda

Estado: completado.

Objetivo: convertir los avistamientos del panel privado en una línea temporal de pistas.

Cambios completados:

- Crear sección "Rastro de búsqueda" en `/gestionar/[id]`.
- Mostrar estado, confianza, comentario, foto, ubicación aproximada y fecha.
- Ordenar visualmente las pistas por estado operativo.
- Agregar tercer nivel: `Pista clave`.
- Limitar pistas clave a máximo 5 activas por reporte.
- Hacer que el rastro principal use solo pistas clave.
- Si hay 0 o 1 pista clave, no se dibuja línea; solo se resalta visualmente.
- Mantener pistas útiles como contexto, sin formar la línea principal.
- Dejar descartadas/no útiles degradadas visualmente.

Validación:

- Abrir `/gestionar/[id]#token=...`.
- Ver avistamientos como pistas ordenadas.
- Marcar una pista como útil y confirmar que se distingue visualmente.
- Marcar una pista como clave y confirmar que sube a prioridad visual.
- Confirmar que no se pueden marcar más de 5 pistas clave activas.
- Marcar una pista como "No me sirve" y confirmar que queda degradada.

Implementado:

- `front/components/search-trail-panel.js`.
- `front/lib/search-trail.js`.
- `front/lib/sightings.js`.
- `back/src/routes/manage.js`.
- `back/src/services/report-mapper.js`.
- `back/sql/current/013_sighting_trail_keys.sql`.

Pendiente:

- Validar manualmente en base real después de aplicar `013_sighting_trail_keys.sql`.

## 2. Mapa privado con rastro temporal

Estado: completado.

Objetivo: mostrar el rastro privado dentro del panel de gestión sin convertirlo en una recomendación automática.

Cambios completados:

- Agregar mapa privado en `/gestionar/[id]`.
- Mostrar punto original del reporte.
- Mostrar pistas numeradas con numeración estable.
- Diferenciar pista clave, útil, pendiente, visible y descartada.
- Dibujar línea solo con pistas clave.
- No dibujar línea si hay menos de 2 pistas clave.
- Filtrar el mapa por defecto para mostrar solo `Pista clave` y `Útil`.
- Ocultar por defecto pendientes, otros y "No me sirve".
- Mostrar solo los últimos 12 pendientes cuando se activa el filtro de pendientes.
- Agregar opción para mostrar todos los pendientes.
- Agregar opción "Mostrar todo".
- Evitar wrap horizontal del mapa.
- Agregar degradado visual en límites verticales y horizontales.
- Mantener normalización defensiva de `bbox`.

Validación:

- Confirmar que el punto original no se confunde con las pistas.
- Confirmar que pistas clave y útiles se distinguen.
- Confirmar que descartadas/no útiles no dominan el mapa.
- Confirmar que el rastro no cambia por mover el viewport.
- Confirmar que el mapa no se repite horizontalmente.
- Confirmar que los filtros no afectan la línea del rastro.

Implementado:

- `front/components/manage-search-map.js`.
- `front/components/manage-search-map-client.js`.
- `front/components/leaflet-map-utils.js`.
- `front/components/map-boundary-indicator.js`.
- `back/src/services/manage-sighting-map.js`.
- `back/src/services/map-clustering.js`.
- `GET /api/manage/:id/sightings/map?bbox=...&zoom=...`.

Escala real completada:

1. [Hecho] Crear `back/src/services/manage-sighting-map.js`.
2. [Hecho] Reutilizar `parseBbox`, `getMapResponseMode` y `getMapClusterCellSize`.
3. [Hecho] Consultar `public.sightings` por `report_id`, `bbox` y coordenadas válidas.
4. [Hecho] En zoom bajo/medio devolver `items` tipo `cluster` con `count`, `coordinates` y `bounds`.
5. [Hecho] En zoom alto devolver `items` tipo `sighting` con los campos normalizados por `mapSightingRow`.
6. [Hecho] Crear endpoint privado `GET /api/manage/:id/sightings/map?bbox=...&zoom=...`.
7. [Hecho] Validar el token de gestión antes de consultar las pistas.
8. [Hecho] En front, agregar función en `front/lib/manage.js` para pedir el mapa por `bbox` y `zoom`.
9. [Hecho] Cambiar `manage-search-map-client.js` para cargar datos al mover/zoom del mapa.
10. [Hecho] Renderizar clusters con `createClusterIcon` y pistas individuales solo en zoom alto.
11. [Hecho] Mantener el rastro temporal con pocas pistas clave para no depender de miles de marcadores.
12. [Hecho] Validar con build que el mapa privado ya no depende de descargar ni renderizar todas las pistas al abrir.

## 3. Zona activa inicial

Estado: [NO APLICA PARA VERSIÓN ACTUAL].

Motivo:

- Este bloque hace que el sistema decida o sugiera una zona a revisar.
- La versión actual no debe recomendar "qué revisar ahora", aunque se presente como aproximado o no seguro.

Objetivo original:

- Decirle al dueño qué zona revisar ahora.

Cambios originales no aplicables:

- Calcular zona activa en front usando datos existentes.
- Si hay pista útil reciente, usar esa ubicación.
- Si hay varias pistas útiles cercanas, usar centro aproximado.
- Si no hay pistas útiles, usar la última ubicación conocida.
- Mostrar una tarjeta "Zona activa".

Validación original no aplicable:

- Sin avistamientos: zona activa = última ubicación conocida.
- Con pista útil: zona activa = pista útil.
- Con varias pistas útiles: zona activa = centro aproximado.

Nota de estado:

- Existe implementación previa en `front/components/active-search-area-panel.js`.
- Para la versión pública actual, este concepto debe quedar fuera del producto o no mostrarse como recomendación.

Pendiente para alinear producto:

- Revisar si la tarjeta "Zona activa" debe ocultarse/retirarse antes de publicar la versión actual.
- Si se conserva algo similar, debe ser puramente informativo y no decir qué revisar.

## 4. Acciones privadas de búsqueda

Estado: completado.

Objetivo: que el dueño pueda tomar decisiones operativas desde el panel privado sin exponerlas públicamente.

Cambios completados:

- Mantener "Marcar útil".
- Cambiar "Ocultar falso" por una semántica más amplia: "No me sirve".
- Agregar "Pista clave".
- Limitar a máximo 5 pistas clave activas.
- Agregar estado visual de pendiente/no revisada mediante filtros y badges.
- Separar acciones de búsqueda de acciones de cierre del reporte.
- Agregar zonas revisadas privadas.
- Las zonas revisadas solo se pueden crear desde pistas marcadas como `Útil` o `Pista clave`.
- Cada zona revisada usa radio fijo de 500 m.
- Cada zona revisada permite nota privada opcional de máximo 48 caracteres.
- Cada zona revisada permite seleccionar fecha y hora revisada.
- Las zonas revisadas pueden eliminarse.

Validación:

- Las acciones privadas no aparecen en `/mascotas/[slug]`.
- Los cambios privados se reflejan en `/gestionar/[id]`.
- La vista pública sigue simple y segura.
- Una pista pendiente/normal/no útil no muestra botón para crear zona revisada.
- Una pista útil o clave sí muestra botón para crear zona revisada.
- La zona revisada aparece como círculo privado en el mapa.
- La zona revisada persiste al recargar.
- La zona revisada se elimina correctamente.

Implementado:

- `front/components/manage-sightings-panel.js`.
- `front/components/manage-search-map-client.js`.
- `front/lib/manage.js`.
- `back/src/routes/manage.js`.
- `back/sql/current/013_sighting_trail_keys.sql`.
- `back/sql/current/014_reviewed_search_zones.sql`.

Pendiente:

- Aplicar `013_sighting_trail_keys.sql` en base real si no se ha aplicado.
- Aplicar `014_reviewed_search_zones.sql` en base real si no se ha aplicado.
- Validar manualmente el flujo completo en un reporte real.

## 5. Panel "Qué revisar ahora"

Estado: [NO APLICA PARA VERSIÓN ACTUAL].

Motivo:

- Este panel convierte pistas en una recomendación accionable.
- La versión actual no debe recomendar siguientes pasos, aunque use lenguaje cauteloso.

Objetivo original no aplicable:

- Convertir pistas en una recomendación accionable.

Cambios originales no aplicables:

- Crear panel con reglas simples:
  - Si hay pista útil reciente: revisar esa zona.
  - Si hay varias pistas cercanas: revisar el centro del grupo.
  - Si solo hay pistas pendientes: revisar la más reciente con cautela.
  - Si no hay pistas: reforzar difusión cerca de la última ubicación conocida.
- Usar lenguaje como "conviene revisar", "posible zona", "pista pendiente".

Validación original no aplicable:

- El panel cambia según las pistas.
- No promete certeza.
- No expone datos privados.

Decisión:

- No implementar en la versión actual.
- No mostrar recomendaciones automáticas de búsqueda.

## 6. Reorientar alertas por rastro

Estado: [NO APLICA PARA VERSIÓN ACTUAL].

Motivo:

- Reorientar alertas con base en una zona activa o rastro implica que el sistema decide una nueva zona operativa.
- La versión actual no debe mover ni recomendar foco de búsqueda automáticamente.

Cambios originales no aplicables:

- Usar la zona activa como candidata para futuras alertas.
- Persistir zona activa.
- Crear entidad `search_session` o `active_area` para decidir alertas.
- Cambiar envío masivo con base en rastro.

Validación original no aplicable:

- Las reglas quedan documentadas.
- No se duplican alertas sin control.
- Se mantiene privacidad de ubicaciones exactas.

Decisión:

- Mantener alertas actuales sin reorientación automática por rastro.
- Si en el futuro se reabre este punto, debe requerir decisión explícita del dueño, no inferencia automática.

## 7. Persistencia nueva si hace falta

Estado: completado parcial.

Objetivo: guardar estado privado de búsqueda cuando el flujo lo exige.

Tablas consideradas originalmente:

- `search_sessions`
- `search_clues`
- `search_areas`
- `search_actions`

Decisión actual:

- No crear una arquitectura completa de sesiones de búsqueda todavía.
- Persistir solo lo necesario para la versión actual.

Persistencia implementada:

- `is_trail_key` en `public.sightings`.
- `public.reviewed_search_zones`.

Migraciones:

- `back/sql/current/013_sighting_trail_keys.sql`.
- `back/sql/current/014_reviewed_search_zones.sql`.

Backend privado implementado:

- Actualización privada de pista útil/clave/no útil.
- `GET /api/manage/:id/reviewed-zones`.
- `POST /api/manage/:id/reviewed-zones`.
- `DELETE /api/manage/:id/reviewed-zones/:zoneId`.

Pendiente:

- Aplicar migraciones en VPS/base real.
- Validar que backups y documentación de despliegue mencionen estas migraciones si hace falta.

## 8. Pulido UX de Mapache Migajas

Estado: completado parcial.

Objetivo: que la versión se sienta coherente y útil sin sobrecargar al dueño.

Cambios completados:

- Mejorar jerarquía visual del rastro privado.
- Mejorar jerarquía visual del panel "Revisar avisos recibidos".
- Diferenciar visualmente pista clave, útil y no útil.
- Ajustar filtros del mapa privado.
- Mejorar comportamiento de límites de mapa.
- Corregir textos visibles y mensajes con acentos faltantes.

Cambios pendientes:

- Validación visual manual con datos reales.
- Revisar si queda visible algún bloque de "Zona activa" o recomendación automática.
- Revisar copy final de "Mapache Migajas" para mantener tono útil, no infantil.
- Validar mobile web solo como sanity check, sin tocar la app mobile nativa.

Validación:

- La vista pública sigue clara.
- La gestión privada se entiende como centro de búsqueda.
- No hay sobrecarga visual.
- No hay paneles que recomienden automáticamente qué revisar.

## Orden de implementación actualizado

1. [Completado] Rastro privado de búsqueda.
2. [Completado] Mapa privado con rastro temporal.
3. [NO APLICA PARA VERSIÓN ACTUAL] Zona activa inicial.
4. [Completado] Acciones privadas de búsqueda.
5. [NO APLICA PARA VERSIÓN ACTUAL] Panel "Qué revisar ahora".
6. [NO APLICA PARA VERSIÓN ACTUAL] Reorientar alertas por rastro.
7. [Completado parcial] Persistencia nueva si hace falta.
8. [Completado parcial] Pulido UX.

## Pendientes antes de publicar

- Aplicar migración `013_sighting_trail_keys.sql`.
- Aplicar migración `014_reviewed_search_zones.sql`.
- Reiniciar backend después de aplicar migraciones.
- Validar manualmente un reporte gestionado con:
  - pista útil
  - pista clave
  - pista no útil
  - zona revisada creada desde pista útil/clave
  - eliminación de zona revisada
- Revisar si la UI todavía muestra "Zona activa"; si aparece como recomendación, debe retirarse u ocultarse para la versión actual.
- Confirmar que no existe panel "Qué revisar ahora".
- Confirmar que no hay reorientación automática de alertas por rastro.

## Regla de control

Después de cada paso:

- Ejecutar build del front si se tocó UI.
- Ejecutar check/test del backend si se tocó API.
- Validar manualmente un reporte gestionado.
- Actualizar este documento con estado completado, pendiente o `[NO APLICA PARA VERSIÓN ACTUAL]`.
