# Recomendaciones: actualizacion cercana por nuevo avistamiento

## Objetivo

Notificar a usuarios cercanos cuando un avistamiento indique que la mascota probablemente se movio a una zona nueva y accionable.

Esta notificacion no debe significar "hubo otro Lo vi". Debe significar:

> "La zona probable cambio y ahora tu podrias ayudar cerca de aqui."

## Riesgo principal

Este flujo es muy potente, pero fragil. Si se envia por cada avistamiento, la app se vuelve spam.

Riesgos:

- Notificar demasiadas veces el mismo reporte.
- Avisar a usuarios por movimientos pequenos que no cambian la zona real.
- Repetir alertas a quienes ya recibieron la alerta inicial.
- Generar ruido cuando el dueno ya recibe digest/alta actividad.
- Exponer ubicaciones demasiado exactas en push.

## Principio de producto

No notificar cada avistamiento. Notificar solo cuando el avistamiento cambie la zona probable de busqueda.

## Regla MVP recomendada

Para la primera version, usar una regla conservadora:

- El reporte debe estar `active`.
- El avistamiento debe tener `trust_score >= 60` o `source_type` confiable.
- El punto del avistamiento debe estar al menos a 1 km del punto original del reporte.
- Debe haber cooldown por reporte de 12 horas.
- Cada usuario debe recibir maximo 1 update por reporte por dia.
- Radio de usuarios destinatarios: 2 km alrededor del nuevo avistamiento.

Si todas se cumplen:

- Buscar usuarios con alertas cercanas activas y zona base dentro del radio.
- Excluir al dueno del reporte.
- Crear notificacion `nearby_sighting`.
- Usar dedupe especifico de update.

## Estado tecnico actual

Refactor previo listo:

- `back/src/utils/geo-distance.js` centraliza distancia y centroide.
- `back/src/services/sighting-digest-queue.js` ya usa ese helper para agrupar avistamientos.
- `back/src/services/notification-rules.js` ya tiene `getNearbySightingUpdateDecision()`.
- `back/src/services/nearby-sighting-update-notifications.js` ya procesa ventanas, clusters, confianza, cooldown, dry-run y envio real.
- `back/src/config/nearby-sighting-updates.js` contiene los umbrales editables para las betas.
- `back/sql/current/011_nearby_sighting_update_queue.sql` agrega la cola y el historial de clusters notificados.

Importante:

- El flujo ya esta conectado a `createSighting()`, pero queda apagado por default con `enabled=false`.
- Para observar decisiones sin mandar push, usar `enabled=true` y `dryRun=true`.
- Para mandar notificaciones reales, usar `enabled=true` y `dryRun=false`.
- Requiere correr la migracion `011_nearby_sighting_update_queue.sql`.

## Dedupe recomendado

Por usuario + reporte + dia:

```txt
nearby_sighting_update:<report_id>:<YYYY-MM-DD>
```

Esto evita que la misma persona reciba muchas actualizaciones del mismo reporte en un dia.

## Cooldown por reporte

Ademas del dedupe por usuario, aplicar cooldown global por reporte:

```txt
maximo 1 actualizacion cercana por reporte cada 12 horas
```

Esto evita que un reporte con muchos avistamientos active zonas nuevas cada pocos minutos.

## Radio recomendado

Para MVP:

```txt
2 km fijo alrededor del nuevo avistamiento
```

No usar todavia los radios de prioridad del reporte. Este flujo es mas delicado que la alerta inicial.

Futuro:

```txt
high: 3 km
medium: 2 km
low: 1 km
```

## Texto recomendado

No mostrar direccion exacta ni coordenadas.

Titulo:

```txt
Nuevo avistamiento cercano
```

Cuerpo:

```txt
Una mascota perdida fue vista recientemente cerca de tu zona.
```

Si se incluye nombre:

```txt
Luna fue reportada recientemente cerca de tu zona.
```

Evitar:

```txt
Vista en Calle 21 #123
20.97013, -89.62018
```

## Version 1: comparar contra punto original

Implementacion mas simple:

1. Llega un avistamiento.
2. Calcular distancia entre:
   - `pet_reports.last_seen_lat/lng`
   - `sightings.lat/lng`
3. Si distancia `< 1 km`, no hacer nada.
4. Si distancia `>= 1 km`, evaluar confianza/cooldown/dedupe.
5. Si pasa todo, notificar usuarios cercanos al avistamiento.

Ventaja:

- Simple.
- No requiere tabla nueva.
- Facil de probar.

Desventaja:

- Si la mascota ya se movio antes, puede comparar contra un punto viejo.

## Version 2: comparar contra ultimo cluster notificado

Estado: implementado, configurable y apagado por default.

Mejor version, para despues del MVP:

1. Cuando se manda una actualizacion cercana, guardar el punto representativo notificado.
2. Ese punto representa el ultimo cluster/zona notificada.
3. Cuando llega un nuevo grupo de avistamientos, calcular su centroide.
4. Comparar contra el ultimo cluster notificado.
5. Si distancia `>= 700 m`, es candidato a nueva actualizacion.

Ejemplo:

```txt
Ultimo cluster notificado:
20.9700, -89.6200

Nuevo cluster:
20.9760, -89.6245

Distancia: 850 m
Resultado: candidato
```

Si la distancia es baja:

```txt
Distancia: 120 m
Resultado: misma zona, no notificar
```

Ventaja:

- Evita repetir alertas cuando la mascota ya se fue moviendo.
- Detecta mejor cambios reales de zona.

Desventaja:

- Requiere persistir el ultimo cluster notificado.
- Requiere mas reglas y test.

Reglas implementadas:

- Ventana default: 10 minutos.
- Radio de cluster default: 500 m.
- Distancia minima contra ultimo cluster: 700 m.
- Distancia minima contra punto original: 1 km.
- Minimo de avistamientos por cluster: 2.
- Confianza minima del cluster: 70.
- Excepcion configurable para fuente confiable individual.
- Cooldown default por reporte: 12 h.
- Dedupe por usuario/reporte/dia.
- Penalizacion por misma IP.
- Suma decreciente si los avistamientos vienen del mismo usuario/IP.
- Penalizacion si el cluster esta muy disperso.
- `dryRun` guarda la decision y cluster candidato, pero no envia notificaciones.

Archivo de configuracion:

```txt
back/src/config/nearby-sighting-updates.js
```

## Datos que convendria guardar en futuro

Tabla posible:

```txt
report_sighting_update_notifications
```

Campos:

```txt
id
report_id
sighting_id
lat
lng
zone_label
notified_at
dedupe_bucket
created_at
```

Tambien se puede resolver solo con `notification_logs.data`, pero una tabla dedicada seria mas clara si este flujo crece.

## Relacion con digest del dueno

Este flujo no reemplaza digest.

Separacion:

- Digest/alta actividad: informa al dueno.
- Actualizacion cercana: informa a usuarios cerca de la nueva zona.

No se debe usar este flujo para notificar al dueno.

## Criterios para no enviar

No enviar update si:

- Reporte no esta activo.
- Avistamiento tiene baja confianza.
- Nuevo punto esta muy cerca del punto original o ultimo cluster.
- Ya se envio update del reporte en las ultimas 12 horas.
- El usuario ya recibio update de ese reporte hoy.
- El usuario desactivo alertas cercanas.
- El usuario es el dueno del reporte.

## Orden recomendado de implementacion

1. Implementar version 1 comparando contra punto original.
2. Usar `trust_score >= 60`.
3. Usar radio fijo de 2 km.
4. Usar dedupe por usuario/reporte/dia.
5. Usar cooldown global por reporte de 12 horas.
6. Probar en beta cerrada.
7. Luego evaluar version 2 con ultimo cluster notificado.

## Checklist de beta

- Avistamiento a menos de 1 km no manda update cercano.
- Avistamiento a mas de 1 km con baja confianza no manda update cercano.
- Avistamiento a mas de 1 km con confianza suficiente manda update cercano.
- El dueno no recibe esta notificacion por este flujo.
- Un usuario no recibe dos updates del mismo reporte el mismo dia.
- El reporte no manda otro update cercano antes de 12 horas.
- El push no muestra direccion exacta ni coordenadas.
