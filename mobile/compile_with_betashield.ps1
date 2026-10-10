$ErrorActionPreference = "Stop"

$Flutter = "C:\Users\Alex\SDK\flutter\bin\flutter.bat"
$AppDir = Join-Path $PSScriptRoot "app"
$TokenFile = Join-Path $PSScriptRoot ".beta_access_token.local"

if (-not (Test-Path $TokenFile)) {
    throw "No se encontro .beta_access_token.local en mobile. Genera el token antes de compilar."
}

$BetaToken = (Get-Content -LiteralPath $TokenFile -Raw).Trim()

if ([string]::IsNullOrWhiteSpace($BetaToken)) {
    throw ".beta_access_token.local esta vacio."
}

Push-Location $AppDir
try {
    & $Flutter build apk --release --dart-define=HUELLAMIGO_API_URL=https://api.huellamigo.com --dart-define=HUELLAMIGO_BETA_ACCESS=$BetaToken
}
finally {
    Pop-Location
}
