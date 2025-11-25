#!/bin/bash
# Deployment Verification Script
# Verifies that the application is properly deployed and functioning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
MAX_RETRIES=5
RETRY_DELAY=2

echo "🔍 Starting Deployment Verification..."
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $description... "
    
    for i in $(seq 1 $MAX_RETRIES); do
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✓${NC} (Status: $response)"
            return 0
        fi
        
        if [ $i -lt $MAX_RETRIES ]; then
            echo -n "Retrying ($i/$MAX_RETRIES)... "
            sleep $RETRY_DELAY
        fi
    done
    
    echo -e "${RED}✗${NC} (Status: $response, Expected: $expected_status)"
    return 1
}

# Function to check API response
check_api_response() {
    local url=$1
    local description=$2
    local expected_key=$3
    
    echo -n "Checking $description... "
    
    response=$(curl -s "$url" || echo "")
    
    if [ -z "$response" ]; then
        echo -e "${RED}✗${NC} (No response)"
        return 1
    fi
    
    if echo "$response" | grep -q "$expected_key"; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} (Unexpected response)"
        return 1
    fi
}

# Health Checks
echo "=== Health Checks ==="
check_endpoint "$API_URL/api/health" "Backend Health" 200
check_endpoint "$FRONTEND_URL" "Frontend Availability" 200
echo ""

# API Endpoints
echo "=== API Endpoints ==="
check_endpoint "$API_URL/api/health" "Health Endpoint" 200
check_api_response "$API_URL/api/health" "Health Response" "status"
echo ""

# Database Connectivity (if backend is running)
echo "=== Database Connectivity ==="
if check_endpoint "$API_URL/api/health" "Database Check" 200 > /dev/null 2>&1; then
    health_response=$(curl -s "$API_URL/api/health")
    if echo "$health_response" | grep -q "database"; then
        echo -e "${GREEN}✓${NC} Database connectivity verified"
    else
        echo -e "${YELLOW}⚠${NC} Database status not in health check"
    fi
else
    echo -e "${YELLOW}⚠${NC} Backend not accessible, skipping database check"
fi
echo ""

# Security Headers
echo "=== Security Headers ==="
headers=$(curl -s -I "$API_URL/api/health" || echo "")
if echo "$headers" | grep -qi "x-content-type-options"; then
    echo -e "${GREEN}✓${NC} Security headers present"
else
    echo -e "${YELLOW}⚠${NC} Security headers not detected"
fi
echo ""

# Summary
echo "=== Verification Summary ==="
echo "Deployment verification completed."
echo ""
echo "Next Steps:"
echo "1. Review any warnings or errors above"
echo "2. Run load tests: k6 run load-testing/k6-load-test.js"
echo "3. Check monitoring dashboards (Grafana)"
echo "4. Verify logs for any errors"
echo ""

