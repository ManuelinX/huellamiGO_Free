# Tareas de maxima prioridad - HuellamiGO mobile

Este documento concentra lo que conviene resolver antes de seguir agregando pantallas. La prioridad esta puesta en evitar deuda tecnica que afecte el mapa, los reportes y la escalabilidad.

## P0 - Corregir raiz del problema del mapa

- [ ] Quitar coordenadas default del formulario de crear reporte.
- [ ] No enviar `last_seen_lat` ni `last_seen_lng` si el usuario no eligio ubicacion real.
- [ ] Validar que si se envia latitud tambien se envie longitud, y viceversa.
- [ ] Mostrar en el mapa solo reportes con coordenadas reales.
- [ ] Agregar mensaje claro para reportes sin ubicacion: aparecen en lista, pero no en mapa.

Motivo: hoy varios reportes pueden quedar con la misma coordenada de prueba. Eso contamina el mapa y hace que los marcadores se vean duplicados o encimados.

## P0 - Estabilizar mapa mobile

- [ ] Definir `minZoom` y `maxZoom` finales para el mapa.
- [ ] Desactivar rotacion del mapa para evitar diagonales raras al hacer pinch.
- [ ] Usar `maxNativeZoom` en el `TileLayer` para evitar pantalla blanca al hacer mucho zoom in.
- [ ] Agrupar reportes que compartan coordenadas exactas o muy cercanas.
- [ ] Al tocar un grupo, mostrar lista corta de reportes en esa ubicacion.

Motivo: aunque solo existan pocos reportes, el mapa debe comportarse bien con zoom, marcadores cercanos y coordenadas repetidas.

## P0 - Backend para reportes por viewport

- [ ] Agregar soporte backend para `bbox` en `/api/reports`.
- [ ] Formato sugerido: `/api/reports?bbox=west,south,east,north&status=active`.
- [ ] Filtrar por `latitude`, `longitude` y `status`.
- [ ] Ignorar reportes sin coordenadas en consultas de mapa.
- [ ] Mantener endpoint actual sin `bbox` para lista/home.

Motivo: el mapa no debe pedir todos los reportes cuando la base crezca. Debe pedir solo lo visible.

## P0 - Indices y modelo de datos

- [ ] Confirmar nombres reales de columnas/campos de coordenadas en backend.
- [ ] Separar claramente `zone` textual de `latitude`/`longitude`.
- [ ] Agregar indice por coordenadas en base de datos.
- [ ] Agregar indice por `status`.
- [ ] Revisar que reportes cerrados, ocultos o reunidos no aparezcan como activos.

Motivo: el mapa depende de datos limpios y consultas rapidas.

## P1 - Flujo real de ubicacion

- [ ] Agregar opcion "Usar mi ubicacion actual".
- [ ] Agregar selector manual de punto en mapa.
- [ ] Permitir guardar ubicacion aproximada, no direccion exacta.
- [ ] Mostrar aviso de privacidad antes de guardar ubicacion.
- [ ] Permitir editar ubicacion aproximada en gestion de reporte.

Motivo: HuellamiGO necesita ubicaciones utiles sin exponer datos sensibles.

## P1 - Clustering escalable

- [ ] Empezar con clustering simple en Flutter para pocos reportes.
- [ ] Agrupar por coordenada redondeada o distancia corta.
- [ ] A futuro mover clustering al backend cuando haya muchos reportes.
- [ ] Si el zoom es bajo, devolver grupos.
- [ ] Si el zoom es alto, devolver reportes individuales.

Motivo: pintar miles de pins individuales no escala ni ayuda al usuario.

## P1 - Proveedor de tiles

- [ ] Mantener CARTO solo como proveedor de prototipo.
- [ ] Antes de produccion, elegir proveedor con plan y limites claros.
- [ ] Evaluar Mapbox, Google Maps, MapTiler o Stadia Maps.
- [ ] Documentar API keys, cuotas y costos.
- [ ] Agregar alertas de uso si el proveedor lo permite.

Motivo: un mapa productivo no debe depender de servidores publicos sin plan de uso.

## P1 - Verificacion antes de continuar features

- [ ] Crear reporte sin ubicacion y confirmar que no aparece en mapa.
- [ ] Crear reporte con ubicacion real y confirmar que aparece una sola vez.
- [ ] Probar zoom out y confirmar que no se repiten mundos visibles.
- [ ] Probar zoom in y confirmar que no queda pantalla blanca.
- [ ] Probar con 5 reportes en el mismo punto y confirmar agrupacion.
- [ ] Probar con 100 reportes fake antes de publicar nueva version.

Motivo: estos casos cubren los errores que mas afectan la confianza del mapa.
