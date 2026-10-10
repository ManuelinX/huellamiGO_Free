# Siguientes pasos visuales para acercar mobile a web

Estado actual: mobile ya usa paleta HuellamiGO, header propio, assets de logo/pins del front, formulario por secciones y tarjetas base mas cercanas a la web.

## Prioridad siguiente

1. Revisar pantalla por pantalla en dispositivo real
   - Alertas
   - Mapa
   - Crear reporte
   - Comunidad
   - Perfil
   - Detalle de mascota

2. [ECHO] Afinar tipografia real
   - Incluir archivos `.ttf` de Poppins, Manrope o Nunito Sans en `assets/fonts`.
   - Declararlos en `pubspec.yaml`.
   - Cambiar `fontFamilyFallback` por `fontFamily` real para que Android no use solo la fuente del sistema.

3. [ECHO] Igualar tarjetas de detalle
   - Usar foto principal grande como en web.
   - Separar bloques: alerta, ubicacion, contacto, avistamientos e historia.
   - Reducir cards anidadas y usar paneles simples.

4. [ECHO] Afinar mapa
   - Probar tamanos de los pins web en celular fisico.
   - Agregar tarjeta de grupo cuando haya varios reportes muy cercanos.
   - Usar el mismo criterio visual de selected/unselected que web.

5. [ECHO] Unificar empty/loading/error states
   - Crear un solo componente de estado visual para mobile.
   - Usar icono en bloque bosque/coral, copy corto y accion clara.

6. [ECHO] Reemplazar iconos launcher
   - Generar iconos Android/iOS/Web desde el logo actual de HuellamiGO.
   - Mantener `applicationId` nuevo: `com.huellamigo.mobile`.

7. Comparar contra capturas web
   - Tomar screenshots mobile de las pantallas principales.
   - Compararlas con `front/app/page.js`, `/alertas`, `/reportar` y detalle.
   - Ajustar spacing, radios y pesos de texto donde se sienta Material default.

## Criterio de cierre

Mobile se considera alineada visualmente cuando una persona que ya vio la web identifica la app como el mismo producto sin necesitar leer el nombre.
