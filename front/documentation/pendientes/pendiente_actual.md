# Pendiente actual

## Alertas cercanas

Estado actual:

- Ya existe `GET /api/nearby-alerts`.
- Ya existe PostGIS en `back/sql/current/001_schema.sql`.
- Ya existen preferencias de notificacion en `back/sql/current/004_notification_preferences.sql`.
- Al crear un reporte, el backend crea notificaciones `nearby_report` para usuarios dentro del radio configurado.

Siguiente mejora:

- Extender la API para diferenciar por que aparece una alerta:
  - mascota perdida cerca del usuario
  - avistamiento reciente cerca del usuario
  - reporte urgente
  - reporte con mas avistamientos utiles

Contrato sugerido:

```json
[
  {
    "id": "rep_123",
    "petName": "Max",
    "photoUrl": "/max.jpg",
    "status": "lost",
    "reason": "lost_near_you",
    "distanceKm": 1.4,
    "sightingsCount": 3,
    "lastSightingAt": "2026-05-13T18:20:00"
  },
  {
    "id": "rep_456",
    "petName": "Luna",
    "photoUrl": "/luna.jpg",
    "status": "lost",
    "reason": "recent_sighting_near_you",
    "distanceKm": 0.8,
    "sightingsCount": 5,
    "lastSightingAt": "2026-05-13T16:40:00"
  }
]
```

## Ideas

- Mantener la logica en backend.
- Usar PostGIS para distancia real.
- No resolver cercania solo en frontend.

Prioridad sugerida:

1. Mascotas con avistamiento reciente muy cerca.
2. Mascotas perdidas muy cerca.
3. Reportes urgentes.
4. Reportes con mas avistamientos utiles.
5. Reportes mas recientes.

## Logica de despliegue vigente

IONOS:

- Dominio.
- DNS.
- Quiza landing/blog estatico.

VPS:

- Next.js front.
- Express API.
- Logica de alertas cercanas.
- Conexion a Postgres/PostGIS.

```text
usuario entra a huellamigo.com
        |
dominio en IONOS apunta al VPS
        |
Nginx en VPS
        |
Next.js + Express corriendo con Node
        |
Postgres/PostGIS
```
