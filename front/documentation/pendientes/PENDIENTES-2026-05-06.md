# Pendientes HuellamiGO - 2026-05-06

## Prioridad alta

- [x] Probar/soportar flujo completo de gestion privada: crear reporte, guardar link privado, abrir `/gestionar/[id]?token=...`, marcar como reunida y archivar.
- [x] Arreglar estados publicos: `reunited` se maneja como historia y `archived` se oculta del mapa/lista.
- [x] Agregar historias de reencuentro: foto opcional, mensaje corto y permiso para mostrar en comunidad.
- [x] Mostrar "Finales felices" en Comunidad con foto, nombre, mensaje y numero de avistamientos.
- [x] Mejorar gestion de avistamientos: marcar como util, ocultar falso y ver foto/comentario/coordenadas con mas claridad.
- [x] Crear base de alertas cercanas con PostGIS, preferencias y notificaciones `nearby_report`.
- Redefinir alertas cercanas para incluir tambien avistamientos recientes dentro del radio del usuario.

## Prioridad media

- Mejorar el bloque del link privado: boton copiar link, advertencia de no compartir y boton abrir gestion.
- Agregar confirmacion antes de archivar un reporte.
- Traducir errores del backend/uploads/email a mensajes mas humanos.
- Agregar badges de estado en tarjetas: `Activa`, `Vista recientemente`, `Reunida`, `Archivada`.
- Diferenciar motivo de aparicion en alertas: `Perdida cerca de ti`, `Vista cerca de ti` o `Avistamiento reciente`.
- Agregar limite suave sin login: maximo 3 reportes activos por dispositivo/navegador, con mensaje amable y sugerencia de cerrar/archivar uno.
- Revisar el mapa de actividad con mas pruebas; si se confunde, cambiar burbujas a marcadores con numero.
- Explorar avistamientos destacados de aliados sin login: tabla `trusted_sources`, codigo privado de aliado, `trusted_source_id`, `is_highlighted` y mayor `trust_score`.

## Prioridad baja

- Permitir editar reporte desde gestion: nombre, descripcion, zona, recompensa, contacto y foto.
- Agregar notificaciones basicas por email cuando alguien mande `La vi`.
- Preparar version con login para voluntarios, negocios, refugios y admins; usar roles para avistamientos verificados.
- [x] Fortalecer anti-spam basico con rate limit por IP en auth.
- Fortalecer anti-spam para reportes, avistamientos y uploads.
- Mejorar copy emocional en pagina publica, formulario `La vi`, recompensa y reencuentro.

## Recomendacion para retomar

Retomar por alertas cercanas basadas en avistamientos, indices de mapa por bbox y pruebas de carga del endpoint `/api/reports/map`.
