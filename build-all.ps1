# build-all.ps1
# Builds both DJ Scratch mobile (React Native Android APK) and desktop (Rust GPUI EXE)
# Run this from the repo root: .\build-all.ps1 [-Release]
#   Without -Release : builds debug/unsigned artifacts locally
#   With -Release    : builds release artifacts, creates a release folder, and offers to make a GitHub release

param(
    [switch]$Release
)

$ErrorActionPreference = "Stop"

# Locate tools
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$mobileDir = Join-Path $scriptDir "mobile"
$androidDir = Join-Path $mobileDir "android"
$desktopDir = Join-Path $scriptDir "desktop-gpui"

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

# Rust / cargo
$cargoDir = "C:\Users\minec\.cargo\bin"
$cargoExe = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoExe) {
    if (Test-Path "$cargoDir\cargo.exe") {
        $env:PATH = "$cargoDir;$env:PATH"
        $cargoExe = Get-Command cargo -ErrorAction SilentlyContinue
    }
}
if (-not $cargoExe) { throw "Rust/cargo not found. Install: https://rustup.rs/" }

# GitHub CLI (optional)
$ghExe = Get-Command gh -ErrorAction SilentlyContinue

# Set environment
$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:PATH = "$($javaHome)\bin;$($androidHome)\cmdline-tools\latest\bin;$gradleDir;$cargoDir;$env:PATH"

Write-Host "=== JAVA_HOME = $env:JAVA_HOME ===" -ForegroundColor Cyan
Write-Host "=== ANDROID_HOME = $env:ANDROID_HOME ===" -ForegroundColor Cyan

# Version
$packageJson = Join-Path $mobileDir "package.json"
$cargoToml = Join-Path $desktopDir "Cargo.toml"
$version = "0.0.0"

if (Test-Path $packageJson) {
    $pkg = Get-Content $packageJson | ConvertFrom-Json
    $version = $pkg.version
}
if (Test-Path $cargoToml) {
    $cargoContent = Get-Content $cargoToml -Raw
    if ($cargoContent -match 'version = "([^"]+)"') {
        $version = $Matches[1]
    }
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

# Mobile build
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
    $apkFileName = "DJ-Scratch-mobile-v" + $version + ".apk"
    $apkDest = Join-Path $outDir $apkFileName
    Copy-Item $apk $apkDest -Force
    Write-Host "MOBILE APK BUILT: $apkDest" -ForegroundColor Green
    Get-Item $apkDest | Select-Object Name, Length
} else {
    throw "APK not found at $apk"
}

Pop-Location
Pop-Location

# Desktop build
Write-Host "`n========== BUILDING DESKTOP (Rust GPUI) ==========" -ForegroundColor Green

Push-Location $desktopDir
Write-Host "Running: cargo build --release" -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) { throw "cargo build --release failed" }

$exe = Join-Path $desktopDir "target\release\dj-scratch-desktop.exe"
if (Test-Path $exe) {
    $exeFileName = "DJ-Scratch-desktop-v" + $version + ".exe"
    $exeDest = Join-Path $outDir $exeFileName
    Copy-Item $exe $exeDest -Force
    Write-Host "DESKTOP EXE BUILT: $exeDest" -ForegroundColor Green
    Get-Item $exeDest | Select-Object Name, Length
} else {
    throw "EXE not found at $exe"
}

Pop-Location

# GitHub release
if ($Release) {
    Write-Host "`n========== GITHUB RELEASE ==========" -ForegroundColor Green

    if (-not $ghExe) {
        Write-Warning "gh CLI not found - install: https://cli.github.com/"
        Write-Warning "Release artifacts are in: $outDir"
        Write-Host "Create the release manually with: gh release create v$version '$outDir/*'" -ForegroundColor Yellow
    } else {
        $tag = "v" + $version
        $releaseNotes = Join-Path $outDir "release-notes.md"
        "DJ Scratch v" + $version | Set-Content $releaseNotes
        "" | Add-Content $releaseNotes
        "## Mobile (Android APK)" | Add-Content $releaseNotes
        "- DJ-Scratch-mobile-v" + $version + ".apk - unsigned release APK" | Add-Content $releaseNotes
        "- Install on Android: adb install DJ-Scratch-mobile-v" + $version + ".apk" | Add-Content $releaseNotes
        "" | Add-Content $releaseNotes
        "## Desktop (Windows EXE)" | Add-Content $releaseNotes
        "- DJ-Scratch-desktop-v" + $version + ".exe - Rust/GPUI desktop app" | Add-Content $releaseNotes
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
        if ($existingTag -eq $tag) {
            Write-Host "Release v$version already exists - updating assets..." -ForegroundColor Yellow
            & gh release upload $tag "$apkDest" "$exeDest" "$releaseNotes" --clobber
        } else {
            Write-Host "Creating GitHub release v$version..." -ForegroundColor Yellow
            & gh release create $tag "$apkDest" "$exeDest" "$releaseNotes" --title "DJ Scratch v$version" --notes-file $releaseNotes
        }

        $remoteUrl = git remote get-url origin
        $repo = $remoteUrl -replace '.*[:/]([^/]+/[^/]+?)(?:\.git)?$', '$1'
        Write-Host "RELEASE CREATED: https://github.com/$repo/releases/tag/$tag" -ForegroundColor Green
    }
}

# Done
Write-Host "`n========== ALL BUILDS COMPLETE ==========" -ForegroundColor Green
Write-Host "Output directory: $outDir" -ForegroundColor Green
Get-ChildItem $outDir | Select-Object Name, Length
