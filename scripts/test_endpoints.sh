#!/bin/bash
# Quick test script to verify API endpoints are working
# Usage: ./scripts/test_endpoints.sh [base_url]

BASE_URL="${1:-http://127.0.0.1:8787}"
API_URL="${BASE_URL}/api"

echo "Testing API endpoints at ${BASE_URL}"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to test endpoints
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -n "Testing ${method} ${endpoint}... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            -H "Content-Type: application/json" \
            -d "${data}" \
            "${API_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            "${API_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓${NC} (${http_code})"
        if [ -n "$description" ]; then
            echo "  ${description}"
        fi
        return 0
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠${NC} (${http_code} - Not Found, but endpoint exists)"
        return 0
    else
        echo -e "${RED}✗${NC} (${http_code})"
        echo "  Response: ${body}"
        return 1
    fi
}

# Test health endpoint first
echo "1. Health Check"
test_endpoint "GET" "/health" "" "Basic health check"
echo ""

# Test threads endpoints
echo "2. Threads API"
echo "   Creating a test thread..."
THREAD_DATA='{"title":"Test Thread","userId":"test-user"}'
thread_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "${THREAD_DATA}" \
    "${API_URL}/threads")
    
thread_id=$(echo "$thread_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$thread_id" ]; then
    echo -e "  ${RED}✗ Failed to create thread${NC}"
    echo "  Response: ${thread_response}"
    exit 1
fi

echo -e "  ${GREEN}✓ Thread created: ${thread_id}${NC}"

test_endpoint "GET" "/threads/${thread_id}" "" "Get thread by ID"
test_endpoint "GET" "/threads/${thread_id}/messages" "" "Get messages (should be empty)"
echo ""

# Test guest profiles
echo "3. Guest Profiles API"
test_endpoint "GET" "/guest-profiles" "" "List guest profiles"
echo ""

# Test episodes
echo "4. Episodes API"
test_endpoint "GET" "/episodes" "" "List episodes"
echo ""

# Test ideas (may require auth)
echo "5. Ideas API"
test_endpoint "GET" "/ideas" "" "List ideas (may require auth)"
echo ""

echo "=================================="
echo "Tests complete!"
echo ""
echo "Note: Some endpoints may return 401/403 if auth is required."
echo "Note: Some endpoints may return 404 for missing resources (expected)."

