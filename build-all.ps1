# build-all.ps1
# Builds DJ Scratch mobile (Flutter Android APK) and desktop (Rust Tauri EXE)
# Run this from the repo root: .\build-all.ps1 [-Release]
#   Without -Release : builds debug/unsigned artifacts locally
#   With -Release    : builds release artifacts, creates a release folder, and offers to make a GitHub release

param(
    [switch]$Release
)

$ErrorActionPreference = "Stop"

# Locate tools
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$flutterDir = Join-Path $scriptDir "android-app"
$desktopDir = Join-Path $scriptDir "desktop-rust"

# Java 17
$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
if (-not (Test-Path $javaHome)) {
    $javaHome = (Get-Command java -ErrorAction SilentlyContinue).Source
    if (-not $javaHome) { throw "Java 17 not found. Install: winget install EclipseAdoptium.Temurin.17.JDK" }
}

# Android SDK
$androidHome = "C:\Android\android-sdk"
if (-not (Test-Path $androidHome)) { throw "Android SDK not found at $androidHome" }

# Gradle 8.0
$gradleDir = "C:\Android\gradle-8.0\gradle-8.0\bin"
if (-not (Test-Path $gradleDir)) { throw "Gradle not found at $gradleDir" }

# Rust / cargo / cargo-tauri
$cargoDir = "C:\Users\minec\.cargo\bin"
$cargoExe = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoExe) {
    if (Test-Path "$cargoDir\cargo.exe") {
        $env:PATH = "$cargoDir;$env:PATH"
        $cargoExe = Get-Command cargo -ErrorAction SilentlyContinue
    }
}
if (-not $cargoExe) { throw "Rust/cargo not found. Install: https://rustup.rs/" }
$tauriExe = Get-Command cargo-tauri -ErrorAction SilentlyContinue
if (-not $tauriExe) {
    if (Test-Path "$cargoDir\cargo-tauri.exe") {
        $env:PATH = "$cargoDir;$env:PATH"
        $tauriExe = Get-Command cargo-tauri -ErrorAction SilentlyContinue
    }
}
if (-not $tauriExe) { throw "cargo-tauri not found. Run: cargo install tauri-cli" }

# Flutter (optional — mobile app)
$flutterExe = Get-Command flutter -ErrorAction SilentlyContinue
if (-not $flutterExe) {
    $flutterCandidates = @(
        "C:\src\flutter\bin\flutter.bat",
        "C:\flutter\bin\flutter.bat",
        "$env:USERPROFILE\flutter\bin\flutter.bat",
        "$env:USERPROFILE\AppData\Local\Temp\kilo\flutter\bin\flutter.bat"
    )
    foreach ($c in $flutterCandidates) {
        if (Test-Path $c) {
            $env:PATH = "$(Split-Path $c);$env:PATH"
            $flutterExe = Get-Command flutter -ErrorAction SilentlyContinue
            break
        }
    }
}

# Set environment
$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:PATH = "$($javaHome)\bin;$($androidHome)\cmdline-tools\latest\bin;$gradleDir;$cargoDir;$env:PATH"

Write-Host "=== JAVA_HOME = $env:JAVA_HOME ===" -ForegroundColor Cyan
Write-Host "=== ANDROID_HOME = $env:ANDROID_HOME ===" -ForegroundColor Cyan

# Version — android-app (Flutter) pubspec.yaml is canonical
$flutterPubspec = Join-Path $flutterDir "pubspec.yaml"
$version = "0.0.0"

if (Test-Path $flutterPubspec) {
    $lines = Get-Content $flutterPubspec
    $verLine = $lines | Where-Object { $_ -match '^version:\s*' }
    if ($verLine) {
        $verMatch = $verLine -match '^version:\s*([\d.]+)'
        if ($verMatch) { $version = $Matches[1] }
    }
}

# Sync version across all apps
Write-Host "=== Syncing version to $version across all apps ===" -ForegroundColor Yellow

# desktop-rust package.json
$desktopPkg = Join-Path $desktopDir "package.json"
if (Test-Path $desktopPkg) {
    $dPkg = Get-Content $desktopPkg | ConvertFrom-Json
    $dPkg.version = $version
    $dPkg | ConvertTo-Json -Depth 10 | Set-Content $desktopPkg
}

# desktop-rust src-tauri Cargo.toml
$cargoToml = Join-Path $desktopDir "src-tauri\Cargo.toml"
if (Test-Path $cargoToml) {
    $cargoLines = Get-Content $cargoToml
    $cargoLines = $cargoLines | ForEach-Object {
        if ($_ -match '^version\s*=') { 'version = "' + $version + '"' } else { $_ }
    }
    [System.IO.File]::WriteAllLines($cargoToml, $cargoLines)
}

# desktop-rust src-tauri tauri.conf.json
$tauriConf = Join-Path $desktopDir "src-tauri\tauri.conf.json"
if (Test-Path $tauriConf) {
    $tConf = Get-Content $tauriConf | ConvertFrom-Json
    $tConf.version = $version
    $json = $tConf | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($tauriConf, $json)
}

# desktop-rust src/lib/config.ts APP_VERSION
$configTs = Join-Path $desktopDir "src\lib\config.ts"
if (Test-Path $configTs) {
    $cfgLines = Get-Content $configTs
    $cfgLines = $cfgLines | ForEach-Object {
        if ($_ -match "APP_VERSION\s*=") { "APP_VERSION = '" + $version + "'" } else { $_ }
    }
    [System.IO.File]::WriteAllLines($configTs, $cfgLines)
}

Write-Host "=== Building version $version ===" -ForegroundColor Green

# Output directory
if ($Release) {
    $tag = "v" + $version
    $outDir = Join-Path $scriptDir ("releases" + [System.IO.Path]::DirectorySeparatorChar + $tag)
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
} else {
    $outDir = Join-Path $scriptDir "build-output"
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# ---------------- Mobile build (Flutter Android APK) ----------------
Write-Host "`n========== BUILDING MOBILE (Flutter Android APK) ==========" -ForegroundColor Green

if (-not $flutterExe) {
    Write-Warning "Flutter not found - skipping mobile APK build. Install Flutter: https://docs.flutter.dev/get-started/install"
} else {
    Push-Location $flutterDir
    Write-Host "Running: flutter pub get" -ForegroundColor Yellow
    flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed" }

    Write-Host "Running: flutter build apk --release" -ForegroundColor Yellow
    flutter build apk --release
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk --release failed" }

    $flutterApk = Join-Path $flutterDir "build\app\outputs\flutter-apk\app-release.apk"
    if (Test-Path $flutterApk) {
        $flutterApkFileName = "DJ-Scratch-mobile-v" + $version + ".apk"
        $flutterApkDest = Join-Path $outDir $flutterApkFileName
        Copy-Item $flutterApk $flutterApkDest -Force
        Write-Host "MOBILE APK BUILT: $flutterApkDest" -ForegroundColor Green
        Get-Item $flutterApkDest | Select-Object Name, Length
    } else {
        throw "Flutter APK not found at $flutterApk"
    }

    Pop-Location
}

# ---------------- Desktop build (Rust Tauri) ----------------
Write-Host "`n========== BUILDING DESKTOP (Rust Tauri) ==========" -ForegroundColor Green

Push-Location $desktopDir

# Copy pre-built desktop HTML into src-tauri/build/ for Tauri to embed
Remove-Item -Recurse -Force (Join-Path $desktopDir "src-tauri\build") -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $desktopDir "build") (Join-Path $desktopDir "src-tauri\build")

Write-Host "Running: cargo tauri build" -ForegroundColor Yellow
cargo tauri build
if ($LASTEXITCODE -ne 0) { throw "cargo tauri build failed" }

# Find the built NSIS installer in src-tauri/target/release/bundle/nsis/
$nsisExe = Get-ChildItem -Path (Join-Path $desktopDir "src-tauri\target\release\bundle\nsis") -Filter "*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nsisExe) {
    $exeFileName = "DJ-Scratch-desktop-v" + $version + ".exe"
    $exeDest = Join-Path $outDir $exeFileName
    Copy-Item $nsisExe.FullName $exeDest -Force
    Write-Host "DESKTOP EXE BUILT: $exeDest" -ForegroundColor Green
    Get-Item $exeDest | Select-Object Name, Length
} else {
    throw "Desktop NSIS EXE not found in $desktopDir\src-tauri\target\release\bundle\nsis"
}

Pop-Location

# ---------------- GitHub release ----------------
if ($Release) {
    Write-Host "`n========== GITHUB RELEASE ==========" -ForegroundColor Green

    $tag = "v" + $version
    $releaseNotes = Join-Path $outDir "release-notes.md"
    "DJ Scratch v" + $version | Set-Content $releaseNotes
    "" | Add-Content $releaseNotes
    "## Mobile (Flutter Android APK)" | Add-Content $releaseNotes
    "- DJ-Scratch-mobile-v" + $version + ".apk - original mobile app" | Add-Content $releaseNotes
    "- Install on Android: adb install DJ-Scratch-mobile-v" + $version + ".apk" | Add-Content $releaseNotes
    "" | Add-Content $releaseNotes
    "## Desktop (Windows EXE)" | Add-Content $releaseNotes
    "- DJ-Scratch-desktop-v" + $version + ".exe - Rust/Tauri desktop app" | Add-Content $releaseNotes
    "" | Add-Content $releaseNotes
    "## Installation" | Add-Content $releaseNotes
    "1. Download the APK to your Android device and install" | Add-Content $releaseNotes
    "2. Download the EXE and run on Windows" | Add-Content $releaseNotes

    $existingTag = $null
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $viewResult = & gh release view $tag --json tagName -q .tagName 2>$null
    $ErrorActionPreference = $prevErrorAction
    if ($LASTEXITCODE -eq 0 -and $viewResult) {
        $existingTag = $viewResult
    }
    $releaseAssets = @("$exeDest")
    if ($flutterExe -and (Test-Path $flutterApkDest)) {
        $releaseAssets += "$flutterApkDest"
    }
    if ($existingTag -eq $tag) {
        Write-Host "Release v$version already exists - updating assets..." -ForegroundColor Yellow
        & gh release upload $tag $releaseAssets --clobber
        & gh release edit $tag --notes-file $releaseNotes
    } else {
        Write-Host "Creating GitHub release v$version..." -ForegroundColor Yellow
        & gh release create $tag $releaseAssets --title "DJ Scratch v$version" --notes-file $releaseNotes
    }

    $remoteUrl = git remote get-url origin
    $repo = $remoteUrl -replace '.*[:/]([^/]+/[^/]+?)(?:\.git)?$', '$1'
    Write-Host "RELEASE CREATED: https://github.com/$repo/releases/tag/$tag" -ForegroundColor Green
}

# Done
Write-Host "`n========== ALL BUILDS COMPLETE ==========" -ForegroundColor Green
Write-Host "Output directory: $outDir" -ForegroundColor Green
Get-ChildItem $outDir | Select-Object Name, Length
