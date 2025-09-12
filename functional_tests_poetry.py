#!/usr/bin/env python3
"""
Oasis Trading System - Functional Tests for Poetry Setup
Tests core functionality and Poetry integrations
"""

import os
import sys
import json
import time
import subprocess
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# Simple test framework
class PoetryTestRunner:
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.results = []
        self.poetry_available = False
        self.venv_active = False
    
    def test_result(self, test_name: str, passed: bool, details: str = ""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
        if passed:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            self.tests_failed += 1
            print(f"❌ {test_name} - {details}")
    
    def run_command(self, command: List[str], timeout: int = 30) -> tuple:
        """Run a command and return success status and output"""
        try:
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                timeout=timeout,
                cwd=Path.cwd()
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except Exception as e:
            return False, "", str(e)
    
    def test_poetry_installation(self):
        """Test Poetry installation and configuration"""
        print("\n🔍 Testing Poetry Installation...")
        
        # Check if Poetry is installed
        success, stdout, stderr = self.run_command(["poetry", "--version"])
        if success:
            self.poetry_available = True
            version = stdout.strip()
            self.test_result("Poetry Installation", True, version)
            
            # Check Poetry configuration
            success, stdout, stderr = self.run_command(["poetry", "config", "--list"])
            if success:
                self.test_result("Poetry Configuration", True, "Configuration accessible")
            else:
                self.test_result("Poetry Configuration", False, stderr)
                
        else:
            self.test_result("Poetry Installation", False, "Poetry command not found")
            return
        
        # Test pyproject.toml existence and validity
        if Path("pyproject.toml").exists():
            self.test_result("pyproject.toml Exists", True)
            
            # Validate pyproject.toml
            success, stdout, stderr = self.run_command(["poetry", "check"])
            if success:
                self.test_result("pyproject.toml Validation", True, "Valid configuration")
            else:
                self.test_result("pyproject.toml Validation", False, stderr)
        else:
            self.test_result("pyproject.toml Exists", False, "File not found")
        
        # Check for poetry.lock
        if Path("poetry.lock").exists():
            self.test_result("poetry.lock Exists", True)
        else:
            self.test_result("poetry.lock Exists", False, "Lock file not found")
    
    def test_poetry_environment(self):
        """Test Poetry virtual environment"""
        print("\n🔍 Testing Poetry Environment...")
        
        if not self.poetry_available:
            self.test_result("Poetry Environment", False, "Poetry not available")
            return
        
        # Get virtual environment info
        success, stdout, stderr = self.run_command(["poetry", "env", "info"])
        if success:
            self.test_result("Virtual Environment Info", True, "Environment accessible")
            
            # Check if we're in a virtual environment
            if "Virtualenv" in stdout:
                self.venv_active = True
                self.test_result("Virtual Environment Active", True, "Poetry venv detected")
            else:
                self.test_result("Virtual Environment Active", False, "No virtual environment")
        else:
            self.test_result("Virtual Environment Info", False, stderr)
        
        # Test Poetry run command
        success, stdout, stderr = self.run_command([
            "poetry", "run", "python", "-c", 
            "import sys; print(f'Python {sys.version_info.major}.{sys.version_info.minor}')"
        ])
        if success:
            python_version = stdout.strip()
            self.test_result("Poetry Run Command", True, python_version)
        else:
            self.test_result("Poetry Run Command", False, stderr)
    
    def test_poetry_dependencies(self):
        """Test Poetry dependencies"""
        print("\n🔍 Testing Poetry Dependencies...")
        
        if not self.poetry_available:
            self.test_result("Poetry Dependencies", False, "Poetry not available")
            return
        
        # List installed packages
        success, stdout, stderr = self.run_command(["poetry", "show"])
        if success:
            packages = [line.split()[0] for line in stdout.strip().split('\n') if line.strip()]
            self.test_result("Dependencies List", True, f"{len(packages)} packages found")
            
            # Check core dependencies
            core_deps = ["fastapi", "uvicorn", "pydantic", "pandas", "numpy"]
            missing_deps = []
            
            for dep in core_deps:
                if dep in packages:
                    self.test_result(f"Core Dependency: {dep}", True)
                else:
                    missing_deps.append(dep)
                    self.test_result(f"Core Dependency: {dep}", False, "Not installed")
            
            if not missing_deps:
                self.test_result("All Core Dependencies", True)
            else:
                self.test_result("All Core Dependencies", False, f"Missing: {missing_deps}")
                
        else:
            self.test_result("Dependencies List", False, stderr)
        
        # Test development dependencies
        success, stdout, stderr = self.run_command(["poetry", "show", "--group=dev"])
        if success:
            dev_packages = stdout.strip().split('\n')
            self.test_result("Development Dependencies", True, f"{len(dev_packages)} dev packages")
        else:
            self.test_result("Development Dependencies", False, "Dev group not available")
    
    def test_poetry_scripts(self):
        """Test Poetry scripts and commands"""
        print("\n🔍 Testing Poetry Scripts...")
        
        if not self.poetry_available:
            return
        
        # Test if we can import core modules
        test_imports = [
            ("FastAPI Import", "import fastapi; print('FastAPI available')"),
            ("Pydantic Import", "import pydantic; print('Pydantic available')"),
            ("Pandas Import", "import pandas; print('Pandas available')"),
            ("NumPy Import", "import numpy; print('NumPy available')"),
        ]
        
        for test_name, import_code in test_imports:
            success, stdout, stderr = self.run_command([
                "poetry", "run", "python", "-c", import_code
            ])
            if success and "available" in stdout:
                self.test_result(test_name, True)
            else:
                self.test_result(test_name, False, stderr or "Import failed")
        
        # Test if Poetry scripts are defined
        try:
            import toml
            with open("pyproject.toml", "r") as f:
                config = toml.load(f)
            
            scripts = config.get("tool", {}).get("poetry", {}).get("scripts", {})
            if scripts:
                self.test_result("Poetry Scripts Defined", True, f"{len(scripts)} scripts")
                
                # Test a simple script if available
                if "ots" in scripts:
                    success, stdout, stderr = self.run_command(["poetry", "run", "ots", "--help"])
                    if success:
                        self.test_result("OTS Script Executable", True)
                    else:
                        self.test_result("OTS Script Executable", False, stderr)
            else:
                self.test_result("Poetry Scripts Defined", False, "No scripts defined")
                
        except Exception as e:
            self.test_result("Poetry Scripts Check", False, str(e))
    
    def test_project_structure(self):
        """Test project structure"""
        print("\n🔍 Testing Project Structure...")
        
        required_files = [
            "pyproject.toml",
            "poetry.lock",
            "README.md",
            ".env.example",
            ".gitignore",
            "Makefile"
        ]
        
        for file in required_files:
            if Path(file).exists():
                self.test_result(f"File: {file}", True)
            else:
                self.test_result(f"File: {file}", False, "File missing")
        
        required_dirs = [
            "src",
            "src/config",
            "src/infrastructure", 
            "src/core",
            "tests",
            "infrastructure/docker"
        ]
        
        for dir_path in required_dirs:
            if Path(dir_path).exists():
                self.test_result(f"Directory: {dir_path}", True)
            else:
                self.test_result(f"Directory: {dir_path}", False, "Directory missing")
    
    def test_configuration_loading(self):
        """Test configuration loading with Poetry"""
        print("\n🔍 Testing Configuration Loading...")
        
        if not self.poetry_available:
            return
        
        # Test settings import
        test_code = """
try:
    import sys
    sys.path.append('src')
    from config.settings import settings
    print(f'Settings loaded: {settings.PROJECT_NAME}')
    print(f'Environment: {settings.ENVIRONMENT}')
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
"""
        
        success, stdout, stderr = self.run_command([
            "poetry", "run", "python", "-c", test_code
        ])
        
        if success and "Settings loaded" in stdout:
            self.test_result("Settings Configuration", True, "Settings module loaded")
        else:
            self.test_result("Settings Configuration", False, stderr or "Failed to load settings")
        
        # Test environment file reading
        env_file = Path(".env.example")
        if env_file.exists():
            with open(env_file) as f:
                content = f.read()
            
            required_vars = ["ENVIRONMENT", "DATABASE_URL", "SECRET_KEY", "JWT_SECRET_KEY"]
            missing_vars = []
            
            for var in required_vars:
                if f"{var}=" not in content:
                    missing_vars.append(var)
            
            if missing_vars:
                self.test_result("Environment Variables", False, f"Missing: {missing_vars}")
            else:
                self.test_result("Environment Variables", True, "All required vars present")
        else:
            self.test_result("Environment File", False, ".env.example not found")
    
    def test_docker_integration(self):
        """Test Docker integration with Poetry"""
        print("\n🔍 Testing Docker Integration...")
        
        docker_compose = Path("infrastructure/docker/docker-compose.yml")
        if docker_compose.exists():
            self.test_result("Docker Compose File", True)
            
            # Check for Poetry-specific configurations in Docker Compose
            with open(docker_compose) as f:
                content = f.read()
            
            if "POETRY_NO_INTERACTION" in content:
                self.test_result("Docker Poetry Config", True, "Poetry environment variables configured")
            else:
                self.test_result("Docker Poetry Config", False, "Poetry env vars not configured")
                
        else:
            self.test_result("Docker Compose File", False, "docker-compose.yml not found")
        
        # Check Dockerfiles
        dockerfiles = ["Dockerfile.api", "Dockerfile.worker", "Dockerfile.ml"]
        for dockerfile_name in dockerfiles:
            dockerfile_path = Path(f"infrastructure/docker/{dockerfile_name}")
            if dockerfile_path.exists():
                with open(dockerfile_path) as f:
                    content = f.read()
                
                if "poetry" in content.lower():
                    self.test_result(f"Dockerfile Poetry: {dockerfile_name}", True)
                else:
                    self.test_result(f"Dockerfile Poetry: {dockerfile_name}", False, "No Poetry configuration")
            else:
                self.test_result(f"Dockerfile: {dockerfile_name}", False, "File not found")
    
    def test_makefile_integration(self):
        """Test Makefile integration with Poetry"""
        print("\n🔍 Testing Makefile Integration...")
        
        makefile = Path("Makefile")
        if makefile.exists():
            with open(makefile) as f:
                content = f.read()
            
            if "POETRY :=" in content:
                self.test_result("Makefile Poetry Variable", True)
            else:
                self.test_result("Makefile Poetry Variable", False, "Poetry variable not defined")
            
            poetry_commands = ["poetry install", "poetry run", "poetry shell"]
            found_commands = []
            
            for cmd in poetry_commands:
                if cmd in content:
                    found_commands.append(cmd)
            
            if len(found_commands) >= 2:
                self.test_result("Makefile Poetry Commands", True, f"Found: {found_commands}")
            else:
                self.test_result("Makefile Poetry Commands", False, "Insufficient Poetry commands")
                
        else:
            self.test_result("Makefile Exists", False, "Makefile not found")
    
    def generate_report(self):
        """Generate test report"""
        print("\n🔍 Generating Report...")
        
        total = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total * 100) if total > 0 else 0
        
        report = {
            "functional_tests_poetry": {
                "timestamp": datetime.now().isoformat(),
                "poetry_available": self.poetry_available,
                "venv_active": self.venv_active,
                "summary": {
                    "total": total,
                    "passed": self.tests_passed,
                    "failed": self.tests_failed,
                    "success_rate": f"{success_rate:.1f}%"
                },
                "tests": self.results
            }
        }
        
        # Create reports directory
        reports_dir = Path("validation/reports")
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Save report
        report_file = reports_dir / f"functional_tests_poetry_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        print("\n" + "="*60)
        print("📊 POETRY FUNCTIONAL TESTS SUMMARY")
        print("="*60)
        print(f"Total Tests: {total}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"Poetry Available: {'✅' if self.poetry_available else '❌'}")
        print(f"Virtual Environment: {'✅' if self.venv_active else '❌'}")
        
        if self.tests_failed == 0 and self.poetry_available:
            print("\n🎉 ALL POETRY TESTS PASSED!")
            print("✅ Your Poetry setup is perfect!")
            print("\nNext steps:")
            print("1. poetry install --with=dev,docs")
            print("2. poetry shell")
            print("3. make run-api")
        elif self.poetry_available and success_rate >= 80:
            print("\n⚠️  Some tests failed but Poetry core functionality works")
            print("Run: poetry install --with=dev")
        else:
            print("\n❌ Significant issues found with Poetry setup")
            if not self.poetry_available:
                print("🔧 Install Poetry: https://python-poetry.org/docs/#installation")
            print("🔧 Run setup: make setup")
        
        print(f"\nDetailed report: {report_file}")
        
        # Show useful commands
        print(f"\n💡 Useful Poetry commands:")
        print("poetry --version          # Check Poetry version")
        print("poetry install           # Install dependencies")
        print("poetry install --with=dev  # Install with dev deps")
        print("poetry shell             # Activate virtual environment")
        print("poetry run python        # Run Python in venv")
        print("poetry show              # List dependencies")
        print("poetry add package-name  # Add new dependency")
        print("poetry env info          # Show venv information")
    
    def run_all_tests(self):
        """Run all tests"""
        print("="*60)
        print("🐍 OASIS TRADING SYSTEM - POETRY FUNCTIONAL TESTS")
        print("="*60)
        
        self.test_poetry_installation()
        self.test_poetry_environment()
        self.test_poetry_dependencies()
        self.test_poetry_scripts()
        self.test_project_structure()
        self.test_configuration_loading()
        self.test_docker_integration()
        self.test_makefile_integration()
        self.generate_report()

if __name__ == "__main__":
    runner = PoetryTestRunner()
    runner.run_all_tests()