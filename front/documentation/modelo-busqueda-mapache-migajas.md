# Modelo de búsqueda para Mapache Migajas

Este documento define el contrato inicial para convertir un reporte de mascota perdida en una búsqueda guiada. No introduce cambios de código por sí mismo; sirve como base para los siguientes refactors.

## Modelo base

```text
report -> search session -> clues/sightings -> active area -> actions
```

## Principios

- Un reporte describe el caso público de una mascota perdida.
- Una sesión de búsqueda describe el trabajo privado alrededor de ese reporte.
- Cada avistamiento puede convertirse en una pista.
- No toda pista debe tener el mismo peso.
- La zona activa debe salir de la evidencia más útil y reciente.
- La vista pública informa; la vista privada coordina.
- La privacidad del dueño y de los reportantes pesa más que la precisión visual del mapa.

## Entidades

### Report

Representa la alerta principal.

Datos actuales relacionados:

- Mascota: nombre, tipo, descripción, etapa de vida.
- Última ubicación conocida: zona, lugar, lat/lng aproximado.
- Foto principal.
- Estado: `active`, `reunited`, `archived`.
- Datos de contacto protegidos.
- Señales de prioridad: vulnerable, urgente, medicamento.

Responsabilidad:

- Ser la fuente pública del caso.
- Mantener la identidad de la mascota y el estado general.
- Servir como raíz de la búsqueda.

### Search Session

Representa la búsqueda activa alrededor de un reporte.

Estado actual:

- Todavía no existe como entidad separada.
- Hoy vive implícitamente entre el reporte, los avistamientos y la gestión privada.

Responsabilidad futura:

- Agrupar pistas, zonas, acciones y estado operativo.
- Separar la lógica privada del dueño de la información pública.
- Mantener el progreso de la búsqueda aunque el reporte público siga siendo simple.

Campos candidatos:

- `reportId`
- `status`: `searching`, `active_trail`, `paused`, `reunited`, `archived`
- `activeArea`
- `lastUsefulClueId`
- `lastUpdatedAt`
- `privateNotes`

### Clue / Sighting

Representa una pista individual. En la versión actual, su fuente principal es un avistamiento enviado desde "Lo vi".

Datos actuales relacionados:

- Reporte asociado.
- Zona o comentario.
- Foto opcional.
- Lat/lng aproximado.
- Fecha de creación.
- Estado visible/pendiente/oculto.
- Señales de gestión privada como útil o falso positivo.

Responsabilidad:

- Aportar evidencia al rastro.
- Alimentar la zona activa.
- Ayudar a decidir qué revisar después.

Campos estables recomendados para normalizar:

- `id`
- `reportId`
- `status`
- `confidence`
- `createdAt`
- `seenAt`
- `lat`
- `lng`
- `photoUrl`
- `comment`
- `isUseful`
- `isHidden`
- `sourceType`

Estados iniciales recomendados:

- `pending`: pista recibida, todavía no evaluada.
- `useful`: pista marcada como útil.
- `false_positive`: pista descartada.
- `hidden`: pista oculta de la vista pública.

Confianza inicial recomendada:

- `low`: sin foto, poca descripción o ubicación poco clara.
- `medium`: ubicación clara o comentario útil.
- `high`: foto, ubicación clara y coincidencia fuerte con el reporte.

### Active Area

Representa la zona que conviene revisar ahora.

Estado actual:

- Todavía no existe como entidad explícita.
- Hoy se puede inferir de la última ubicación del reporte o de avistamientos recientes.

Responsabilidad futura:

- Mostrar hacia dónde se concentra la búsqueda.
- Reorientar alertas cercanas.
- Dar una recomendación práctica al dueño.

Campos candidatos:

- `centerLat`
- `centerLng`
- `radiusMeters`
- `reason`
- `sourceClueIds`
- `confidence`
- `updatedAt`

Criterio inicial:

- Si hay una pista útil reciente, la zona activa sale de esa pista.
- Si hay varias pistas útiles cercanas, la zona activa sale del centro aproximado.
- Si no hay pistas útiles, la zona activa sigue siendo la última ubicación conocida.

### Actions

Representan pasos operativos para el dueño.

Ejemplos:

- Marcar pista como útil.
- Marcar falso positivo.
- Marcar zona como revisada.
- Agregar nota privada.
- Actualizar zona activa.
- Compartir reporte público.
- Cerrar búsqueda como reunida.

Responsabilidad:

- Convertir datos en decisiones.
- Dar seguimiento a lo que ya se revisó.
- Evitar que la búsqueda dependa solo de memoria o chats externos.

## Público vs privado

Información pública:

- Reporte activo.
- Foto principal.
- Zona aproximada.
- Descripción segura.
- Avistamientos públicos no ocultos.
- Estado general del reporte.

Información privada:

- Notas del dueño.
- Clasificación de pista útil/falso positivo si puede exponer comportamiento.
- Zonas revisadas.
- Datos exactos de contacto.
- Decisiones operativas de búsqueda.
- Link de gestión.

Regla:

- `/mascotas/[slug]` informa.
- `/gestionar/[id]` coordina.

## Priorización inicial de pistas

Orden recomendado:

1. Pistas útiles marcadas por el dueño.
2. Pistas con foto.
3. Pistas recientes.
4. Pistas cercanas a la zona activa.
5. Pistas de usuarios con mejor contexto o historial.
6. Pistas pendientes.
7. Pistas marcadas como falso positivo u ocultas.

## Datos que existen hoy

- Reportes públicos y privados.
- Avistamientos asociados a reportes.
- Estados de reporte.
- Gestión privada por token.
- Notificaciones cercanas.
- PostGIS para distancia.
- Preferencias de notificación.
- Web Push.

## Datos que faltan

- Entidad explícita de sesión de búsqueda.
- Zona activa persistida.
- Estados normalizados de pista como contrato estable.
- Confianza normalizada de pista.
- Zonas revisadas o descartadas.
- Notas privadas por pista o por zona.
- Acciones sugeridas.

## Primer contrato práctico

Antes de crear tablas nuevas, el siguiente refactor debería asegurar que el front y el back puedan hablar de una pista con este shape normalizado:

```js
{
  id,
  reportId,
  status,
  confidence,
  createdAt,
  seenAt,
  lat,
  lng,
  photoUrl,
  comment,
  isUseful,
  isHidden
}
```

Eso permite construir el rastro sin cambiar todavía todo el modelo interno.

Estado actual:

- Este contrato ya quedó centralizado en los mappers de avistamientos del backend y del frontend.
- Aún no existe una tabla separada para `search session`, `active area` o `actions`.
