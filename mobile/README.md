# HuellamiGO Mobile

Este directorio contiene la app mobile en Flutter.

## Estructura

- `flutter-sdk/`: SDK local legado de Flutter, si existe.
- `app/`: proyecto Flutter (`huellamigo_mobile`).
- `.beta_access_token.local`: token local para compilar APKs que pasan Beta Shield. No se versiona.

## Ejecutar

1. En Windows activa Developer Mode para symlinks:
   - Ejecuta: `start ms-settings:developers`
   - Activa `Developer Mode`.
2. Instala dependencias:
   - `cd mobile/app`
   - `C:\Users\Alex\SDK\flutter\bin\flutter.bat pub get`
3. Corre la app:
   - `C:\Users\Alex\SDK\flutter\bin\flutter.bat run --dart-define=HUELLAMIGO_API_URL=http://10.0.2.2:4000`

## API

- `HUELLAMIGO_API_URL` apunta al backend Node actual.
- `HUELLAMIGO_BETA_ACCESS` se envia como `x-beta-access` cuando compilas con Beta Shield.
- Para emulador Android usa `http://10.0.2.2:4000`.
- Para dispositivo fisico usa la IP local de tu PC, por ejemplo `http://192.168.1.50:4000`.

## Compilar APK

```powershell
.\compile_with_betashield.ps1
```
