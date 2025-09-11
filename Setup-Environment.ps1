# ===================================================================
# Oasis Trading System - Environment Setup Script
# ===================================================================

param(
    [switch]$SkipDocker,
    [switch]$Force
)

Write-Host "🚀 OASIS TRADING SYSTEM - ENVIRONMENT SETUP" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to install Chocolatey
function Install-Chocolatey {
    Write-Host "`nInstalling Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    Write-Host "✅ Chocolatey installed" -ForegroundColor Green
}

# Check if Chocolatey is installed
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    if (Test-Administrator) {
        Install-Chocolatey
    } else {
        Write-Host "❌ Please run as Administrator to install dependencies" -ForegroundColor Red
        Write-Host "   Or install manually:" -ForegroundColor Yellow
        Write-Host "   - Python 3.11+: https://python.org" -ForegroundColor Yellow
        Write-Host "   - Git: https://git-scm.com" -ForegroundColor Yellow
        Write-Host "   - Docker Desktop: https://docker.com" -ForegroundColor Yellow
        exit 1
    }
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow

$packages = @("python311", "git")
if (-not $SkipDocker) {
    $packages += "docker-desktop"
}

foreach ($package in $packages) {
    Write-Host "Installing $package..." -ForegroundColor Blue
    choco install $package -y
}

# Setup Python virtual environment
Write-Host "`nSetting up Python virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv" -and -not $Force) {
    Write-Host "⚠️  Virtual environment already exists. Use -Force to recreate." -ForegroundColor Yellow
} else {
    if (Test-Path "venv") {
        Remove-Item -Recurse -Force "venv"
    }
    
    python -m venv venv
    .\venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    
    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt
        Write-Host "✅ Requirements installed" -ForegroundColor Green
    }
    
    if (Test-Path "requirements-dev.txt") {
        pip install -r requirements-dev.txt
        Write-Host "✅ Development requirements installed" -ForegroundColor Green
    }
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "✅ Environment setup completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "1. Activate venv: .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host "2. Run validation: .\Validate-OasisPhase1.ps1" -ForegroundColor Yellow

if (-not $SkipDocker) {
    Write-Host "3. Start Docker Desktop" -ForegroundColor Yellow
}
