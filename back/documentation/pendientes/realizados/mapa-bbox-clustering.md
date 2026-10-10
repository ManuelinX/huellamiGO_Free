# Mapa por viewport, clustering e indices

Objetivo: que el mapa no descargue todos los reportes individuales cuando el usuario ve una zona grande, pero que siga representando todos los reportes visibles de forma inteligente.

## 1. Mantener bbox como base - hecho

- Usar `bbox=west,south,east,north` para pedir solo lo que esta dentro de la pantalla visible.
- Mantener `/api/reports` compatible con el flujo actual.
- Evitar que el front filtre despues de descargar todo.

Resultado esperado: el mapa ya no pide todos los reportes activos globales, solo los del viewport.

## 2. Crear endpoint especifico para mapa - hecho

- Crear `GET /api/reports/map`.
- Recibir:
  - `bbox=west,south,east,north`
  - `zoom=numero`
  - `status=active`
- Devolver una estructura pensada para mapa, no para lista.

Ejemplo:

```json
{
  "ok": true,
  "mode": "clusters",
  "items": []
}
```

Resultado esperado: separar claramente datos de lista/home y datos geograficos del mapa.

## 3. Agregar zoom al request del front - hecho

- En Leaflet, leer `map.getZoom()`.
- Enviar `zoom` junto con el `bbox`.
- Volver a pedir datos en:
  - carga inicial del mapa
  - `moveend`
  - `zoomend`

Ejemplo:

```txt
/api/reports/map?bbox=west,south,east,north&zoom=12&status=active
```

Resultado esperado: el backend puede decidir si devuelve clusters o reportes individuales.

## 4. Definir reglas de respuesta por zoom - hecho

- Zoom bajo: devolver clusters.
- Zoom medio: devolver clusters mas pequenos.
- Zoom alto: devolver reportes individuales.

Regla inicial sugerida:

```txt
zoom <= 6   -> clusters gigantes
zoom 7-10   -> clusters grandes
zoom 11-13  -> clusters medianos
zoom >= 14  -> reportes individuales
```

Resultado esperado: cuando el usuario esta lejos, ve cantidades agrupadas; cuando se acerca, ve mascotas concretas.

Nota: la decision de modo por zoom ya esta implementada en el endpoint de mapa. La construccion real de clusters queda en el paso 5.

## 5. Implementar clustering por grid en SQL - hecho

- Agrupar reportes por celdas calculadas desde latitud y longitud.
- Ajustar tamano de celda segun zoom.
- Cada cluster debe devolver:
  - `type: "cluster"`
  - `count`
  - `coordinates`
  - bounds opcionales de la celda

Ejemplo:

```json
{
  "type": "cluster",
  "count": 23,
  "coordinates": [19.4326, -99.1332]
}
```

Resultado esperado: representar todos los reportes visibles sin mandar miles de marcadores individuales.

## 6. Mantener reportes individuales en zoom alto - hecho

- Cuando el zoom sea alto, devolver items tipo `report`.
- Reusar el mapper publico del reporte si el payload actual es suficiente.
- Considerar un mapper mas ligero para mapa si el payload crece demasiado.

Ejemplo:

```json
{
  "type": "report",
  "id": "reporte-id",
  "name": "Nina",
  "coordinates": [19.41273, -99.16988]
}
```

Resultado esperado: el usuario puede inspeccionar mascotas concretas cuando ya esta cerca.

## 7. Renderizar clusters en el front - hecho

- El mapa debe aceptar dos tipos de item:
  - `cluster`
  - `report`
- Para `cluster`, renderizar marcador con numero.
- Para `report`, renderizar el marcador actual de mascota.
- Al tocar un cluster, hacer zoom hacia su centro o ajustar el mapa a sus bounds.

Resultado esperado: experiencia de mapa natural sin perder informacion.

## 8. Agregar indices de base de datos - hecho

El endpoint `/api/reports/map` ya filtra por `status`, `last_seen_lat` y `last_seen_lng` usando `BETWEEN`. Para esa consulta concreta conviene agregar un indice btree parcial sobre reportes con coordenadas:

```sql
CREATE INDEX IF NOT EXISTS pet_reports_status_location_idx
ON public.pet_reports (status, last_seen_lat, last_seen_lng)
WHERE last_seen_lat IS NOT NULL
  AND last_seen_lng IS NOT NULL;
```

Estado actual:

- `back/sql/current/001_schema.sql` ya crea indices GiST con PostGIS para busquedas por distancia:
  - `pet_reports_last_seen_geog_idx`
  - `sightings_seen_geog_idx`
- Esos indices ayudan a `/api/nearby-alerts` y a notificaciones cercanas.
- El mapa por bbox todavia no usa operadores PostGIS; por eso el indice btree anterior sigue siendo util para esta etapa.

Mejor etapa con PostGIS para el mapa:

- Usar una expresion geoespacial o columna generada.
- Consultar viewport con operadores geograficos.
- Validar con `EXPLAIN ANALYZE` antes de reemplazar el filtro actual.

Resultado esperado: consultas por viewport rapidas aunque crezca la tabla.

Nota: el indice ya quedo agregado en `back/sql/current/001_schema.sql`. En bases existentes hay que ejecutar el `CREATE INDEX IF NOT EXISTS` manualmente o aplicar el script/migracion correspondiente.

## 9. Medir antes de optimizar mas

- Medir tiempo de respuesta de:
  - bbox pequeno
  - bbox de ciudad
  - bbox muy amplio
- Medir cantidad de items devueltos por zoom.
- Revisar si el clustering en SQL alcanza antes de migrar a PostGIS.

Resultado esperado: decidir con datos si hace falta PostGIS o ajustes de grid.

## 10. Evitar truncamiento como solucion principal

- No ocultar reportes usando `limit` como comportamiento principal del mapa.
- Si se usa `limit`, que sea solo una defensa temporal o de emergencia.
- La solucion principal debe ser clustering.

Resultado esperado: el mapa representa todo lo visible, pero sin saturar red, backend ni navegador.
