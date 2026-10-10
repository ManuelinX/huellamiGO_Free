# Estrategia de carga inteligente de pistas

Objetivo: mantener disponible toda la informacion de pistas sin cargar ni renderizar miles de elementos al abrir el panel privado.

## Principio

No se debe resolver el volumen ocultando informacion con limites fijos. La version Mapache Migajas debe permitir consultar todo el historial, pero cargarlo de forma contextual:

- El mapa carga por zona visible.
- La lista carga por partes.
- El rastro operativo muestra solo lo necesario para decidir.
- El historial completo queda disponible bajo demanda.

## 1. Mapa por viewport y clusters

El mapa privado debe usar `bbox + zoom`.

Comportamiento esperado:

- Al abrir el mapa, pedir solo las pistas dentro de la pantalla visible.
- En zoom bajo o medio, mostrar clusters con conteo.
- En zoom alto, mostrar pistas individuales.
- Al mover o hacer zoom, pedir otra vez el viewport actual.
- Al tocar un cluster, acercar la vista a sus bounds.

Ventaja:

- No se descargan miles de pistas al abrir.
- No se renderizan miles de marcadores.
- La informacion completa sigue accesible al navegar por el mapa.

## 2. Lista paginada real

La lista de revision no debe tener un limite final oculto.

Comportamiento esperado:

- Pedir un primer bloque de pistas.
- Mostrar boton "Mostrar mas".
- Seguir pidiendo bloques hasta llegar al total real.
- Mostrar contador: `Mostrando X de Y pistas`.
- Mantener prioridad inicial: utiles, pendientes, confianza y recencia.

Opciones tecnicas:

- `limit + offset` para una primera version sencilla.
- Cursor por `created_at + id` si despues se necesita mas estabilidad con datos cambiantes.

## 3. Filtros inteligentes

Cuando el volumen crezca, la utilidad depende de poder reducir ruido.

Filtros recomendados:

- Utiles.
- Pendientes.
- Ocultas/falsas.
- Con foto.
- Alta confianza.
- Por fecha.
- Dentro de la zona visible del mapa.

Estos filtros no eliminan informacion; solo ayudan a encontrarla.

## 4. Resumen y detalle bajo demanda

La interfaz debe separar resumen operativo de historial completo.

Resumen:

- Total de pistas.
- Total utiles.
- Total pendientes.
- Total ocultas/falsas.
- Clusters principales.
- Ultima pista util.

Detalle:

- Abrir cluster para ver pistas de esa zona.
- Cargar mas pistas en lista.
- Ver foto y comentario solo cuando el usuario lo necesite.

## 5. Virtualizacion de listas

Si se necesita mostrar muchas pistas en una misma lista, usar virtualizacion.

Opciones:

- `react-window`.
- `@tanstack/react-virtual`.

Ventaja:

- El usuario puede recorrer cientos o miles de pistas.
- El DOM solo renderiza lo visible.

## Decision recomendada

Para Mapache Migajas:

1. Mapa privado: usar viewport + clusters sin limite artificial final.
2. Rastro de busqueda: mantenerlo como vista operativa de pocas pistas utiles/recientes.
3. Gestion de avisos: convertirla en lista paginada real.
4. Historial completo: agregar contador total y carga progresiva.
5. Filtros: agregarlos despues de que la paginacion real este estable.

## Cambios pendientes para alinear el codigo

- Quitar limites finales que oculten datos.
- Mantener limites solo como tamano de pagina o tamano de respuesta por viewport.
- Agregar total real de pistas en endpoints paginados.
- Agregar `offset` o cursor a `/api/manage/:id/sightings`.
- Cambiar `ManageSightingsPanel` para cargar mas bloques.
- Mantener el mapa usando `/api/manage/:id/sightings/map?bbox=...&zoom=...`.
- Validar con muchos registros que no se descarga todo al abrir, pero que todo se puede consultar.
