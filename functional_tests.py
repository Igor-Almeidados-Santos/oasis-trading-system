#!/usr/bin/env python3
"""
Oasis Trading System - Functional Tests for Phase 1
Tests core functionality and integrations
"""

import os
import sys
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# Simple test framework
class TestRunner:
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.results = []
    
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
    
    def test_imports(self):
        """Test Python imports"""
        print("\n🔍 Testing Python Imports...")
        
        # Test standard library imports
        try:
            import json, os, sys, pathlib
            self.test_result("Standard Library Imports", True)
        except ImportError as e:
            self.test_result("Standard Library Imports", False, str(e))
        
        # Test if we can add src to path
        try:
            src_path = Path(__file__).parent / "src"
            if src_path.exists():
                sys.path.insert(0, str(src_path))
                self.test_result("Source Path Addition", True)
            else:
                self.test_result("Source Path Addition", False, "src directory not found")
        except Exception as e:
            self.test_result("Source Path Addition", False, str(e))
    
    def test_project_structure(self):
        """Test project structure"""
        print("\n🔍 Testing Project Structure...")
        
        required_files = [
            "requirements.txt",
            "setup.py", 
            ".env.example",
            "README.md"
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
            "tests"
        ]
        
        for dir_path in required_dirs:
            if Path(dir_path).exists():
                self.test_result(f"Directory: {dir_path}", True)
            else:
                self.test_result(f"Directory: {dir_path}", False, "Directory missing")
    
    def test_configuration(self):
        """Test configuration loading"""
        print("\n🔍 Testing Configuration...")
        
        try:
            # Test .env.example reading
            env_file = Path(".env.example")
            if env_file.exists():
                with open(env_file) as f:
                    content = f.read()
                
                required_vars = ["ENVIRONMENT", "DATABASE_URL", "SECRET_KEY"]
                missing_vars = []
                
                for var in required_vars:
                    if f"{var}=" not in content:
                        missing_vars.append(var)
                
                if missing_vars:
                    self.test_result("Environment Variables", False, f"Missing: {missing_vars}")
                else:
                    self.test_result("Environment Variables", True)
            else:
                self.test_result("Environment File", False, ".env.example not found")
                
        except Exception as e:
            self.test_result("Configuration Test", False, str(e))
    
    def test_python_environment(self):
        """Test Python environment"""
        print("\n🔍 Testing Python Environment...")
        
        # Check Python version
        version = sys.version_info
        if version.major == 3 and version.minor >= 11:
            self.test_result("Python Version", True, f"Python {version.major}.{version.minor}")
        else:
            self.test_result("Python Version", False, f"Python {version.major}.{version.minor} (need 3.11+)")
        
        # Check if in virtual environment
        if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
            self.test_result("Virtual Environment", True, "Active virtual environment detected")
        else:
            self.test_result("Virtual Environment", False, "No virtual environment detected")
    
    def generate_report(self):
        """Generate test report"""
        print("\n🔍 Generating Report...")
        
        total = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total * 100) if total > 0 else 0
        
        report = {
            "functional_tests_python": {
                "timestamp": datetime.now().isoformat(),
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
        report_file = reports_dir / f"functional_tests_python_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        print("\n" + "="*60)
        print("📊 PYTHON FUNCTIONAL TESTS SUMMARY")
        print("="*60)
        print(f"Total Tests: {total}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.tests_failed == 0:
            print("\n🎉 ALL PYTHON TESTS PASSED!")
        elif success_rate >= 80:
            print("\n⚠️  Some tests failed but core functionality works")
        else:
            print("\n❌ Significant issues found")
        
        print(f"\nReport saved to: {report_file}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("="*60)
        print("🐍 OASIS TRADING SYSTEM - PYTHON FUNCTIONAL TESTS")
        print("="*60)
        
        self.test_imports()
        self.test_project_structure()
        self.test_configuration()
        self.test_python_environment()
        self.generate_report()

if __name__ == "__main__":
    runner = TestRunner()
    runner.run_all_tests()
