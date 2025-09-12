#!/bin/bash

# ===================================================================
# Oasis Trading System - Quick Setup Script (Poetry)
# ===================================================================
# Usage: curl -sSL https://raw.githubusercontent.com/oasis-trading/oasis-trading-system/main/scripts/quick-setup.sh | bash
# ===================================================================

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/oasis-trading/oasis-trading-system.git"
PROJECT_NAME="oasis-trading-system"
PYTHON_VERSION="3.11"

# Logging functions
log() {
    echo -e "${2:-$NC}[$(date +'%H:%M:%S')] $1${NC}"
}

info() { log "$1" "${BLUE}"; }
success() { log "$1" "${GREEN}"; }
warning() { log "$1" "${YELLOW}"; }
error() { log "$1" "${RED}"; }

error_exit() {
    error "ERROR: $1"
    exit 1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python version
check_python() {
    info "Checking Python version..."
    
    if command_exists python3; then
        PYTHON_CMD="python3"
    elif command_exists python; then
        PYTHON_CMD="python"
    else
        error_exit "Python not found. Please install Python ${PYTHON_VERSION}+ first."
    fi
    
    PYTHON_CURRENT_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_CURRENT_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_CURRENT_VERSION | cut -d'.' -f2)
    
    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 11 ]; then
        success "Python $PYTHON_CURRENT_VERSION found"
    else
        error_exit "Python ${PYTHON_VERSION}+ required. Found: $PYTHON_CURRENT_VERSION"
    fi
}

# Install Poetry
install_poetry() {
    info "Checking Poetry installation..."
    
    if command_exists poetry; then
        POETRY_VERSION=$(poetry --version | cut -d' ' -f3)
        success "Poetry $POETRY_VERSION found"
    else
        info "Installing Poetry..."
        curl -sSL https://install.python-poetry.org | python3 -
        
        # Add Poetry to PATH
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            export PATH="$HOME/.local/bin:$PATH"
        fi
        
        if command_exists poetry; then
            success "Poetry installed successfully"
        else
            error_exit "Poetry installation failed"
        fi
    fi
}

# Check Docker
check_docker() {
    info "Checking Docker..."
    
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        success "Docker $DOCKER_VERSION found"
        
        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            success "Docker daemon is running"
        else
            warning "Docker daemon is not running. Please start Docker."
        fi
    else
        warning "Docker not found. Install from: https://docs.docker.com/get-docker/"
    fi
    
    if command_exists docker-compose; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | tr -d ',')
        success "Docker Compose $COMPOSE_VERSION found"
    elif docker compose version >/dev/null 2>&1; then
        success "Docker Compose (Plugin) found"
    else
        warning "Docker Compose not found"
    fi
}

# Clone repository
clone_repo() {
    info "Setting up project directory..."
    
    if [ -d "$PROJECT_NAME" ]; then
        warning "Directory $PROJECT_NAME already exists"
        read -p "Remove and re-clone? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$PROJECT_NAME"
        else
            info "Using existing directory"
            cd "$PROJECT_NAME"
            return
        fi
    fi
    
    info "Cloning repository..."
    git clone "$REPO_URL" || error_exit "Failed to clone repository"
    cd "$PROJECT_NAME"
    success "Repository cloned successfully"
}

# Setup Poetry environment
setup_poetry() {
    info "Setting up Poetry environment..."
    
    # Configure Poetry
    poetry config virtualenvs.create true
    poetry config virtualenvs.in-project true
    
    # Install dependencies
    info "Installing dependencies... (this may take a few minutes)"
    poetry install --with=dev,docs || error_exit "Failed to install dependencies"
    
    success "Dependencies installed successfully"
    
    # Install pre-commit hooks
    info "Setting up pre-commit hooks..."
    poetry run pre-commit install || warning "Failed to install pre-commit hooks"
    
    success "Poetry environment ready"
}

# Setup environment file
setup_env() {
    info "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        success ".env file created from template"
        
        # Generate secret keys
        SECRET_KEY=$(poetry run python -c "import secrets; print(secrets.token_urlsafe(32))")
        JWT_SECRET_KEY=$(poetry run python -c "import secrets; print(secrets.token_urlsafe(32))")
        
        # Update .env file
        sed -i.bak "s/your-secret-key-change-this-in-production/$SECRET_KEY/" .env
        sed -i.bak "s/your-jwt-secret-key-change-this/$JWT_SECRET_KEY/" .env
        rm .env.bak 2>/dev/null || true
        
        success "Environment variables configured"
    else
        warning ".env file already exists"
    fi
}

# Create directories
setup_directories() {
    info "Creating project directories..."
    mkdir -p logs data backtest_results models checkpoints notebooks
    success "Directories created"
}

# Run basic tests
run_tests() {
    info "Running basic validation tests..."
    
    # Test Poetry environment
    poetry run python --version || error_exit "Python environment test failed"
    
    # Test imports
    poetry run python -c "
import sys
print(f'Python {sys.version}')
try:
    import fastapi, pandas, numpy
    print('✅ Core dependencies imported successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
" || error_exit "Dependency test failed"
    
    success "Basic tests passed"
}

# Print next steps
print_next_steps() {
    echo ""
    success "🎉 Oasis Trading System setup completed successfully!"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo ""
    echo "1. 🔧 Configure your environment:"
    echo "   ${YELLOW}nano .env${NC}  # Edit configuration"
    echo ""
    echo "2. 🚀 Start the development environment:"
    echo "   ${YELLOW}make up${NC}     # Start all services"
    echo "   ${YELLOW}make run-api${NC} # Or run API only"
    echo ""
    echo "3. 🧪 Run tests:"
    echo "   ${YELLOW}make test${NC}   # Run all tests"
    echo ""
    echo "4. 📚 Access services:"
    echo "   • API: ${YELLOW}http://localhost:8000${NC}"
    echo "   • Docs: ${YELLOW}http://localhost:8000/docs${NC}"
    echo "   • Grafana: ${YELLOW}http://localhost:3001${NC}"
    echo ""
    echo "5. 📖 Read the documentation:"
    echo "   ${YELLOW}make docs-serve${NC}  # Serve docs locally"
    echo ""
    echo -e "${GREEN}Happy Trading! 🚀${NC}"
    echo ""
    echo -e "${BLUE}💡 Useful commands:${NC}"
    echo "   ${YELLOW}poetry shell${NC}        # Activate virtual environment"
    echo "   ${YELLOW}make help${NC}           # Show all available commands"
    echo "   ${YELLOW}make setup${NC}          # Re-run setup if needed"
    echo ""
}

# Main setup function
main() {
    echo ""
    echo -e "${BLUE}=================================================================${NC}"
    echo -e "${BLUE}  🚀 OASIS TRADING SYSTEM - QUICK SETUP (Poetry)${NC}"
    echo -e "${BLUE}=================================================================${NC}"
    echo ""
    
    # Check prerequisites
    check_python
    install_poetry
    check_docker
    
    # Setup project
    clone_repo
    setup_poetry
    setup_env
    setup_directories
    
    # Validate setup
    run_tests
    
    # Show next steps
    print_next_steps
}

# Run main function
main "$@"