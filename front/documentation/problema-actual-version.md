# Problema actual de esta versión

## Resumen

La versión actual de HuellamiGO ya tiene una base funcional: reportes, mapa, avistamientos, gestión privada, auth, verificación de correo, notificaciones, Web Push y perfiles. El problema principal ya no es "poder reportar", sino que la experiencia todavía se siente centrada en publicar una alerta y esperar.

La siguiente beta, **Mapache Migajas**, debería resolver ese hueco: convertir cada reporte en una búsqueda guiada con rastro, pistas y seguimiento.

## Problema de producto

Cuando una familia pierde una mascota necesita saber qué hacer después de publicar. Hoy la app permite crear el reporte y recibir avistamientos, pero no organiza todavía la búsqueda como un proceso vivo.

Faltan respuestas claras para estas preguntas:

- ¿Cuál fue la última pista útil?
- ¿Qué avistamientos parecen confiables?
- ¿Hacia qué zona se está moviendo la búsqueda?
- ¿Qué zonas ya se revisaron?
- ¿Qué debería hacer ahora la familia?
- ¿A quién se debe alertar si aparece una pista nueva?

## Límite actual del front

El front muestra reportes y avistamientos, pero todavía no presenta una línea de búsqueda completa. La gestión privada permite acciones importantes, aunque aún no funciona como tablero operativo para seguir pistas.

Riesgos UX actuales:

- El mapa muestra puntos, pero no necesariamente un rastro temporal fácil de leer.
- Los avistamientos no se priorizan visualmente por confianza o utilidad.
- El dueño puede recibir información, pero no una guía clara de próximo paso.
- La vista pública y la vista privada no diferencian suficiente entre "informar" y "coordinar búsqueda".

## Límite actual del back

El backend ya tiene piezas fuertes: reportes, avistamientos, PostGIS, notificaciones, preferencias y Web Push. El hueco está en el modelo de seguimiento.

Faltan contratos o estructuras para:

- Clasificar pistas por confianza.
- Marcar zonas como revisadas, descartadas o prioritarias.
- Mantener una línea temporal de búsqueda.
- Calcular "última pista confiable".
- Reorientar alertas según un rastro reciente.
- Separar notas privadas del dueño de información pública.

## Dirección para Mapache Migajas

El objetivo no debería ser agregar más pantallas por volumen, sino crear un motor de seguimiento:

1. Cada avistamiento es una migaja.
2. Las migajas forman un rastro temporal.
3. El sistema destaca las migajas útiles.
4. El dueño gestiona qué se revisó y qué sigue pendiente.
5. Las alertas se mueven con la última zona confiable.

## Primer alcance recomendado

Para evitar una beta demasiado grande, conviene empezar con:

- Línea temporal privada del reporte.
- Mapa con rastro de avistamientos por hora.
- Estados simples para pistas: útil, falso positivo, pendiente.
- Zona activa basada en la última pista útil.
- Panel "qué revisar ahora" con reglas simples.

Este documento reemplaza las notas sueltas como punto de partida de la próxima beta.

