#!/bin/bash

# FarmLokal Backend Setup and Testing Script
# This script sets up the environment and runs comprehensive tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 FarmLokal Backend Setup and Testing${NC}"
echo "========================================"

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_status "📋 Checking prerequisites..." "$YELLOW"

if ! command_exists node; then
    print_status "❌ Node.js is not installed" "$RED"
    exit 1
fi

if ! command_exists npm; then
    print_status "❌ npm is not installed" "$RED"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "✅ Node.js version: $NODE_VERSION" "$GREEN"

# Check if Docker is available (optional)
if command_exists docker && command_exists docker-compose; then
    print_status "✅ Docker and Docker Compose available" "$GREEN"
    DOCKER_AVAILABLE=true
else
    print_status "⚠️  Docker not available - will use local setup" "$YELLOW"
    DOCKER_AVAILABLE=false
fi

# Setup environment file
print_status "📝 Setting up environment..." "$YELLOW"

if [ ! -f .env ]; then
    cp .env.example .env
    print_status "✅ Created .env file from .env.example" "$GREEN"
else
    print_status "✅ .env file already exists" "$GREEN"
fi

# Install dependencies
print_status "📦 Installing dependencies..." "$YELLOW"
npm install --silent

if [ $? -eq 0 ]; then
    print_status "✅ Dependencies installed successfully" "$GREEN"
else
    print_status "❌ Failed to install dependencies" "$RED"
    exit 1
fi

# Build the project
print_status "🔨 Building the project..." "$YELLOW"
npm run build

if [ $? -eq 0 ]; then
    print_status "✅ Project built successfully" "$GREEN"
else
    print_status "❌ Build failed" "$RED"
    exit 1
fi

# Function to setup with Docker
setup_with_docker() {
    print_status "🐳 Setting up with Docker..." "$YELLOW"
    
    # Stop any existing containers
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Start services
    print_status "🚀 Starting services with Docker Compose..." "$YELLOW"
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_status "✅ Services started successfully" "$GREEN"
    else
        print_status "❌ Failed to start services" "$RED"
        return 1
    fi
    
    # Wait for services to be ready
    print_status "⏳ Waiting for services to be ready..." "$YELLOW"
    sleep 30
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        print_status "✅ Services are running" "$GREEN"
    else
        print_status "❌ Services failed to start properly" "$RED"
        docker-compose logs
        return 1
    fi
    
    # Run migrations
    print_status "🗄️  Running database migrations..." "$YELLOW"
    docker-compose exec -T farmlokal-api npm run migrate
    
    if [ $? -eq 0 ]; then
        print_status "✅ Database migrations completed" "$GREEN"
    else
        print_status "❌ Database migrations failed" "$RED"
        return 1
    fi
    
    # Seed database (with smaller dataset for testing)
    print_status "🌱 Seeding database..." "$YELLOW"
    docker-compose exec -T farmlokal-api npm run seed -- --products 1000 --farmers 100 --customers 500
    
    if [ $? -eq 0 ]; then
        print_status "✅ Database seeded successfully" "$GREEN"
    else
        print_status "⚠️  Database seeding had issues, continuing..." "$YELLOW"
    fi
    
    return 0
}

# Function to setup locally (without Docker)
setup_locally() {
    print_status "💻 Setting up locally..." "$YELLOW"
    
    # Check if MySQL and Redis are available
    if ! command_exists mysql && ! command_exists mysqladmin; then
        print_status "❌ MySQL is not available locally" "$RED"
        print_status "   Please install MySQL or use Docker setup" "$YELLOW"
        return 1
    fi
    
    if ! command_exists redis-cli; then
        print_status "❌ Redis is not available locally" "$RED"
        print_status "   Please install Redis or use Docker setup" "$YELLOW"
        return 1
    fi
    
    # Start the application in development mode
    print_status "🚀 Starting application in development mode..." "$YELLOW"
    npm run dev &
    APP_PID=$!
    
    # Wait for application to start
    sleep 10
    
    return 0
}

# Choose setup method
if [ "$DOCKER_AVAILABLE" = true ]; then
    if setup_with_docker; then
        SETUP_SUCCESS=true
        CLEANUP_DOCKER=true
    else
        print_status "❌ Docker setup failed, trying local setup..." "$RED"
        SETUP_SUCCESS=false
        CLEANUP_DOCKER=false
    fi
else
    if setup_locally; then
        SETUP_SUCCESS=true
        CLEANUP_DOCKER=false
    else
        SETUP_SUCCESS=false
        CLEANUP_DOCKER=false
    fi
fi

if [ "$SETUP_SUCCESS" != true ]; then
    print_status "❌ Setup failed" "$RED"
    exit 1
fi

# Wait a bit more for everything to be ready
print_status "⏳ Waiting for system to be fully ready..." "$YELLOW"
sleep 5

# Run the comprehensive API tests
print_status "🧪 Running comprehensive API tests..." "$YELLOW"

if [ -f test-all-apis.js ]; then
    node test-all-apis.js
    TEST_EXIT_CODE=$?
else
    print_status "❌ Test script not found" "$RED"
    TEST_EXIT_CODE=1
fi

# Cleanup function
cleanup() {
    print_status "🧹 Cleaning up..." "$YELLOW"
    
    if [ "$CLEANUP_DOCKER" = true ]; then
        docker-compose down --remove-orphans
        print_status "✅ Docker containers stopped" "$GREEN"
    fi
    
    if [ ! -z "$APP_PID" ]; then
        kill $APP_PID 2>/dev/null || true
        print_status "✅ Local application stopped" "$GREEN"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Print final results
echo ""
print_status "🎯 FINAL RESULTS" "$BLUE"
echo "=================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "🎉 ALL TESTS PASSED!" "$GREEN"
    print_status "✅ FarmLokal Backend is working correctly" "$GREEN"
else
    print_status "❌ Some tests failed" "$RED"
    print_status "🔍 Check the test output above for details" "$YELLOW"
fi

# Show test report if it exists
if [ -f test-report.json ]; then
    print_status "📊 Test report saved to: test-report.json" "$BLUE"
    
    # Extract key metrics from report
    SUCCESS_RATE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('test-report.json')).summary.successRate)")
    TOTAL_TESTS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('test-report.json')).summary.totalTests)")
    PASSED_TESTS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('test-report.json')).summary.passedTests)")
    
    print_status "📈 Success Rate: $SUCCESS_RATE ($PASSED_TESTS/$TOTAL_TESTS tests passed)" "$BLUE"
fi

exit $TEST_EXIT_CODE