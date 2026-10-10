# Plan secuencial para actualizar mobile

Este archivo es una ruta de trabajo para actualizar solo `mobile/app` despues de cambios grandes en front y back. No implica cambios en codigo por si mismo.

## Decision previa: refactorizar o actualizar primero - completado

No conviene hacer un refactor grande antes de sincronizar con front/back. La prioridad deberia ser validar contratos reales de API, pantallas y flujos actuales, porque un refactor amplio antes de conocer las diferencias puede mover codigo que luego igual habra que rehacer.

Si conviene hacer un refactor corto y dirigido antes de crecer mas:

1. [x] Extraer widgets repetidos de tarjetas, mensajes de error/loading y campos de formulario.
2. [x] Centralizar parsing de estados de reporte, por ejemplo `active`, `hidden`, `archived`, `reunited`, `resolved`.
3. [x] Separar llamadas de API por dominio si `ApiClient` sigue creciendo: auth, reports, sightings, community/uploads.
4. [x] Evitar meter nuevas features en pantallas que ya estan largas sin antes separar componentes internos.

Regla practica: primero actualizar contratos y flujos; despues refactorizar lo que estorbe para implementar el siguiente paso. No hacer refactor estetico global todavia.

Estado: completado en mobile. Se agregaron widgets compartidos para feedback, campos y elementos de mascota; se centralizo `ReportStatus`; y `ApiClient` quedo separado por dominio en archivos `api_client_auth`, `api_client_reports`, `api_client_sightings`, `api_client_manage` y `api_client_community`.

Verificacion: `dart analyze` paso sin issues. `flutter analyze` y `flutter test` se quedaron sin salida hasta timeout, asi que quedan pendientes de repetir cuando el entorno Flutter no este bloqueado.

## Alcance

- Tocar solo archivos dentro de `mobile`.
- Mantener front y back como fuente de verdad funcional.
- No cambiar endpoints hasta confirmar la forma actual de request/response.
- Usar `--dart-define=HUELLAMIGO_API_URL=...` para apuntar a backend local/remoto.
- Probar en emulador y, antes de compartir APK, en un celular fisico.

## 0. Preparacion

1. Confirmar rama y cambios locales:

```powershell
cd <repo>\mobile
git status --short
```

2. Entrar al proyecto Flutter:

```powershell
cd <repo>\mobile\app
```

3. Instalar dependencias actuales:

```powershell
..\flutter-sdk\bin\flutter.bat pub get
```

4. Ejecutar validacion base:

```powershell
..\flutter-sdk\bin\flutter.bat analyze
..\flutter-sdk\bin\flutter.bat test
```

## 1. Levantar inventario front/back - completado

Objetivo: saber que cambio realmente antes de tocar mobile.

1. Listar pantallas/flujos actuales del front.
2. Listar endpoints reales del back usados por el front.
3. Para cada endpoint, anotar:
   - metodo HTTP
   - ruta
   - si requiere token
   - body esperado
   - shape de respuesta
   - codigos de error esperados
4. Comparar contra `app/lib/api/api_client.dart`.
5. Crear una tabla de diferencias antes de implementar.

Prioridad de comparacion:

1. Auth: login, `me`, logout/token vencido.
2. Reports: listar, detalle, crear, mis reportes.
3. Sightings: listar, crear, gestionar.
4. Manage: token privado, status, historia de reencuentro.
5. Community: presencia, historias, aliados/estadisticas.
6. Uploads: fotos de mascota, avistamientos e historias.

Estado: completado leyendo solo `front` y `back`, sin modificar nada fuera de `mobile`.

Tabla de diferencias encontradas y accion tomada:

| Area | Front/back actual | Mobile antes | Accion en mobile |
|---|---|---|---|
| Auth | Login, registro, recuperacion, cambio de contrasena y verificacion de correo | Solo login, `me` y token | Se agregaron metodos de auth faltantes en `ApiClientAuth` |
| Reports | `/api/reports`, `/api/reports/:id`, `/api/reports/mine`, `/api/reports/map` | Faltaba cliente para mapa bbox/zoom | Se agrego `getReportMap()` y soporte opcional `status`/`bbox` en `getReports()` |
| Sightings | Crear/listar/gestionar con `photo_url`, `trust_score`, `includeHidden` | Cubierto en lo basico | Se confirmo contrato actual; no requirio cambio funcional |
| Manage | Token privado, status y gestion de avistamientos | Cubierto en lo basico | Se confirmo contrato actual; sigue alineado |
| Community | Presencia e historias publicas | Cubierto en lo basico | Se confirmo contrato actual |
| Uploads | `POST /api/uploads/pet-photo` con multipart campo `photo` WebP | No existia metodo mobile | Se agrego `uploadPetPhoto()` |
| Profile | `GET/PATCH /api/profile` y avatar multipart | Solo lectura de perfil | Se agrego `updateProfile()` y `uploadProfileAvatar()` |
| Notifications | Endpoints existen en front/back | Sin uso actual en mobile | Queda fuera de puntos 1-3 porque no hay UI mobile de notificaciones todavia |

## 2. Sincronizar contratos de datos - completado

Objetivo: que los modelos Flutter acepten los datos reales actuales.

1. Revisar `PetReport` contra la respuesta actual de `/api/reports` y `/api/reports/:id`.
2. Revisar `Sighting` contra la respuesta actual de avistamientos.
3. Revisar `UserProfile` contra `/api/auth/me` y login.
4. Revisar `Reward` y `ReunionStory`.
5. Mantener compatibilidad con `camelCase` y `snake_case` si el backend o front mezclan formatos.
6. Agregar campos faltantes solo si se usan en UI o son necesarios para flujos.

Validacion minima:

```powershell
..\flutter-sdk\bin\flutter.bat analyze
```

Estado: completado.

Cambios aplicados en modelos:

1. [x] `PetReport` acepta el contrato actual de backend/front, incluyendo `contact`.
2. [x] `Sighting` ya aceptaba `coordinates`, `photoUrl`, `contactName`, `status`, `isUseful`, `trustScore` y fechas.
3. [x] `UserProfile` acepta datos de auth y profile, incluyendo `isPublic`.
4. [x] `Reward` y `ReunionStory` ya aceptaban `camelCase` y `snake_case`.
5. [x] Se agrego `UploadedPhoto` para respuesta de uploads.
6. [x] Se agrego `ReportMapItem` para items de `/api/reports/map`, tanto clusters como reportes.
7. [x] Se mantuvo compatibilidad con `camelCase` y `snake_case`.

Verificacion: `dart analyze` paso sin issues.

## 3. Sincronizar ApiClient - completado

Objetivo: que `mobile` hable con el backend actual sin hacks en pantalla.

1. Confirmar `HUELLAMIGO_API_URL`.
2. Validar que cada endpoint del front tenga equivalente en `ApiClient`.
3. Agregar metodos faltantes de forma agrupada.
4. Revisar manejo de errores HTTP y token vencido.
5. Revisar si hay endpoints que ahora usan `multipart/form-data`.
6. Si hay uploads, crear metodos especificos en `ApiClient` o un servicio separado.

Pendientes conocidos en mobile actual:

- Subida real de imagenes desde galeria/camara.
- Compartir nativo.
- Limites/validaciones de avistamientos iguales al front.
- Aliados cercanos todavia son lista local, no endpoint real.
- URL por defecto sigue siendo una IP LAN hardcodeada; para pruebas usar siempre `--dart-define`.

Estado: completado para contratos base.

Cambios aplicados en `ApiClient`:

1. [x] Se confirmo `HUELLAMIGO_API_URL`; la app mantiene `--dart-define` y fallback local.
2. [x] Se agregaron metodos faltantes de auth: registro, recuperacion, cambio de contrasena y verificacion de correo.
3. [x] Se agrego `getReportMap()` para `/api/reports/map?bbox=...&zoom=...&status=...`.
4. [x] Se agrego upload multipart para `POST /api/uploads/pet-photo`.
5. [x] Se agrego update de perfil y upload de avatar.
6. [x] Se reviso el manejo de 401: conserva limpieza de token.
7. [x] Se agrego soporte multipart sin mandar `Content-Type: application/json`.

Pendiente intencional: notificaciones existen en front/back, pero no se agregaron al cliente porque mobile aun no tiene pantalla o flujo que las use. Conviene agregarlas cuando se implemente notificaciones mobile para no cargar API muerta.

Verificacion: `dart pub get` paso con red habilitada y `dart analyze` paso sin issues. `flutter analyze` y `flutter test` siguen pendientes porque el comando Flutter se queda sin salida hasta timeout en este entorno.

## 4. Actualizar formulario de reporte - implementado, pruebas manuales pendientes

Objetivo: que crear alerta en mobile genere el mismo resultado que el front.

1. [x] Comparar campos actuales del front con `ReportScreen`.
2. [x] Confirmar nombres exactos esperados por backend:
   - `pet_name`
   - `pet_type`
   - `description`
   - `zone`
   - `last_seen_place`
   - `last_seen_lat`
   - `last_seen_lng`
   - recompensa
   - contacto
   - foto
3. [x] Cambiar foto por flujo real de galeria/camara si el backend ya tiene upload estable.
4. [x] Reemplazar lat/lng por seleccion real o ubicacion actual si el front ya lo maneja mejor.
5. [ ] Probar crear reporte con y sin recompensa.
6. [ ] Probar crear reporte con y sin foto.

Estado: implementado en mobile. Queda pendiente la prueba manual contra backend local/remoto.

Cambios aplicados:

1. Se alineo `ReportScreen` con los campos del front: mascota, zona, ultimo lugar, descripcion, recompensa, contacto, `public_whatsapp`, foto y `status: active`.
2. La foto es obligatoria. Ya no se captura como URL manual; ahora se selecciona con Photo Picker, se convierte a WebP y se sube con `POST /api/uploads/pet-photo`.
3. Se agrego mini mapa en `Ubicacion aproximada`: el usuario puede tocar el mapa para elegir punto, usar ubicacion actual con `geolocator`, centrar el mapa o editar lat/lng manualmente si la ubicacion falla o es incorrecta.
4. Se agrego bloqueo de publicacion si el usuario no tiene correo verificado, igual que el front.
5. Se agregaron dependencias mobile: `image_picker` y `flutter_image_compress`.
6. Se agrego permiso iOS de galeria en `Info.plist`.

Verificacion: `dart pub get` paso con red habilitada y `dart analyze` paso sin issues. La prueba real de crear reporte con/sin recompensa y con/sin foto queda como prueba manual contra backend local/remoto, porque requiere sesion verificada, emulador/dispositivo y API levantada.

## 5. Actualizar detalle y avistamientos - implementado, pruebas manuales pendientes

Objetivo: que la pantalla publica de mascota quede alineada con el front.

1. [x] Confirmar si el detalle se abre por `id`, `slug` o ambos.
2. [x] Validar lista de avistamientos publicos.
3. [x] Aplicar mismas reglas de limite, campos obligatorios y mensajes que el front.
4. [x] Implementar foto real en avistamiento si el backend lo soporta.
5. [x] Revisar que reportes reunidos no permitan enviar avistamientos.
6. [x] Revisar textos de privacidad/contacto.

Estado: implementado en mobile. Queda pendiente la prueba manual contra backend local/remoto.

Cambios aplicados:

1. El detalle sigue abriendo por `id`; en el backend/front actual `slug` equivale a `id`.
2. La lista publica de avistamientos sigue usando `GET /api/reports/:id/sightings` sin `includeHidden`, alineada con el front.
3. El formulario de "La vi" ahora valida sesion y correo verificado antes de enviar.
4. Se agrego cooldown local de 60 segundos por reporte, igual que el front.
5. El comentario paso a ser opcional; ubicacion y coordenadas siguen siendo obligatorias.
6. La foto del avistamiento ahora usa Photo Picker, se convierte a WebP y se sube con `POST /api/uploads/pet-photo`.
7. `trust_score` se calcula como en el front: base 35, +25 foto, +15 comentario, +10 contacto, maximo 100.
8. Se agrego uso de ubicacion actual con `geolocator` para llenar lat/lng del avistamiento.
9. Reportes reunidos no muestran el formulario y ademas el submit tiene una proteccion defensiva.
10. Se agrego bloque de contacto/privacidad usando el contrato `report.contact`.

Verificacion: `dart analyze` paso sin issues. Las pruebas reales de envio con/sin foto y cooldown requieren backend levantado, usuario con correo verificado y emulador/dispositivo.

## 6. Actualizar gestion privada

Objetivo: que el creador pueda administrar reportes igual que en web.

1. Confirmar rutas `/api/manage/:id?...` actuales.
2. Confirmar expiracion y nombre del token de gestion.
3. Probar:
   - abrir reporte propio desde Perfil
   - marcar como reunida
   - ocultar/archivar
   - revisar avistamientos privados
   - marcar avistamiento util/no util
   - crear historia de reencuentro
4. Agregar upload de fotos de historia si ya existe endpoint.

## 7. Actualizar mapa

Objetivo: que el mapa refleje datos reales y no deje fuera reportes por falta de coordenadas.

1. Confirmar si backend devuelve coordenadas como array, `lat/lng`, `latitude/longitude` o `last_seen_lat/lng`.
2. Verificar permisos Android/iOS de ubicacion.
3. Probar permisos denegados, concedidos y bloqueados.
4. Definir fallback para reportes sin coordenadas:
   - no mostrarlos en mapa, pero si en lista
   - o geocodificar zona si el backend/front ya lo hace
5. Revisar proveedor de tiles antes de produccion.

## 8. Actualizar comunidad

Objetivo: quitar datos locales si back ya expone datos reales.

1. Confirmar endpoints actuales para:
   - estadisticas
   - presencia
   - historias
   - aliados cercanos
2. Reemplazar aliados hardcodeados cuando exista endpoint.
3. Confirmar que historias publicas usen las mismas reglas que front.
4. Probar estado sin historias, con historias y error de red.

## 9. Pulido visual y UX

Objetivo: dejar mobile usable, no solo conectado.

1. Revisar overflows en pantallas chicas.
2. Unificar loading, empty y error states.
3. Unificar tarjetas de mascota entre Home, Mapa y Perfil.
4. Revisar colores, espaciados e iconos contra front.
5. Revisar textos con acentos antes de release.
6. Confirmar que todos los botones importantes tengan feedback al cargar.

## 10. Pruebas manuales obligatorias

Ejecutar con backend local desde emulador:

```powershell
..\flutter-sdk\bin\flutter.bat run -d emulator-5554 --dart-define=HUELLAMIGO_API_URL=http://10.0.2.2:4000
```

Ejecutar con backend LAN:

```powershell
..\flutter-sdk\bin\flutter.bat run -d emulator-5554 --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

Checklist:

1. App abre sin error.
2. Login correcto.
3. Token vencido cierra sesion o pide login.
4. Home carga reportes.
5. Pull to refresh funciona.
6. Mapa carga marcadores.
7. Crear reporte funciona.
8. Detalle carga por reporte nuevo.
9. Enviar avistamiento funciona.
10. Perfil muestra reportes propios.
11. Gestion privada funciona.
12. Comunidad carga estadisticas e historias.
13. Error de backend apagado muestra mensaje entendible.
14. APK release abre y apunta al backend correcto.

## 11. Build final

Antes de generar APK:

```powershell
..\flutter-sdk\bin\flutter.bat analyze
..\flutter-sdk\bin\flutter.bat test
```

APK debug:

```powershell
..\flutter-sdk\bin\flutter.bat build apk --debug --dart-define=HUELLAMIGO_API_URL=http://10.0.2.2:4000
```

APK release con backend definido:

```powershell
..\flutter-sdk\bin\flutter.bat build apk --release --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

Salida esperada:

```text
app\build\app\outputs\flutter-apk\app-release.apk
```

## Orden recomendado de implementacion

1. Contratos de API y modelos.
2. `ApiClient`.
3. Auth/perfil.
4. Reportes: lista, detalle y crear.
5. Uploads de imagenes.
6. Avistamientos.
7. Gestion privada.
8. Mapa.
9. Comunidad.
10. Refactor dirigido de widgets repetidos.
11. Pulido visual.
12. Pruebas y build.

## Criterio para considerar mobile actualizado

Mobile queda actualizado cuando:

1. Todos los endpoints usados por front tienen equivalente probado en Flutter si aplican a mobile.
2. No hay campos criticos ignorados por modelos.
3. Crear reporte, ver detalle, enviar avistamiento y gestionar reporte funcionan de punta a punta.
4. Las imagenes ya no dependen de pegar URLs manualmente.
5. `flutter analyze` y `flutter test` pasan.
6. APK release fue probado contra el backend correcto.
