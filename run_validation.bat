@echo off
echo ?? OASIS TRADING SYSTEM - VALIDATION LAUNCHER
echo ==============================================

echo.
echo Escolha uma opcao:
echo 1. Teste rapido
echo 2. Validacao completa
echo 3. Setup de ambiente
echo 4. Testes funcionais Python
echo 5. Sair

set /p choice=Digite sua escolha (1-5): 

if "%choice%"=="1" (
    powershell -ExecutionPolicy Bypass -File "Test-QuickValidation.ps1"
    goto end
)

if "%choice%"=="2" (
    powershell -ExecutionPolicy Bypass -File "Validate-OasisPhase1.ps1"
    goto end
)

if "%choice%"=="3" (
    powershell -ExecutionPolicy Bypass -File "Setup-Environment.ps1"
    goto end
)

if "%choice%"=="4" (
    python functional_tests.py
    goto end
)

if "%choice%"=="5" (
    goto end
)

echo Opcao invalida!

:end
pause
