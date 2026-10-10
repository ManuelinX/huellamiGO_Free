# Comandos importantes - debug:
cd <repo>\mobile\app

C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554

# compile release
cd <repo>\mobile\app

C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk --release


# compilar por arquitecturas 
C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk --split-per-abi

# Para subir a Play Store

Mejor usa:

flutter build appbundle

Eso genera un .aab, que Google Play optimiza automáticamente por dispositivo.
El --split-per-abi es más útil cuando vas a distribuir APKs tú mismo, por ejemplo por WhatsApp, página web, pruebas internas, etc.

# direccion - directory apk

<repo>\mobile\app\build\app\outputs\flutter-apk


# Guia mobile Flutter - HuellamiGO

Esta guia sirve para avanzar la app Flutter hasta acercarla al front actual de HuellamiGO, y para tener a mano los comandos importantes de desarrollo.

## Estado actual

- App Flutter en `mobile/app`.
- SDK usado: `C:\Users\Alex\SDK\flutter`.
- Backend configurado por defecto: `http://192.168.0.179:4000`.
- Android permite HTTP local con `android:usesCleartextTraffic="true"`.
- La app ya compila APK debug y release.
- Pantallas actuales:
  - Alertas: lista basica de reportes desde `/api/reports`.
  - Perfil: login basico contra `/api/auth/login`, estado de sesion y reportes propios.
  - Reportar: placeholder.

## Objetivo de producto

Acercar la app Flutter al front web actual, que tiene:

- Header con logo y acciones de perfil/sesion, reportes y notificaciones.
- Inicio con panel de bienvenida.
- Mapa/lista de mascotas perdidas.
- Acciones rapidas: reportar, alertas, QR, compartir.
- Formulario para crear reporte.
- Perfil y sesion.
- Reportes del usuario.
- Pagina publica de mascota.
- Avistamientos: "La vi".
- Gestion privada de reporte.
- Comunidad, estadisticas e historias de reencuentro.

## Ruta secuencial recomendada

### 1. Base tecnica limpia - completado

Objetivo: separar `main.dart` en piezas mantenibles antes de crecer.

- [x] Crear `lib/api/api_client.dart`.
- [x] Crear `lib/models/pet_report.dart`.
- [x] Crear `lib/screens/home_screen.dart`.
- [x] Crear `lib/screens/report_screen.dart`.
- [x] Crear `lib/screens/profile_screen.dart`.
- [x] Dejar `main.dart` solo con `HuellamiGOMobileApp` y navegacion principal.

Resultado esperado: misma app actual, pero con estructura lista para crecer.

### 2. Contratos de API - completado

Objetivo: mapear en Flutter los datos reales que usa el front.

- [x] Expandir `PetReport` con campos del backend/front:
  - `id`
  - `slug`
  - `name`
  - `species`
  - `zone`
  - `lastSeenWhen`
  - `description`
  - `photoUrl`
  - `status`
  - `reward`
  - `latitude`
  - `longitude`
- [x] Crear modelos para:
  - `Reward`
  - `UserProfile`
  - `Sighting`
  - `ReunionStory`
- [x] Hacer que `ApiClient` maneje:
  - headers comunes
  - token JWT
  - errores HTTP
  - JSON malformado

Resultado esperado: la app entiende los mismos datos que la web.

### 3. Home similar al front - completado

Objetivo: convertir la pestana `Alertas` en una experiencia tipo home mobile.

Implementar secciones en este orden:

- [x] Header simple con `HuellamiGO`.
- [x] Panel de bienvenida.
- [x] Lista de alertas activas con foto, nombre, especie, zona y estado.
- [x] Acciones rapidas:
  - Reportar
  - Alertas
  - Compartir
  - Perfil
- [x] Estado vacio y estado de error mas claros.
- [x] Pull to refresh.

Resultado esperado: primera pantalla parecida a la intencion del front, aunque sin mapa todavia.

### 4. UI de cards de mascotas - completado

Objetivo: reemplazar los `ListTile` por tarjetas utiles.

Cada card debe mostrar:

- [x] Foto o avatar fallback.
- [x] Nombre.
- [x] Especie.
- [x] Zona.
- [x] Ultima vez visto.
- [x] Estado.
- [x] Recompensa si existe.
- [x] Boton "La vi".
- [x] Boton "Ver detalle".

Resultado esperado: la lista deja de sentirse como debug y empieza a parecer producto.

### 5. Login y sesion real - completado

Objetivo: que la app conserve sesion y mande token al backend.

- [x] Guardar token en `SharedPreferences`.
- [x] Cargar token al iniciar la app.
- [x] Agregar logout.
- [x] Mostrar estado de sesion en Perfil.
- [x] Enviar `Authorization: Bearer <token>` cuando aplique.
- [x] Manejar token vencido.

Resultado esperado: auth usable desde Perfil, no como apartado separado.

### 6. Perfil - completado

Objetivo: migrar la experiencia basica de perfil del front.

- [x] Mostrar datos del usuario.
- [x] Permitir cerrar sesion.
- [x] Mostrar reportes propios.
- [x] Acceso a gestion de reportes.

Resultado esperado: la pestana Perfil ya tiene utilidad real.

### 7. Crear reporte - completado

Objetivo: reemplazar placeholder `Reportar` por formulario funcional.

Campos iniciales:

- [x] Nombre de mascota.
- [x] Especie.
- [x] Zona.
- [x] Descripcion.
- [x] Fecha o texto de ultima vez visto.
- [x] Recompensa opcional.
- [x] Foto opcional.

Integraciones:

- [x] `POST /api/reports` o endpoint real del backend.
- [x] Foto opcional enviada como `photo_url`.
- [ ] Subida real desde galeria/camara al endpoint `/api/uploads/pet-photo`.
- [x] Validaciones locales antes de enviar.

Nota: la foto opcional queda como URL temporal. La subida real desde galeria/camara requiere agregar selector de archivos/imagenes y se debe conectar al endpoint `/api/uploads/pet-photo`.

Resultado esperado: crear una alerta desde mobile.

### 8. Detalle de mascota - completado

Objetivo: crear una pantalla equivalente a `/mascotas/[slug]`.

Debe mostrar:

- [x] Foto principal.
- [x] Informacion completa del reporte.
- [x] Zona aproximada.
- [x] Recompensa.
- [x] Descripcion.
- [x] Lista de avistamientos publicos.
- [x] Formulario "La vi".
- [x] Accion compartir.
- [ ] share_plus - compartir nativo
- [ ] agregar limites de avistamientos como en el front  web
Nota: la accion compartir muestra aviso temporal. Para compartir nativo hay que agregar un paquete como `share_plus`.

Resultado esperado: cada alerta tiene una pantalla propia.

### 9. Avistamientos - completado

Objetivo: permitir reportar que alguien vio una mascota.

Campos sugeridos:

- [x] Zona o ubicacion aproximada.
- [x] Comentario.
- [x] Foto opcional.
- [x] Fecha/hora aproximada.

Nota: el backend actual guarda `lat`, `lng`, `comment`, `photo_url` y `contact_name`. Por ahora zona y fecha/hora aproximada se agregan dentro del comentario enviado. La foto opcional queda como URL temporal hasta implementar subida real desde galeria/camara.

Resultado esperado: flujo real de ayuda comunitaria.

### 10. Mapa - completado

Objetivo: acercarse al mapa del front.

Opciones:

- Usar `google_maps_flutter` si se trabajara con Google Maps.
- [x] Usar `flutter_map` si se prefiere OpenStreetMap.

Primera version:

- [x] Mostrar marcadores de reportes activos.
- [x] Al tocar marcador, mostrar card resumida.
- [x] Boton para abrir detalle.

Nota: se agrego `lib/screens/map_screen.dart` con `flutter_map` y tiles de CARTO basados en OpenStreetMap. Se evita usar directamente `tile.openstreetmap.org` para no depender de los servidores publicos de OSM en la app. Solo se muestran reportes activos que tengan `latitude` y `longitude`; los reportes sin coordenadas quedan fuera del mapa hasta que el formulario capture ubicacion real.

Resultado esperado: mapa mobile funcional, no solo lista.

### 11. Gestion privada - completado

Objetivo: migrar `/gestionar/[id]?token=...`.

Acciones:

- [x] Marcar como reunida.
- [x] Ocultar/archivar reporte.
- [x] Ver avistamientos privados.
- [x] Escribir historia de reencuentro.

Nota: se agrego `lib/screens/manage_report_screen.dart` y se conecta desde Perfil > Mis reportes > Gestionar. Usa los endpoints reales `/api/manage/:id?token=...`, `/api/manage/:id/status?token=...` y `/api/manage/:id/sightings/:sightingId?token=...`. La historia de reencuentro permite mensaje y visibilidad publica; las fotos de historia quedan pendientes hasta conectar subida real de imagenes.

Resultado esperado: el creador puede administrar su reporte desde la app.

### 12. Comunidad e historias - completado

Objetivo: portar secciones de impacto del front.

- [x] Estadisticas comunitarias.
- [x] Historias de reencuentro.
- [x] Aliados cercanos.

Nota: se agrego `lib/screens/community_screen.dart` y una pestana Comunidad. Las estadisticas combinan `/api/presence`, `/api/reports` y `/api/reports/reunion-stories`; las historias usan los reencuentros publicos reales. Los aliados cercanos quedan como lista local equivalente al front hasta tener endpoint propio.

Resultado esperado: la app no solo reporta, tambien muestra impacto.

### 13. Pulido mobile

Objetivo: dejarla lista para probar con usuarios.

- Loading states consistentes.
- Empty states utiles.
- Mensajes de error legibles.
- Iconos y colores consistentes con HuellamiGO.
- Evitar overflow en pantallas chicas.
- Probar emulador y dispositivo fisico.
- Probar con backend local y backend remoto.

## Mapa front -> Flutter

| Front web | Flutter sugerido |
|---|---|
| `app/page.js` | `lib/screens/home_screen.dart` |
| `components/bottom-nav.js` | `NavigationBar` en `AppShell` |
| `components/lost-pet-map.js` | `lib/screens/map_screen.dart` o widget `LostPetMap` |
| `components/report-form.js` | `lib/screens/report_screen.dart` |
| `components/auth-button.js` | login integrado en `lib/screens/profile_screen.dart` + auth state |
| `components/profile-button.js` | `lib/screens/profile_screen.dart` |
| `components/community-stats.js` | `lib/screens/community_screen.dart` |
| `components/reunion-story-list.js` | `lib/screens/community_screen.dart` |
| `components/my-reports-button.js` | `lib/screens/my_reports_screen.dart` |
| `components/sighting-form.js` | `lib/screens/sighting_form_screen.dart` |
| `app/mascotas/[slug]/page.js` | `lib/screens/pet_detail_screen.dart` |
| `app/gestionar/[id]/page.js` | `lib/screens/manage_report_screen.dart` |

## Comandos importantes

### Ir al proyecto Flutter

```powershell
cd <repo>\mobile\app
```

### Verificar Flutter

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat doctor
```

### Instalar dependencias

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat pub get
```

### Revisar errores de analisis

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat analyze
```

### Correr tests

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat test
```

### Ver dispositivos conectados

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat devices
```

### Correr en emulador

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554
```

### Correr en emulador con backend explicito

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554 --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

### Correr con render por software si parpadea el emulador

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554 --enable-software-rendering --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

### Compilar APK debug

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk --debug
```

Salida:

```text
build\app\outputs\flutter-apk\app-debug.apk
```

### Compilar APK release

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk
```

Salida:

```text
build\app\outputs\flutter-apk\app-release.apk
```

### Instalar APK debug con ADB

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r build\app\outputs\flutter-apk\app-debug.apk
```

### Instalar APK release con ADB

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r build\app\outputs\flutter-apk\app-release.apk
```

### Abrir la app instalada

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe shell monkey -p com.huellamigo.mobile -c android.intent.category.LAUNCHER 1
```

### Reiniciar ADB si el emulador no aparece

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe kill-server
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe start-server
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
```

### Ver logs del emulador

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat
```

### Filtrar logs por la app

```powershell
C:\Users\Alex\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | Select-String -Pattern "com.huellamigo.mobile|flutter|Dart|AndroidRuntime|FATAL"
```

## Backend local

La URL actual del backend en Flutter es:

```text
http://192.168.0.179:4000
```

Para validar desde la PC:

```powershell
Invoke-WebRequest http://192.168.0.179:4000/api/reports
```

Si el emulador no conecta:

- Confirma que el backend este prendido.
- Confirma que escuche en `0.0.0.0` o en la IP LAN, no solo `localhost`.
- Confirma que Windows Firewall permita conexiones al puerto `4000`.
- Confirma que el emulador tenga internet.
- Si usas `http`, conserva `android:usesCleartextTraffic="true"` en `AndroidManifest.xml`.

## Backend por entorno

Aunque existe una URL por defecto en `main.dart`, para pruebas conviene usar `--dart-define`.

Emulador hacia backend en la misma PC:

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554 --dart-define=HUELLAMIGO_API_URL=http://10.0.2.2:4000
```

Emulador o celular hacia backend LAN:

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat run -d emulator-5554 --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

APK release con backend LAN:

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

## Archivos importantes

- `lib/main.dart`: app actual, navegacion y cliente API temporal.
- `android/app/src/main/AndroidManifest.xml`: permisos Android y HTTP local.
- `android/local.properties`: ruta local del SDK Flutter.
- `pubspec.yaml`: dependencias Flutter.
- `test/widget_test.dart`: smoke test basico.

## Checklist antes de probar en emulador

1. Backend encendido en `192.168.0.179:4000`.
2. Emulador abierto y visible en `flutter devices`.
3. `flutter analyze` sin errores.
4. `flutter run -d emulator-5554`.
5. Si se cambia `AndroidManifest.xml`, reinstalar la app.
6. Si se cambia solo Dart, hot reload puede bastar durante `flutter run`.

## Checklist antes de compartir APK

1. Confirmar URL de backend correcta.
2. Compilar release:

```powershell
C:\Users\Alex\SDK\flutter\bin\flutter.bat build apk --dart-define=HUELLAMIGO_API_URL=http://192.168.0.179:4000
```

3. Probar `app-release.apk` en emulador o celular.
4. Confirmar login.
5. Confirmar carga de reportes.
6. Confirmar que no aparecen errores de permisos o red.

## Notas importantes

- `10.0.2.2` solo sirve para que el emulador Android apunte al `localhost` de la PC.
- `192.168.0.179` sirve si el backend esta disponible en la red local.
- En celular fisico, la PC y el celular deben estar en la misma red WiFi.
- Para produccion conviene usar HTTPS y quitar `usesCleartextTraffic`.
- El emulador API 35/36 suele ser mas estable que API 37 para Flutter.
