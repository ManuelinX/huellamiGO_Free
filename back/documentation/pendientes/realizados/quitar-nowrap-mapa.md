# Quitar noWrap del mapa

Este documento lista puntos a revisar si se quita `noWrap` de Leaflet para que el mapa vuelva a sentirse continuo horizontalmente.

## Que cambia al quitar noWrap

- Leaflet puede repetir el mundo hacia izquierda y derecha.
- El mapa se siente mas natural al arrastrar en zoom bajo.
- Los tiles ya no se cortan en el borde del mundo.

Estado actual del front: el mapa usa bounds verticales amplios y consulta reportes por `bbox` mediante `/api/reports/map`. Si se cambia el comportamiento horizontal de Leaflet, hay que validar que `getMapBbox()` siga enviando longitudes dentro del contrato del backend.

## Riesgos

### Marcadores o clusters duplicados visualmente

Aunque el backend devuelva cada reporte una sola vez, Leaflet puede mostrar copias visuales del mundo.

Solucion posible:

- Mantener el mapa centrado en la region de operacion principal.
- Evaluar `maxBounds` si se quiere limitar la navegacion a Mexico u otra zona.
- Revisar si los marcadores se duplican realmente antes de agregar logica extra.

### bbox cruzando el antimeridiano

Sin `noWrap`, el viewport puede cruzar el borde entre `180` y `-180` grados de longitud.

Ejemplo:

```txt
west = 170
east = -170
```

En ese caso, esta condicion no funciona:

```sql
last_seen_lng BETWEEN west AND east
```

Solucion posible:

```sql
last_seen_lng >= west OR last_seen_lng <= east
```

El backend debe detectar cuando `west > east`.

### bounds fuera del rango normal

Algunos movimientos pueden producir longitudes fuera de `-180..180`.

Solucion posible:

- Normalizar longitudes antes de llamar al backend.
- O permitir que el backend normalice el `bbox`.

## Recomendacion

Para HuellamiGO, si el uso principal es Mexico, `noWrap` es mas simple y reduce casos raros. Si se prefiere una experiencia de mapa continuo, se puede quitar, pero conviene probar:

- zoom out amplio
- arrastre horizontal largo
- clusters cerca de bordes
- que no se dupliquen alertas visualmente
