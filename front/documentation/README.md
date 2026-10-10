# Documentación de HuellamiGO Front

HuellamiGO Front es la app Next.js que muestra reportes de mascotas perdidas, permite crear reportes, recibir Lo vi y gestionar un reporte con link privado.

El runtime actual usa:

- Backend Express mediante `NEXT_PUBLIC_API_URL`.
- Auth propia del backend con JWT guardado localmente.
- Uploads por backend.
- Leaflet para mapas.
- Perfil, verificación de correo y recuperación de contraseña.
- Notificaciones in-app y Web Push con preferencias de ubicación/radio.

Supabase ya no es requerido por el frontend actual.

## Documentación vigente

- [Proyecto y arquitectura](./proyecto.md): rutas, módulos, auth, imágenes y flujo general.
- [Guía de archivos por cambio](./guia-de-cambios.md): dónde tocar código según el cambio.
- [Problema actual de esta versión](./problema-actual-version.md): límite de producto antes de la beta Mapache Migajas.
- [Refactor previo a Mapache Migajas](./refactor-previo-mapache-migajas.md): sub-refactors recomendados y orden de aplicación.
- [Modelo de búsqueda para Mapache Migajas](./modelo-busqueda-mapache-migajas.md): contrato inicial de reporte, búsqueda, pistas, zona activa y acciones.
- [Plan secuencial Mapache Migajas](./plan-secuencial-mapache-migajas.md): orden recomendado para completar la versión.
- [Beta Shield](./beta-shield.md): control de acceso beta con middleware, cookie firmada y allowlist.
- [Alertas y warnings](./ALERTAS-WARNINGS.md): notas operativas sobre fuentes y warnings conocidos.
- [Legacy Supabase](./legacy-supabase.md): notas de la etapa anterior.
- [Pendientes y stand by](./pendientes/README.md): notas, ideas y revisiones no vigentes.

## Rutas principales

- `/`: comunidad, mapa, alertas, formulario de reporte e historias de reencuentro.
- `/mascotas/[slug]`: página pública de una mascota perdida y formulario "La vi".
- `/gestionar/[id]#token=...`: panel privado para marcar reunida, archivar y gestionar avistamientos.
- `/perfil`: datos de cuenta, avatar, contraseña, preferencias y activación de Web Push.

## Comandos útiles

```bash
npm run dev
npm run build
npm run start
```

## Variables necesarias

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Estado de esta versión

La app está lista como base de reporte, mapa, avistamientos y gestión privada. El siguiente problema de producto es convertir el reporte en una búsqueda guiada con rastro y pistas priorizadas; ver [Problema actual de esta versión](./problema-actual-version.md).
