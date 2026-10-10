$FlutterSdk = "C:\Users\Alex\SDK\flutter"
$FlutterBin = Join-Path $FlutterSdk "bin"
$DartBin = Join-Path $FlutterSdk "bin\cache\dart-sdk\bin"

if (-not (Test-Path (Join-Path $FlutterBin "flutter.bat"))) {
    throw "No se encontro flutter.bat en $FlutterBin"
}

if (-not (Test-Path (Join-Path $DartBin "dart.exe"))) {
    throw "No se encontro dart.exe en $DartBin"
}

$pathsToAdd = @($FlutterBin, $DartBin)
$currentPaths = $env:Path -split ';'

foreach ($path in $pathsToAdd) {
    if ($currentPaths -notcontains $path) {
        $env:Path = "$path;$env:Path"
    }
}

Write-Host "Flutter y Dart listos para esta sesion."
Write-Host "flutter: $FlutterBin\flutter.bat"
Write-Host "dart:    $DartBin\dart.exe"
