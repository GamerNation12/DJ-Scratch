# build-all.ps1
# Builds both DJ Scratch mobile (React Native Android APK) and desktop (Rust GPUI EXE)
# Run this from the repo root: .\build-all.ps1

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Locate tools
# ---------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$mobileDir = Join-Path $scriptDir "mobile"
$androidDir = Join-Path $mobileDir "android"
$desktopDir = Join-Path $scriptDir "desktop-gpui"

# Java 17 (Temurin default install location)
$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
if (-not (Test-Path $javaHome)) {
    Write-Warning "JAVA_HOME not found at $javaHome — installing via winget may be required"
    $javaHome = (Get-Command java -ErrorAction SilentlyContinue).Source
    if (-not $javaHome) { throw "Java 17 not found. Install: winget install EclipseAdoptium.Temurin.17.JDK" }
}

# Android SDK
$androidHome = "C:\Android\android-sdk"
if (-not (Test-Path $androidHome)) { throw "Android SDK not found at $androidHome" }

# Gradle 8.0
$gradleDir = "C:\Android\gradle-8.0\gradle-8.0\bin"
if (-not (Test-Path $gradleDir)) { throw "Gradle not found at $gradleDir" }

# Rust / cargo
$cargoExe = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoExe) { throw "Rust/cargo not found. Install: https://rustup.rs/" }

# ---------------------------------------------------------------------------
# Set environment
# ---------------------------------------------------------------------------
$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:PATH = "$($javaHome)\bin;$($androidHome)\cmdline-tools\latest\bin;$gradleDir;$env:PATH"

Write-Host "=== JAVA_HOME = $env:JAVA_HOME ===" -ForegroundColor Cyan
Write-Host "=== ANDROID_HOME = $env:ANDROID_HOME ===" -ForegroundColor Cyan
Write-Host "=== PATH updated ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Mobile: npm install + Gradle assembleRelease
# ---------------------------------------------------------------------------
Write-Host "`n========== BUILDING MOBILE (React Native Android APK) ==========" -ForegroundColor Green

Push-Location $mobileDir
Write-Host "Running: npm install" -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Push-Location $androidDir
Write-Host "Running: gradle assembleRelease" -ForegroundColor Yellow
gradle assembleRelease
if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease failed" }

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release-unsigned.apk"
if (Test-Path $apk) {
    Write-Host "MOBILE APK BUILT: $apk" -ForegroundColor Green
    Get-Item $apk | Select-Object Name, Length
} else {
    throw "APK not found at $apk"
}

Pop-Location
Pop-Location

# ---------------------------------------------------------------------------
# 2. Desktop: cargo build --release (GPUI)
# ---------------------------------------------------------------------------
Write-Host "`n========== BUILDING DESKTOP (Rust GPUI) ==========" -ForegroundColor Green

Push-Location $desktopDir
Write-Host "Running: cargo build --release" -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) { throw "cargo build --release failed" }

$exe = Join-Path $desktopDir "target\release\dj-scratch-desktop.exe"
if (Test-Path $exe) {
    Write-Host "DESKTOP EXE BUILT: $exe" -ForegroundColor Green
    Get-Item $exe | Select-Object Name, Length
} else {
    throw "EXE not found at $exe"
}

Pop-Location

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host "`n========== ALL BUILDS COMPLETE ==========" -ForegroundColor Green
Write-Host "Mobile APK : $apk" -ForegroundColor Green
Write-Host "Desktop EXE: $exe" -ForegroundColor Green
