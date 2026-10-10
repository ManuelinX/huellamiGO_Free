# Geocoding con Mapbox y cache local

Objetivo: usar Mapbox Geocoding para convertir coordenadas en una direccion legible, pero reducir peticiones externas con una cache propia en Postgres/PostGIS.

Arquitectura deseada:

```txt
Frontend envia lat/lng
        |
Backend busca resultado cercano en cache
        |
Si existe: devuelve cache y actualiza uso
        |
Si no existe: consulta Mapbox
        |
Guarda resultado normalizado
        |
Devuelve direccion al frontend
```

## 1. Definir configuracion - completado

Variables de entorno agregadas en `back/.env`:

```env
MAPBOX_ACCESS_TOKEN=
MAPBOX_GEOCODING_ENABLED=true
MAPBOX_GEOCODING_MONTHLY_LIMIT=90000
GEOCODING_CACHE_RADIUS_METERS=30
GEOCODING_CACHE_TTL_DAYS=180
GEOCODING_CACHE_MAX_ROWS=250000
```

Criterios iniciales recomendados:

- Radio de cache: `30m` para zonas normales, `25m` para zonas con muchos asentamientos y `40m` para zonas rurales.
- TTL: `180 dias`.
- Maximo: `250000` filas.
- Token de Mapbox solo en backend, nunca en frontend.

## 2. Crear tabla de cache - completado

Migracion SQL creada en `back/sql/current/006_geocoding_cache.sql`.

Campos recomendados:

```sql
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mapbox',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  point geography(Point, 4326) NOT NULL,
  formatted_address text NOT NULL,
  country text,
  state text,
  city text,
  municipality text,
  neighborhood text,
  postcode text,
  street text,
  place_name text,
  confidence text,
  quality text,
  raw_response jsonb,
  hit_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Indices recomendados:

```sql
CREATE INDEX IF NOT EXISTS geocoding_cache_point_gist_idx
ON public.geocoding_cache
USING gist (point);

CREATE INDEX IF NOT EXISTS geocoding_cache_cleanup_idx
ON public.geocoding_cache (hit_count, last_used_at, created_at);

CREATE INDEX IF NOT EXISTS geocoding_cache_expires_at_idx
ON public.geocoding_cache (expires_at);
```

## 3. Buscar primero en cache - completado

Implementado en `back/src/services/geocoding.js`.

Antes de llamar Mapbox, buscar el resultado mas cercano dentro del radio configurado:

```sql
SELECT *
FROM public.geocoding_cache
WHERE expires_at > now()
  AND ST_DWithin(
    point,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3
  )
ORDER BY point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
LIMIT 1;
```

Parametros:

- `$1`: lng.
- `$2`: lat.
- `$3`: radio en metros.

Si hay resultado:

- Devolver direccion normalizada.
- Incrementar `hit_count`.
- Actualizar `last_used_at`.
- No llamar Mapbox.

## 4. Consultar Mapbox solo si hay cache miss - completado

Implementado en `back/src/services/geocoding.js`.

Cuando no hay cache valida:

1. Validar que `MAPBOX_GEOCODING_ENABLED=true`.
2. Validar que no se rebaso `MAPBOX_GEOCODING_MONTHLY_LIMIT`.
3. Consultar Mapbox Reverse Geocoding.
4. Normalizar la respuesta a campos propios.
5. Guardar `raw_response` para auditoria/debug.

Campos minimos a devolver al frontend:

```json
{
  "formattedAddress": "Mérida Centro, Mérida, Yucatán, México",
  "country": "México",
  "state": "Yucatán",
  "city": "Mérida",
  "municipality": "Mérida",
  "neighborhood": "Mérida Centro",
  "postcode": "97000",
  "street": null,
  "source": "mapbox",
  "cached": false
}
```

## 5. Guardar resultado nuevo - completado

Implementado en `back/src/services/geocoding.js`.

Al guardar:

- `point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.
- `expires_at = now() + GEOCODING_CACHE_TTL_DAYS`.
- `hit_count = 0`.
- `provider = 'mapbox'`.
- Guardar coordenadas originales.

Evitar duplicados obvios:

- Antes de insertar, repetir busqueda cercana.
- Si alguien inserto durante la misma ventana, reutilizar esa fila.

## 6. Contabilizar uso mensual de Mapbox - completado

Migracion SQL creada en `back/sql/current/007_geocoding_provider_usage.sql`.
Logica implementada en `back/src/services/geocoding.js`.

Crear una tabla simple para conteo mensual:

```sql
CREATE TABLE IF NOT EXISTS public.geocoding_provider_usage (
  provider text NOT NULL,
  period_month date NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, period_month)
);
```

Cada vez que se llama Mapbox:

- Incrementar contador del mes actual.
- Si el contador ya llego al limite, no llamar Mapbox.
- En ese caso devolver solo coordenadas.

## 7. Limpiar cache inteligentemente - completado

Implementado en `back/src/services/geocoding.js`.

No borrar la ultima fila insertada. Borrar primero lo menos util.

Politica recomendada:

1. Borrar expiradas:

```sql
DELETE FROM public.geocoding_cache
WHERE expires_at <= now();
```

2. Si aun hay mas de `GEOCODING_CACHE_MAX_ROWS`, borrar por baja utilidad:

```sql
DELETE FROM public.geocoding_cache
WHERE id IN (
  SELECT id
  FROM public.geocoding_cache
  ORDER BY
    hit_count ASC,
    last_used_at ASC NULLS FIRST,
    created_at ASC
  LIMIT $1
);
```

Esto elimina primero:

- Entradas nunca reutilizadas.
- Entradas usadas hace mucho.
- Entradas viejas.

## 8. Crear endpoint backend - completado

Implementado en `back/src/routes/geocoding.js` y registrado en `back/src/app.js`.

Endpoint recomendado:

```txt
GET /api/geocoding/reverse?lat=20.97512&lng=-89.65548
```

Responsabilidades del endpoint:

- Validar lat/lng.
- Buscar cache.
- Consultar Mapbox si hace falta.
- Guardar cache.
- Actualizar uso.
- Devolver respuesta uniforme.

No exponer el token de Mapbox al cliente.

## 9. Integrar frontend - completado

Implementado en `front/components/report-location-map.js` usando `front/lib/geocoding.js`.

En el frontend, cambiar el flujo de ubicacion:

1. Obtener coordenadas con `navigator.geolocation`.
2. Enviar lat/lng al backend.
3. Mostrar direccion legible si existe.
4. Si falla geocoding, mostrar coordenadas como fallback.

Texto esperado:

```txt
Mérida Centro, Mérida, Yucatán, 97000
```

Fallback:

```txt
20.97512, -89.65548
```

## 10. Validar comportamiento

Validaciones manuales:

- Primera consulta de una coordenada llama Mapbox.
- Segunda consulta cercana devuelve cache.
- `hit_count` aumenta.
- `last_used_at` se actualiza.
- Coordenadas lejanas generan nueva consulta.
- Si se desactiva Mapbox, el endpoint responde controladamente.
- Si se alcanza limite mensual, no llama Mapbox.

Validaciones SQL:

```sql
SELECT count(*) FROM public.geocoding_cache;

SELECT provider, period_month, request_count
FROM public.geocoding_provider_usage
ORDER BY period_month DESC;

SELECT formatted_address, hit_count, last_used_at
FROM public.geocoding_cache
ORDER BY updated_at DESC
LIMIT 20;
```

## 11. Mejoras futuras

Cuando sea necesario:

- Agregar fallback local con INEGI/SEPOMEX.
- Guardar precision/confianza por tipo de resultado.
- Usar radio dinamico: menor en zonas urbanas, mayor en zonas rurales.
- Agregar job programado para limpieza.
- Agregar endpoint admin para ver consumo mensual.
- Agregar metricas de cache hit rate.

Indicador clave:

```txt
cache_hit_rate = cache_hits / total_reverse_geocoding_requests
```

Mientras mas alto sea, menos dependencia y costo de Mapbox.
