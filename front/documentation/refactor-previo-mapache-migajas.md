# Refactor previo a Mapache Migajas

Este documento ordena los sub-refactors recomendados antes de construir la beta **Mapache Migajas**. La intención es preparar el terreno sin hacer una reescritura grande.

## Orden recomendado

1. Documentar el modelo de búsqueda. Estado: completado.
2. Centralizar el concepto de avistamiento/pista. Estado: completado.
3. Separar vista pública y gestión privada. Estado: completado.

Este orden reduce riesgo: primero se define el contrato mental, después se normalizan los datos y al final se ajustan responsabilidades de UI/flujo.

## 1. Documentar el modelo de búsqueda

Estado: completado.

Objetivo: definir la estructura técnica y de producto antes de agregar features.

Documento creado:

- [Modelo de búsqueda para Mapache Migajas](./modelo-busqueda-mapache-migajas.md)

Modelo base:

```text
report -> search session -> clues/sightings -> active area -> actions
```

Decisiones que debe dejar claras:

- Qué es un reporte.
- Qué es una sesión de búsqueda.
- Qué es una pista o avistamiento.
- Qué convierte una pista en útil.
- Qué es una zona activa.
- Qué acciones pertenecen al dueño.
- Qué información es pública y qué información es privada.

Resultado esperado:

- Un contrato simple para la beta.
- Lista de datos que existen hoy.
- Lista de datos que faltan.
- Criterios iniciales para ordenar y priorizar pistas.

## 2. Centralizar avistamiento/pista

Estado: completado.

Objetivo: que todo el sistema interprete los avistamientos de la misma forma.

Hoy el producto mezcla nombres y usos como `sightings`, "Lo vi", avistamientos y actividad. Para Mapache Migajas, cada avistamiento debe poder funcionar como una pista dentro del rastro.

Refactor útil:

- Crear un mapper claro para sightings en backend.
- Crear un normalizador claro para sightings en frontend.
- Definir campos estables:
  - `status`
  - `confidence`
  - `createdAt`
  - `seenAt`
  - `lat`
  - `lng`
  - `photoUrl`
  - `isUseful`
  - `isHidden`
- Evitar que cada componente interprete el avistamiento a su manera.

Resultado esperado:

- Menos lógica duplicada.
- Contrato más estable entre backend y frontend.
- Base lista para convertir avistamientos en "migajas" o pistas del rastro.

Implementado:

- Backend: `back/src/services/report-mapper.js` centraliza `mapSightingRow()`.
- Frontend: `front/lib/sightings.js` centraliza `normalizeSighting()`.
- El contrato normalizado ya expone `status`, `confidence`, `confidenceScore`, `createdAt`, `seenAt`, `lat`, `lng`, `photoUrl`, `isUseful` e `isHidden`.
- Se mantiene compatibilidad con `coordinates` y `trustScore` para no romper mapas o componentes existentes.
- Los componentes de mapa, lista pública y gestión privada consumen el shape normalizado.

## 3. Separar vista pública y gestión privada

Estado: completado.

Objetivo: que la página pública informe y la vista privada coordine la búsqueda.

Mapache Migajas necesitará más lógica privada: marcar pista útil, falso positivo, zona revisada, nota privada, siguiente paso y zona activa. Si eso se mezcla con la página pública, el flujo se vuelve frágil.

Refactor útil:

- Mantener componentes públicos simples.
- Crear una capa clara para datos privados del reporte gestionado.
- Dejar `/mascotas/[slug]` como vista pública informativa.
- Convertir `/gestionar/[id]` en el centro operativo del dueño.

Resultado esperado:

- Menos riesgo de exponer datos privados.
- UI pública más limpia.
- Gestión privada preparada para bitácora, rastro y acciones de búsqueda.

Implementado:

- Frontend: `front/lib/manage.js` centraliza las llamadas privadas de `/api/manage`.
- `front/lib/reports.js` queda enfocado en reportes públicos, reportes propios y creación de reportes.
- `front/lib/sightings.js` queda enfocado en avistamientos públicos y normalización de pistas.
- `/gestionar/[id]` consume `front/lib/manage.js` para reporte gestionado, avistamientos privados y acciones privadas.
- La capa privada normaliza datos operativos como `publicPath`, `canOpenPublicReport`, `canManageSightings` e `isPrivateManagementView`.

## Fuera de alcance para este refactor

- No reescribir el mapa completo.
- No cambiar nombres internos masivamente de `sightings` a `clues`.
- No agregar IA todavía.
- No tocar mobile.
- No rediseñar toda la aplicación.

## Relación con el problema actual

Este refactor prepara la solución descrita en [Problema actual de esta versión](./problema-actual-version.md): pasar de una app que publica reportes a una herramienta que ayuda a seguir una búsqueda.
