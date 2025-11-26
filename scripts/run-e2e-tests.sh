#!/bin/bash
# E2E Test Execution Script (Bash/Linux/Mac)
# Runs Playwright E2E tests for admin flows
# Usage: ./scripts/run-e2e-tests.sh [options]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== E2E Test Execution Script ===${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/playwright.config.ts" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    echo -e "${YELLOW}   Current directory: $(pwd)${NC}"
    exit 1
fi

# Check if backend is running
echo -e "${YELLOW}Checking backend status...${NC}"
if curl -s -f http://127.0.0.1:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is NOT running or not accessible${NC}"
    echo -e "${YELLOW}   Tests may skip if backend is required${NC}"
    echo -e "${YELLOW}   Start backend with: cd backend && npm run dev${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted by user${NC}"
        exit 1
    fi
fi

echo ""

# Navigate to frontend directory
cd frontend

# Determine test file
TEST_FILE="e2e/admin-flows.spec.ts"
if [ "$1" = "--all" ]; then
    TEST_FILE=""
    echo -e "${CYAN}Running: All E2E Tests${NC}"
elif [ "$1" = "--pattern" ] && [ -n "$2" ]; then
    TEST_FILE="$2"
    echo -e "${CYAN}Running: Tests matching pattern '$TEST_FILE'${NC}"
else
    echo -e "${CYAN}Running: Admin Flows E2E Tests${NC}"
fi

# Determine mode
MODE=""
if [ "$1" = "--ui" ] || [ "$2" = "--ui" ]; then
    MODE="--ui"
    echo -e "${CYAN}Mode: Interactive UI${NC}"
elif [ "$1" = "--headed" ] || [ "$2" = "--headed" ]; then
    MODE="--headed"
    echo -e "${CYAN}Mode: Headed (visible browser)${NC}"
else
    echo -e "${CYAN}Mode: Headless${NC}"
fi

echo ""

# Run tests
if [ -n "$TEST_FILE" ]; then
    npx playwright test "$TEST_FILE" $MODE
else
    npx playwright test $MODE
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Tests completed successfully!${NC}"
else
    echo -e "${RED}❌ Tests failed or had errors (exit code: $EXIT_CODE)${NC}"
    echo ""
    echo -e "${YELLOW}View detailed report:${NC}"
    echo -e "${GRAY}  npx playwright show-report${NC}"
    echo ""
    echo -e "${YELLOW}Test results location:${NC}"
    echo -e "${GRAY}  - HTML Report: frontend/playwright-report/index.html${NC}"
    echo -e "${GRAY}  - JUnit XML: frontend/test-results/junit.xml${NC}"
    echo -e "${GRAY}  - JSON Report: frontend/test-results/results.json${NC}"
fi

exit $EXIT_CODE

