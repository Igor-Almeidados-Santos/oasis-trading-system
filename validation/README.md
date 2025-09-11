# 🧪 OASIS TRADING SYSTEM - VALIDATION FILES

Este diretório contém todos os arquivos necessários para validar a implementação da Fase 1.

## 📁 Arquivos Criados

- **Validate-OasisPhase1.ps1** - Script principal de validação para Windows
- **Test-QuickValidation.ps1** - Teste rápido de validação
- **Setup-Environment.ps1** - Setup automático do ambiente
- **functional_tests.py** - Testes funcionais em Python
- **run_validation.bat** - Launcher interativo (duplo-clique)

## 🚀 Como Usar

### Opção 1: Launcher Interativo
```
Duplo-clique em: run_validation.bat
```

### Opção 2: PowerShell
```powershell
# Teste rápido
.\Test-QuickValidation.ps1

# Validação completa
.\Validate-OasisPhase1.ps1

# Com parâmetros
.\Validate-OasisPhase1.ps1 -Verbose -SkipDockerTests
```

### Opção 3: Python
```bash
python functional_tests.py
```

## 📊 Relatórios

Os relatórios são salvos em:
- `validation/reports/` - Relatórios JSON
- `validation/logs/` - Logs detalhados

## 🔧 Troubleshooting

Se encontrar erro de execução, execute:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
