# ===================================================================
# Oasis Trading System - Windows PowerShell Validation Script
# ===================================================================
# Validates Phase 1 implementation on Windows systems
# ===================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$LogPath = "validation\logs\windows_validation.log",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipDockerTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Colors for console output
$Colors = @{
    Red = [System.ConsoleColor]::Red
    Green = [System.ConsoleColor]::Green
    Yellow = [System.ConsoleColor]::Yellow
    Blue = [System.ConsoleColor]::Blue
    Magenta = [System.ConsoleColor]::Magenta
    White = [System.ConsoleColor]::White
}

# Test results tracking
$Script:TestResults = @()
$Script:TestsPassed = 0
$Script:TestsFailed = 0

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [System.ConsoleColor]$Color = $Colors.White
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to console with color
    Write-Host $logMessage -ForegroundColor $Color
    
    # Write to log file
    if (-not (Test-Path -Path (Split-Path $LogPath -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $LogPath -Parent) -Force | Out-Null
    }
    Add-Content -Path $LogPath -Value $logMessage
}

function Write-Info($Message) { Write-Log $Message "INFO" $Colors.Blue }
function Write-Success($Message) { Write-Log $Message "SUCCESS" $Colors.Green }
function Write-Warning($Message) { Write-Log $Message "WARNING" $Colors.Yellow }
function Write-Error($Message) { Write-Log $Message "ERROR" $Colors.Red }
function Write-Header($Message) { Write-Log $Message "HEADER" $Colors.Magenta }

# Test result tracking
function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    $result = @{
        TestName = $TestName
        Passed = $Passed
        Details = $Details
        Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
    }
    
    $Script:TestResults += $result
    
    if ($Passed) {
        $Script:TestsPassed++
        Write-Success "TEST PASSED: $TestName"
    } else {
        $Script:TestsFailed++
        Write-Error "TEST FAILED: $TestName - $Details"
    }
}

# Test prerequisite software
function Test-Prerequisites {
    Write-Header "Testing Prerequisites..."
    
    # Test PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    if ($psVersion.Major -ge 5) {
        Add-TestResult "PowerShell Version" $true "Version $psVersion"
    } else {
        Add-TestResult "PowerShell Version" $false "Version $psVersion is too old (need 5.0+)"
    }
    
    # Test Python installation
    try {
        $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonCmd) {
            $pythonVersion = & python --version 2>&1
            if ($pythonVersion -match "Python 3\.(11|12)") {
                Add-TestResult "Python Installation" $true $pythonVersion
            } else {
                Add-TestResult "Python Installation" $false "Python 3.11+ required, found: $pythonVersion"
            }
        } else {
            Add-TestResult "Python Installation" $false "Python not found in PATH"
        }
    } catch {
        Add-TestResult "Python Installation" $false "Python not found in PATH"
    }
    
    # Test Git installation
    try {
        $gitCmd = Get-Command git -ErrorAction SilentlyContinue
        if ($gitCmd) {
            $gitVersion = & git --version 2>&1
            Add-TestResult "Git Installation" $true $gitVersion
        } else {
            Add-TestResult "Git Installation" $false "Git not found in PATH"
        }
    } catch {
        Add-TestResult "Git Installation" $false "Git not found in PATH"
    }
    
    # Test Docker installation (if not skipping Docker tests)
    if (-not $SkipDockerTests) {
        try {
            $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
            if ($dockerCmd) {
                $dockerVersion = & docker --version 2>&1
                Add-TestResult "Docker Installation" $true $dockerVersion
                
                # Test Docker daemon
                try {
                    & docker info | Out-Null
                    Add-TestResult "Docker Daemon" $true "Docker daemon is running"
                } catch {
                    Add-TestResult "Docker Daemon" $false "Docker daemon is not running"
                }
                
                # Test Docker Compose
                try {
                    $composeCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
                    if ($composeCmd) {
                        $composeVersion = & docker-compose --version 2>&1
                        Add-TestResult "Docker Compose" $true $composeVersion
                    } else {
                        # Try docker compose (newer syntax)
                        try {
                            $composeVersion = & docker compose version 2>&1
                            Add-TestResult "Docker Compose" $true $composeVersion
                        } catch {
                            Add-TestResult "Docker Compose" $false "Docker Compose not found"
                        }
                    }
                } catch {
                    Add-TestResult "Docker Compose" $false "Docker Compose not found"
                }
            } else {
                Add-TestResult "Docker Installation" $false "Docker not found in PATH"
            }
        } catch {
            Add-TestResult "Docker Installation" $false "Docker not found in PATH"
        }
    }
    
    # Test Node.js installation
    try {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) {
            $nodeVersion = & node --version 2>&1
            if ($nodeVersion -match "v(18|20|21)") {
                Add-TestResult "Node.js Installation" $true $nodeVersion
            } else {
                Add-TestResult "Node.js Installation" $false "Node.js 18+ recommended, found: $nodeVersion"
            }
        } else {
            Add-TestResult "Node.js Installation" $false "Node.js not found in PATH"
        }
    } catch {
        Add-TestResult "Node.js Installation" $false "Node.js not found in PATH"
    }
}

# Test project structure
function Test-ProjectStructure {
    Write-Header "Testing Project Structure..."
    
    $requiredDirectories = @(
        "src\core\trading",
        "src\core\execution",
        "src\core\risk",
        "src\infrastructure\database",
        "src\infrastructure\monitoring",
        "src\api\rest",
        "frontend\src",
        "tests\unit",
        "tests\integration",
        "infrastructure\kubernetes",
        "infrastructure\docker",
        "scripts\deployment",
        "config",
        "docs"
    )
    
    foreach ($dir in $requiredDirectories) {
        if (Test-Path $dir) {
            Add-TestResult "Directory: $dir" $true "Directory exists"
        } else {
            Add-TestResult "Directory: $dir" $false "Directory missing"
        }
    }
    
    $requiredFiles = @(
        "requirements.txt",
        "requirements-dev.txt",
        "setup.py",
        "pyproject.toml",
        "Makefile",
        "README.md",
        ".env.example",
        ".gitignore",
        "src\config\settings.py",
        "infrastructure\docker\docker-compose.yml"
    )
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Add-TestResult "File: $file" $true "File exists"
        } else {
            Add-TestResult "File: $file" $false "File missing"
        }
    }
}

# Test configuration files
function Test-Configuration {
    Write-Header "Testing Configuration Files..."
    
    # Test .env.example
    if (Test-Path ".env.example") {
        $envContent = Get-Content ".env.example" -Raw
        
        $requiredVars = @(
            "ENVIRONMENT",
            "DATABASE_URL", 
            "REDIS_URL",
            "SECRET_KEY",
            "JWT_SECRET_KEY"
        )
        
        foreach ($var in $requiredVars) {
            $pattern = $var + "="
            if ($envContent -match [regex]::Escape($pattern)) {
                Add-TestResult "Environment Variable: $var" $true "Variable defined"
            } else {
                Add-TestResult "Environment Variable: $var" $false "Variable missing"
            }
        }
    } else {
        Add-TestResult "Environment Configuration" $false ".env.example missing"
    }
    
    # Test settings.py
    if (Test-Path "src\config\settings.py") {
        $settingsContent = Get-Content "src\config\settings.py" -Raw
        
        if ($settingsContent -match "class Settings") {
            Add-TestResult "Settings Class" $true "Settings class found"
        } else {
            Add-TestResult "Settings Class" $false "Settings class not found"
        }
        
        if ($settingsContent -match "BaseSettings") {
            Add-TestResult "Pydantic Integration" $true "Pydantic BaseSettings used"
        } else {
            Add-TestResult "Pydantic Integration" $false "Pydantic BaseSettings not found"
        }
    } else {
        Add-TestResult "Settings File" $false "src\config\settings.py missing"
    }
}

# Test Docker configuration
function Test-DockerConfiguration {
    if ($SkipDockerTests) {
        Write-Info "Skipping Docker tests as requested"
        return
    }
    
    Write-Header "Testing Docker Configuration..."
    
    # Test Docker Compose file
    if (Test-Path "infrastructure\docker\docker-compose.yml") {
        Add-TestResult "Docker Compose File" $true "docker-compose.yml exists"
        
        # Test Docker Compose syntax
        try {
            $composeCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
            if ($composeCmd) {
                & docker-compose -f "infrastructure\docker\docker-compose.yml" config | Out-Null
                Add-TestResult "Docker Compose Syntax" $true "Valid YAML syntax"
            } else {
                try {
                    & docker compose -f "infrastructure\docker\docker-compose.yml" config | Out-Null
                    Add-TestResult "Docker Compose Syntax" $true "Valid YAML syntax"
                } catch {
                    Add-TestResult "Docker Compose Syntax" $false "Invalid YAML syntax or Docker Compose not available"
                }
            }
        } catch {
            Add-TestResult "Docker Compose Syntax" $false "Invalid YAML syntax or Docker Compose not available"
        }
        
        # Check required services
        $composeContent = Get-Content "infrastructure\docker\docker-compose.yml" -Raw
        $requiredServices = @("postgres", "redis", "kafka", "api", "worker")
        
        foreach ($service in $requiredServices) {
            # Use regex with proper escaping
            $servicePattern = "^\s*" + [regex]::Escape($service) + ":"
            if ($composeContent -match $servicePattern) {
                Add-TestResult "Docker Service: $service" $true "Service defined"
            } else {
                Add-TestResult "Docker Service: $service" $false "Service not defined"
            }
        }
    } else {
        Add-TestResult "Docker Compose File" $false "docker-compose.yml missing"
    }
    
    # Test Dockerfiles
    $dockerfiles = @("Dockerfile.api", "Dockerfile.worker", "Dockerfile.ml")
    foreach ($dockerfile in $dockerfiles) {
        $path = "infrastructure\docker\$dockerfile"
        if (Test-Path $path) {
            Add-TestResult "Dockerfile: $dockerfile" $true "Dockerfile exists"
        } else {
            Add-TestResult "Dockerfile: $dockerfile" $false "Dockerfile missing"
        }
    }
}

# Test database configuration
function Test-DatabaseConfiguration {
    Write-Header "Testing Database Configuration..."
    
    # Test SQL init script
    if (Test-Path "scripts\sql\init.sql") {
        Add-TestResult "Database Init Script" $true "init.sql exists"
        
        $sqlContent = Get-Content "scripts\sql\init.sql" -Raw
        
        # Check for TimescaleDB
        if ($sqlContent -match "timescaledb") {
            Add-TestResult "TimescaleDB Extension" $true "TimescaleDB configuration found"
        } else {
            Add-TestResult "TimescaleDB Extension" $false "TimescaleDB configuration missing"
        }
        
        # Check for schemas
        $schemas = @("trading", "market_data", "analytics", "audit")
        foreach ($schema in $schemas) {
            $schemaPattern = "CREATE SCHEMA.*" + [regex]::Escape($schema)
            if ($sqlContent -match $schemaPattern) {
                Add-TestResult "Database Schema: $schema" $true "Schema definition found"
            } else {
                Add-TestResult "Database Schema: $schema" $false "Schema definition missing"
            }
        }
    } else {
        Add-TestResult "Database Init Script" $false "scripts\sql\init.sql missing"
    }
    
    # Test database connection module
    if (Test-Path "src\infrastructure\database\postgres\connection.py") {
        Add-TestResult "Database Connection Module" $true "Connection module exists"
        
        $connectionContent = Get-Content "src\infrastructure\database\postgres\connection.py" -Raw
        if ($connectionContent -match "AsyncSession") {
            Add-TestResult "Async Database Support" $true "AsyncSession found"
        } else {
            Add-TestResult "Async Database Support" $false "AsyncSession not found"
        }
    } else {
        Add-TestResult "Database Connection Module" $false "Connection module missing"
    }
}

# Test Python virtual environment creation
function Test-PythonEnvironment {
    Write-Header "Testing Python Environment..."
    
    $tempVenvPath = "validation\temp\test_venv"
    
    try {
        # Create temporary virtual environment
        Write-Info "Creating temporary virtual environment..."
        $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonCmd) {
            & python -m venv $tempVenvPath
            
            if (Test-Path "$tempVenvPath\Scripts\activate.bat") {
                Add-TestResult "Virtual Environment Creation" $true "Virtual environment created successfully"
                
                # Test pip installation in venv
                $pipPath = "$tempVenvPath\Scripts\pip.exe"
                if (Test-Path $pipPath) {
                    Add-TestResult "Pip in Virtual Environment" $true "Pip available in venv"
                } else {
                    Add-TestResult "Pip in Virtual Environment" $false "Pip not found in venv"
                }
            } else {
                Add-TestResult "Virtual Environment Creation" $false "Virtual environment creation failed"
            }
        } else {
            Add-TestResult "Virtual Environment Creation" $false "Python command not found"
        }
        
        # Cleanup
        if (Test-Path $tempVenvPath) {
            Remove-Item -Recurse -Force $tempVenvPath -ErrorAction SilentlyContinue
        }
    } catch {
        Add-TestResult "Virtual Environment Creation" $false $_.Exception.Message
    }
}

# Test CI/CD configuration
function Test-CICDConfiguration {
    Write-Header "Testing CI/CD Configuration..."
    
    # Test GitHub Actions
    if (Test-Path ".github\workflows\ci-cd.yml") {
        Add-TestResult "GitHub Actions Workflow" $true "ci-cd.yml exists"
        
        $workflowContent = Get-Content ".github\workflows\ci-cd.yml" -Raw
        $requiredJobs = @("quality", "test-unit", "test-integration", "build")
        
        foreach ($job in $requiredJobs) {
            # Use regex with proper escaping
            $jobPattern = [regex]::Escape($job) + ":"
            if ($workflowContent -match $jobPattern) {
                Add-TestResult "CI/CD Job: $job" $true "Job defined"
            } else {
                Add-TestResult "CI/CD Job: $job" $false "Job not defined"
            }
        }
    } else {
        Add-TestResult "GitHub Actions Workflow" $false ".github\workflows\ci-cd.yml missing"
    }
    
    # Test pre-commit configuration
    if (Test-Path "pre-commit-config.yaml") {
        Add-TestResult "Pre-commit Configuration" $true "pre-commit-config.yaml exists"
    } else {
        Add-TestResult "Pre-commit Configuration" $false "pre-commit-config.yaml missing"
    }
}

# Generate comprehensive report
function Generate-Report {
    Write-Header "Generating Validation Report..."
    
    $totalTests = $Script:TestsPassed + $Script:TestsFailed
    $successRate = if ($totalTests -gt 0) { [math]::Round(($Script:TestsPassed / $totalTests) * 100, 1) } else { 0 }
    
    $report = @{
        WindowsValidation = @{
            Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
            Environment = @{
                OS = [System.Environment]::OSVersion.VersionString
                PowerShell = $PSVersionTable.PSVersion.ToString()
                User = [System.Environment]::UserName
                ComputerName = [System.Environment]::MachineName
            }
            Summary = @{
                Total = $totalTests
                Passed = $Script:TestsPassed
                Failed = $Script:TestsFailed
                SuccessRate = "$successRate%"
            }
            Tests = $Script:TestResults
        }
    }
    
    # Save JSON report
    $reportPath = "validation\reports\windows_validation_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
    if (-not (Test-Path -Path (Split-Path $reportPath -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $reportPath -Parent) -Force | Out-Null
    }
    
    $report | ConvertTo-Json -Depth 4 | Out-File -FilePath $reportPath -Encoding UTF8
    
    # Display summary
    Write-Host "`n" -NoNewline
    Write-Host "=================================================================" -ForegroundColor Magenta
    Write-Host "  📊 WINDOWS VALIDATION SUMMARY" -ForegroundColor Magenta
    Write-Host "=================================================================" -ForegroundColor Magenta
    
    Write-Host "Total Tests: $totalTests"
    Write-Host "Passed: " -NoNewline; Write-Host $Script:TestsPassed -ForegroundColor Green
    Write-Host "Failed: " -NoNewline; Write-Host $Script:TestsFailed -ForegroundColor Red
    Write-Host "Success Rate: " -NoNewline; Write-Host "$successRate%" -ForegroundColor Green
    
    if ($Script:TestsFailed -eq 0) {
        Write-Host "`n🎉 ALL TESTS PASSED! Phase 1 is ready for Phase 2." -ForegroundColor Green
    } elseif ($successRate -ge 90) {
        Write-Host "`n⚠️  Minor issues found but generally ready for Phase 2." -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ Significant issues found. Please fix before proceeding." -ForegroundColor Red
    }
    
    Write-Host "`nDetailed report saved to: $reportPath"
    Write-Host "View with: Get-Content $reportPath | ConvertFrom-Json"
}

# Main execution function
function Main {
    # Display header
    Write-Host "=================================================================" -ForegroundColor Magenta
    Write-Host "  🚀 OASIS TRADING SYSTEM - WINDOWS VALIDATION" -ForegroundColor Magenta
    Write-Host "=================================================================" -ForegroundColor Magenta
    Write-Host ""
    
    Write-Info "Starting Windows validation at $(Get-Date)"
    Write-Info "Log file: $LogPath"
    
    # Create validation directories
    $validationDirs = @("validation\logs", "validation\reports", "validation\temp")
    foreach ($dir in $validationDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    # Run test suites
    Test-Prerequisites
    Test-ProjectStructure
    Test-Configuration
    Test-DockerConfiguration
    Test-DatabaseConfiguration
    Test-PythonEnvironment
    Test-CICDConfiguration
    
    # Generate final report
    Generate-Report
}

# Execute main function
try {
    Main
} catch {
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    exit 1
}
