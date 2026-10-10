# Resumen de cambios mobile - 2026-05-25

Alcance aplicado: solo se modifico `mobile/app`. No se tocaron archivos de `front` ni de `back`.

## Cambios realizados

### Reportes

- Se alineo el formulario mobile con campos tecnicos que ya existen en front/back:
  - `is_vulnerable`
  - `is_urgent`
  - `needs_medication`
  - `pet_life_stage`
- Se agregaron validaciones locales equivalentes a backend/front:
  - nombre, tipo, zona y ultimo lugar: maximo 32 caracteres
  - descripcion: maximo 128 caracteres
  - recompensa publica: minimo 10 MXN
- Se quito el envio automatico de coordenadas de prueba desde el formulario.
- Ahora el reporte exige que el usuario marque una ubicacion aproximada o use ubicacion actual antes de publicar.
- Se mantiene foto obligatoria y subida WebP por `POST /api/uploads/pet-photo`.

### Mapa

- La pantalla de mapa ya no carga todos los reportes con `/api/reports`.
- Ahora usa el endpoint tecnico del backend:
  - `GET /api/reports/map?bbox=...&zoom=...&status=active`
- Se agrego carga por viewport al mover o hacer zoom.
- Se agrego soporte de clusters devueltos por backend.
- Al tocar un cluster, el mapa enfoca sus bounds o acerca el zoom.
- Se desactivo la rotacion del mapa para evitar inclinaciones raras en gestos.
- Se agrego `maxNativeZoom` al `TileLayer`.

### Gestion privada

- La gestion de avistamientos privados ahora usa la ruta dedicada:
  - `GET /api/manage/:id/sightings?token=...`
- Antes mobile leia avistamientos privados desde la ruta publica con `includeHidden=true`.

### Modelos

- `PetReport` ahora lee `prioritySignals` y campos snake_case equivalentes.
- `ReportMapItem` inyecta coordenadas reales del endpoint de mapa en los reportes del viewport.
- Se evito usar coordenadas fallback del backend como coordenadas reales dentro de `PetReport` cuando no vienen campos reales de lat/lng.

### Servidor beta

- `ApiClient` ahora acepta `HUELLAMIGO_BETA_ACCESS` por `--dart-define`.
- Si `HUELLAMIGO_BETA_ACCESS` viene definido, mobile lo envia en el header `x-beta-access`.
- Esto permite probar contra servidores con `BETA_SHIELD_ENABLED=true` sin guardar `BETA_SHIELD_SECRET` en el codigo mobile.

### Detalle de mascota

- El detalle muestra las senales tecnicas de riesgo:
  - etapa de vida
  - vulnerable
  - urgente
  - necesita medicamento

## Archivos modificados

- `mobile/app/lib/api/api_client_manage.dart`
- `mobile/app/lib/api/api_client.dart`
- `mobile/app/lib/models/pet_report.dart`
- `mobile/app/lib/models/report_map_item.dart`
- `mobile/app/lib/screens/manage_report_screen.dart`
- `mobile/app/lib/screens/map_screen.dart`
- `mobile/app/lib/screens/pet_detail_screen.dart`
- `mobile/app/lib/screens/report_screen.dart`

## Validacion

Comando ejecutado con resultado correcto:

```powershell
C:\Users\Alex\SDK\flutter\bin\cache\dart-sdk\bin\dart.exe --disable-dart-dev analyze lib\models\pet_report.dart lib\models\report_map_item.dart lib\api\api_client_manage.dart lib\screens\manage_report_screen.dart lib\screens\report_screen.dart lib\screens\map_screen.dart lib\screens\pet_detail_screen.dart
```

Resultado: `No issues found!`

Tambien se valido:

```powershell
C:\Users\Alex\SDK\flutter\bin\cache\dart-sdk\bin\dart.exe --disable-dart-dev analyze lib\api\api_client.dart
```

Resultado: `No issues found!`

APK release regenerado contra servidor beta:

```text
<repo>\mobile\app\build\app\outputs\flutter-apk\app-release.apk
```

Defines usados:

```text
HUELLAMIGO_API_URL=https://api.huellamigo.com
HUELLAMIGO_BETA_ACCESS=<token firmado temporal>
```

Comandos que se intentaron pero quedaron bloqueados hasta timeout en este entorno:

```powershell
C:\Users\Alex\SDK\flutter\bin\dart.bat analyze
C:\Users\Alex\SDK\flutter\bin\flutter.bat analyze
C:\Users\Alex\SDK\flutter\bin\dart.bat format ...
C:\Users\Alex\SDK\flutter\bin\flutter.bat test test\widget_test.dart
```

Nota: usando `dart.exe --disable-dart-dev` directo si se pudo analizar correctamente.

## Pendientes

- Probar de punta a punta contra backend levantado:
  - login con usuario verificado
  - crear reporte con ubicacion marcada
  - crear reporte con cada combinacion de riesgo
  - abrir mapa y confirmar clusters/viewport
  - abrir gestion privada y ver avistamientos ocultos/visibles
- Repetir `flutter analyze` y `flutter test` cuando el SDK/daemon Flutter local no se quede bloqueado.
- El front/back siguen devolviendo `coordinates` con fallback en algunos mappers. Mobile evita usar ese fallback para reportes generales, pero el arreglo completo de datos limpios deberia hacerse despues en back si se quiere distinguir siempre entre "sin ubicacion" y "ubicacion real".
- Notificaciones mobile siguen fuera del alcance actual. Front/back ya tienen endpoints, pero no hay UI mobile conectada para ese flujo.
- Compartir nativo sigue pendiente; mobile solo muestra aviso temporal.
