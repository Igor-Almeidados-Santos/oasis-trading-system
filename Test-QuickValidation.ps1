# ===================================================================
# Oasis Trading System - Quick Validation Test
# ===================================================================

Write-Host "🚀 OASIS TRADING SYSTEM - QUICK VALIDATION" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test 1: Python
Write-Host "`n1. Testing Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Python: Not found" -ForegroundColor Red
}

# Test 2: Project Structure
Write-Host "`n2. Testing Project Structure..." -ForegroundColor Yellow
$coreFiles = @("src\config\settings.py", "requirements.txt", ".env.example")
foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file (missing)" -ForegroundColor Red
    }
}

# Test 3: Docker (optional)
Write-Host "`n3. Testing Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "   ✅ Docker: $dockerVersion" -ForegroundColor Green
    
    try {
        docker info | Out-Null
        Write-Host "   ✅ Docker Daemon: Running" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Docker Daemon: Not running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Docker: Not found (optional)" -ForegroundColor Yellow
}

# Test 4: Virtual Environment
Write-Host "`n4. Testing Virtual Environment..." -ForegroundColor Yellow
if (Test-Path "venv\Scripts\activate.bat") {
    Write-Host "   ✅ Virtual Environment: Found" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Virtual Environment: Not found (create with: python -m venv venv)" -ForegroundColor Yellow
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "Quick validation completed!" -ForegroundColor Cyan
Write-Host "For full validation, run: .\Validate-OasisPhase1.ps1" -ForegroundColor White
