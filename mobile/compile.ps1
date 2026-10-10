$ErrorActionPreference = "Stop"

$Flutter = "C:\Users\Alex\SDK\flutter\bin\flutter.bat"
$AppDir = Join-Path $PSScriptRoot "app"

Push-Location $AppDir
try {
    & $Flutter build apk --release --dart-define=HUELLAMIGO_API_URL=https://api.huellamigo.com
}
finally {
    Pop-Location
}
