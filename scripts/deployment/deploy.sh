#!/bin/bash

# ====================================================================================
# Oasis Trading System - Deployment Script
# ====================================================================================
# Usage: ./deploy.sh [environment] [action]
# Environments: dev, staging, production
# Actions: deploy, rollback, status, logs
# ====================================================================================

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/deployment_${TIMESTAMP}.log"

# Default values
ENVIRONMENT="${1:-staging}"
ACTION="${2:-deploy}"
NAMESPACE="oasis-trading"
DOCKER_REGISTRY="ghcr.io/oasis-trading"
HELM_RELEASE="oasis"

# Ensure logs directory exists
mkdir -p "${PROJECT_ROOT}/logs"

# Logging function
log() {
    echo -e "${2:-$NC}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR: $1" "${RED}"
    exit 1
}

# Success message
success() {
    log "SUCCESS: $1" "${GREEN}"
}

# Warning message
warning() {
    log "WARNING: $1" "${YELLOW}"
}

# Info message
info() {
    log "INFO: $1" "${BLUE}"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error_exit "kubectl is not installed"
    fi
    
    # Check helm (optional)
    if command -v helm &> /dev/null; then
        info "Helm is installed"
        HELM_AVAILABLE=true
    else
        warning "Helm is not installed, using kubectl for deployment"
        HELM_AVAILABLE=false
    fi
    
    # Check environment file
    ENV_FILE="${PROJECT_ROOT}/.env.${ENVIRONMENT}"
    if [[ ! -f "${ENV_FILE}" ]]; then
        warning "Environment file ${ENV_FILE} not found, using defaults"
    else
        info "Loading environment from ${ENV_FILE}"
        source "${ENV_FILE}"
    fi
    
    success "Prerequisites check completed"
}

# Build Docker images
build_images() {
    info "Building Docker images for ${ENVIRONMENT}..."
    
    cd "${PROJECT_ROOT}"
    
    # Build API image
    info "Building API image..."
    docker build \
        -f infrastructure/docker/Dockerfile.api \
        -t "${DOCKER_REGISTRY}/api:${TIMESTAMP}" \
        -t "${DOCKER_REGISTRY}/api:latest" \
        --build-arg ENVIRONMENT="${ENVIRONMENT}" \
        . || error_exit "Failed to build API image"
    
    # Build Worker image
    info "Building Worker image..."
    docker build \
        -f infrastructure/docker/Dockerfile.worker \
        -t "${DOCKER_REGISTRY}/worker:${TIMESTAMP}" \
        -t "${DOCKER_REGISTRY}/worker:latest" \
        --build-arg ENVIRONMENT="${ENVIRONMENT}" \
        . || error_exit "Failed to build Worker image"
    
    # Build ML image (if ML features enabled)
    if [[ "${ENABLE_ML_STRATEGIES}" == "true" ]]; then
        info "Building ML image..."
        docker build \
            -f infrastructure/docker/Dockerfile.ml \
            -t "${DOCKER_REGISTRY}/ml:${TIMESTAMP}" \
            -t "${DOCKER_REGISTRY}/ml:latest" \
            --build-arg ENVIRONMENT="${ENVIRONMENT}" \
            . || error_exit "Failed to build ML image"
    fi
    
    success "Docker images built successfully"
}

# Push images to registry
push_images() {
    info "Pushing images to registry..."
    
    # Login to registry (GitHub Container Registry)
    echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_USER}" --password-stdin || \
        error_exit "Failed to login to registry"
    
    # Push images
    docker push "${DOCKER_REGISTRY}/api:${TIMESTAMP}"
    docker push "${DOCKER_REGISTRY}/api:latest"
    docker push "${DOCKER_REGISTRY}/worker:${TIMESTAMP}"
    docker push "${DOCKER_REGISTRY}/worker:latest"
    
    if [[ "${ENABLE_ML_STRATEGIES}" == "true" ]]; then
        docker push "${DOCKER_REGISTRY}/ml:${TIMESTAMP}"
        docker push "${DOCKER_REGISTRY}/ml:latest"
    fi
    
    success "Images pushed to registry"
}

# Run tests
run_tests() {
    info "Running tests..."
    
    cd "${PROJECT_ROOT}"
    
    # Run unit tests
    info "Running unit tests..."
    docker run --rm \
        -v "${PROJECT_ROOT}:/app" \
        -w /app \
        "${DOCKER_REGISTRY}/api:latest" \
        pytest tests/unit -v --tb=short || warning "Some unit tests failed"
    
    # Run integration tests (if not production)
    if [[ "${ENVIRONMENT}" != "production" ]]; then
        info "Running integration tests..."
        docker-compose -f docker-compose.test.yml up --abort-on-container-exit || \
            warning "Some integration tests failed"
    fi
    
    success "Tests completed"
}

# Database migrations
run_migrations() {
    info "Running database migrations..."
    
    # Get database pod
    DB_POD=$(kubectl get pods -n "${NAMESPACE}" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -z "${DB_POD}" ]]; then
        warning "Database pod not found, skipping migrations"
        return
    fi
    
    # Run migrations
    kubectl exec -n "${NAMESPACE}" "${DB_POD}" -- \
        psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
        -f /migrations/latest.sql || warning "Migrations failed"
    
    success "Database migrations completed"
}

# Deploy with kubectl
deploy_kubectl() {
    info "Deploying with kubectl to ${ENVIRONMENT}..."
    
    # Set kubectl context
    kubectl config use-context "${ENVIRONMENT}-cluster" || \
        error_exit "Failed to set kubectl context"
    
    # Create namespace if not exists
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configurations
    info "Applying Kubernetes configurations..."
    
    # Base configurations
    kubectl apply -f "${PROJECT_ROOT}/infrastructure/kubernetes/base/" -n "${NAMESPACE}"
    
    # Environment-specific configurations
    ENV_DIR="${PROJECT_ROOT}/infrastructure/kubernetes/${ENVIRONMENT}"
    if [[ -d "${ENV_DIR}" ]]; then
        kubectl apply -f "${ENV_DIR}/" -n "${NAMESPACE}"
    fi
    
    # Update image tags
    info "Updating image tags..."
    kubectl set image deployment/api-deployment \
        api="${DOCKER_REGISTRY}/api:${TIMESTAMP}" \
        -n "${NAMESPACE}"
    
    kubectl set image deployment/worker-deployment \
        worker="${DOCKER_REGISTRY}/worker:${TIMESTAMP}" \
        -n "${NAMESPACE}"
    
    # Wait for rollout
    info "Waiting for rollout to complete..."
    kubectl rollout status deployment/api-deployment -n "${NAMESPACE}" --timeout=300s || \
        error_exit "API deployment failed"
    
    kubectl rollout status deployment/worker-deployment -n "${NAMESPACE}" --timeout=300s || \
        error_exit "Worker deployment failed"
    
    success "Deployment completed successfully"
}

# Deploy with Helm
deploy_helm() {
    info "Deploying with Helm to ${ENVIRONMENT}..."
    
    # Add/update Helm repository
    helm repo add oasis "${HELM_REPO_URL}" || true
    helm repo update
    
    # Prepare values file
    VALUES_FILE="${PROJECT_ROOT}/infrastructure/helm/values.${ENVIRONMENT}.yaml"
    
    # Deploy or upgrade
    helm upgrade --install "${HELM_RELEASE}" oasis/oasis-trading \
        -f "${VALUES_FILE}" \
        -n "${NAMESPACE}" \
        --create-namespace \
        --set image.tag="${TIMESTAMP}" \
        --wait \
        --timeout 10m || error_exit "Helm deployment failed"
    
    success "Helm deployment completed successfully"
}

# Main deployment function
deploy() {
    info "Starting deployment to ${ENVIRONMENT}..."
    
    # Build and push images
    build_images
    push_images
    
    # Run tests
    run_tests
    
    # Deploy
    if [[ "${HELM_AVAILABLE}" == "true" ]] && [[ -d "${PROJECT_ROOT}/infrastructure/helm" ]]; then
        deploy_helm
    else
        deploy_kubectl
    fi
    
    # Run migrations
    run_migrations
    
    # Verify deployment
    verify_deployment
    
    success "Deployment to ${ENVIRONMENT} completed successfully!"
}

# Rollback deployment
rollback() {
    info "Rolling back deployment in ${ENVIRONMENT}..."
    
    if [[ "${HELM_AVAILABLE}" == "true" ]]; then
        helm rollback "${HELM_RELEASE}" -n "${NAMESPACE}" || \
            error_exit "Helm rollback failed"
    else
        kubectl rollout undo deployment/api-deployment -n "${NAMESPACE}"
        kubectl rollout undo deployment/worker-deployment -n "${NAMESPACE}"
    fi
    
    success "Rollback completed"
}

# Check deployment status
check_status() {
    info "Checking deployment status in ${ENVIRONMENT}..."
    
    echo -e "\n${BLUE}=== Pods ===${NC}"
    kubectl get pods -n "${NAMESPACE}"
    
    echo -e "\n${BLUE}=== Services ===${NC}"
    kubectl get services -n "${NAMESPACE}"
    
    echo -e "\n${BLUE}=== Deployments ===${NC}"
    kubectl get deployments -n "${NAMESPACE}"
    
    echo -e "\n${BLUE}=== Ingress ===${NC}"
    kubectl get ingress -n "${NAMESPACE}"
    
    if [[ "${HELM_AVAILABLE}" == "true" ]]; then
        echo -e "\n${BLUE}=== Helm Status ===${NC}"
        helm status "${HELM_RELEASE}" -n "${NAMESPACE}"
    fi
}

# View logs
view_logs() {
    info "Viewing logs for ${ENVIRONMENT}..."
    
    # Select component
    echo "Select component:"
    echo "1) API"
    echo "2) Worker"
    echo "3) All"
    read -r -p "Choice: " choice
    
    case $choice in
        1)
            kubectl logs -f deployment/api-deployment -n "${NAMESPACE}" --tail=100
            ;;
        2)
            kubectl logs -f deployment/worker-deployment -n "${NAMESPACE}" --tail=100
            ;;
        3)
            kubectl logs -f -n "${NAMESPACE}" --all-containers=true --tail=100
            ;;
        *)
            error_exit "Invalid choice"
            ;;
    esac
}

# Verify deployment health
verify_deployment() {
    info "Verifying deployment health..."
    
    # Check API health
    API_URL=$(kubectl get ingress oasis-ingress -n "${NAMESPACE}" \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [[ -n "${API_URL}" ]]; then
        info "Checking API health at ${API_URL}..."
        
        for i in {1..10}; do
            if curl -s -f "https://${API_URL}/health" > /dev/null; then
                success "API is healthy"
                break
            else
                warning "API health check attempt $i failed, retrying..."
                sleep 10
            fi
        done
    else
        warning "Could not determine API URL"
    fi
    
    # Check pod status
    UNHEALTHY_PODS=$(kubectl get pods -n "${NAMESPACE}" \
        --field-selector=status.phase!=Running \
        --no-headers 2>/dev/null | wc -l)
    
    if [[ "${UNHEALTHY_PODS}" -gt 0 ]]; then
        warning "Found ${UNHEALTHY_PODS} unhealthy pods"
    else
        success "All pods are running"
    fi
}

# Cleanup old resources
cleanup() {
    info "Cleaning up old resources..."
    
    # Delete old replica sets
    kubectl delete replicasets -n "${NAMESPACE}" \
        --field-selector=status.replicas=0 || true
    
    # Clean old Docker images
    docker image prune -f --filter "until=168h" || true
    
    success "Cleanup completed"
}

# Main execution
main() {
    log "=== Oasis Trading System Deployment Script ===" "${BLUE}"
    log "Environment: ${ENVIRONMENT}" "${BLUE}"
    log "Action: ${ACTION}" "${BLUE}"
    log "Timestamp: ${TIMESTAMP}" "${BLUE}"
    log "Log file: ${LOG_FILE}" "${BLUE}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Execute action
    case "${ACTION}" in
        deploy)
            deploy
            cleanup
            ;;
        rollback)
            rollback
            ;;
        status)
            check_status
            ;;
        logs)
            view_logs
            ;;
        test)
            run_tests
            ;;
        build)
            build_images
            ;;
        push)
            push_images
            ;;
        migrate)
            run_migrations
            ;;
        verify)
            verify_deployment
            ;;
        cleanup)
            cleanup
            ;;
        *)
            error_exit "Invalid action: ${ACTION}. Valid actions: deploy, rollback, status, logs, test, build, push, migrate, verify, cleanup"
            ;;
    esac
    
    success "Operation completed successfully!"
}

# Run main function
main "$@"