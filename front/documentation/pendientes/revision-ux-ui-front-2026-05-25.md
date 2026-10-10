No toqué código. Sí veo varios problemas de UX/UI que valen la pena atender.

**Más importantes**

1. **[HECHO] Ubicación por defecto puede publicarse sin que el usuario marque nada**
   En `ReportLocationMap` siempre hay coordenadas iniciales en inputs hidden. Entonces el formulario cree que ya hay ubicación aunque el usuario nunca tocó el mapa. Esto puede crear reportes o “Lo vi” en una zona incorrecta.
   Referencia: [report-location-map.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/report-location-map.js:39), [report-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/report-form.js:152), [sighting-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/sighting-form.js:94)

2. **[HECHO] El formulario “Lo vi” tiene el mismo problema de login que tenía Reportar**
   Deja llenar todo y al final dice `Inicia sesion para enviar un Lo vi`, pero no abre login ni avisa desde arriba.
   Referencia: [sighting-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/sighting-form.js:86)

3. **[HECHO-OCULTADO] Botón “Contactar familia” parece funcional, pero no hace nada**
   En detalle de mascota hay un `<button>` sin handler. Eso genera frustración porque parece una acción principal.
   Referencia: [page.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/app/mascotas/[slug]/page.js:88)

4. **[HECHO] Si el usuario no verificó correo, el bloqueo aparece tarde**
   En Reportar y Lo vi se valida al enviar. Sería mejor mostrar aviso arriba del formulario con acción clara para reenviar verificación.
   Referencias: [report-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/report-form.js:81), [sighting-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/sighting-form.js:90)

5. **[HECHO] Recompensa puede confundir**
   El monto aparece siempre con `250`, aunque “Ofrecer recompensa” esté desactivado. Puede parecer que se publicará una recompensa aunque no sea así.
   Referencia: [report-form.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/report-form.js:333)

**Mejoras recomendadas**

6. **[HECHO] Mensajes de error aparecen al final, no junto al campo**
   Si falta foto, ubicación o nombre, el mensaje sale abajo. En formularios largos, conviene marcar el paso/campo con error y hacer scroll al primer problema.

7. **Stats de home parecen datos reales pero están hardcodeadas**
   `8,482`, `2,156`, etc. pueden afectar confianza si aún no son métricas reales.
   Referencia: [page.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/app/page.js:56)

8. **[HECHO] “{featuredPet.name} guardada” puede ser raro**
   En comunidad se muestra la primera mascota como “guardada”, aunque puede ser una mascota actualmente perdida. Suena a estado incorrecto.
   Referencia: [page.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/app/page.js:268)

9. **[HECHO] Toggles de notificaciones se guardan automáticamente, pero no confirman éxito**
   Si el usuario activa/desactiva alertas, no queda claro si se guardó. Un “Guardado” breve ayudaría.
   Referencia: [notification-preferences-panel.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/notification-preferences-panel.js:96)

10. **[HECHO] Drawers de Mis reportes/Notificaciones podrían tener el mismo riesgo que el modal anterior**
   Están renderizados dentro del header, no en portal. Si Brave/Chrome se comportan raro por `sticky`/`backdrop-filter`, podrían anclarse visualmente.
   Referencias: [my-reports-button.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/my-reports-button.js:81), [notifications-button.js](/c:/Users/Alex/Documents/proyectos/HuellamiGO/codeV1/front/components/notifications-button.js:168)

Prioridad recomendada: primero ubicación obligatoria real, luego login/registro en “Lo vi”, luego arreglar “Contactar familia” y estados de correo no verificado.
