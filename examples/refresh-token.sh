#!/bin/bash
#
# Carbon MCP Token Refresh Script
# 
# This script refreshes the Carbon MCP token via the API endpoint.
# Use this for automated token rotation in production environments.
#

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_SECRET="${API_SECRET:-}"
CARBON_MCP_TOKEN="${CARBON_MCP_TOKEN:-}"
AGENT="${AGENT:-bob}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Refresh Carbon MCP token via API endpoint.

Options:
    -u, --url URL           API server URL (default: http://localhost:3000)
    -s, --secret SECRET     API authentication secret
    -t, --token TOKEN       New Carbon MCP token
    -a, --agent AGENT       Agent type: bob, claude, codex (default: bob)
    -r, --repos REPOS       Comma-separated repository paths
    -h, --help              Show this help message

Environment Variables:
    API_URL                 API server URL
    API_SECRET              API authentication secret
    CARBON_MCP_TOKEN        New Carbon MCP token
    AGENT                   Agent type

Examples:
    # Basic usage
    $0 --secret "my-secret" --token "new-token"

    # With custom URL and repos
    $0 --url "https://api.example.com" \\
       --secret "my-secret" \\
       --token "new-token" \\
       --repos "/path/to/carbon,/path/to/carbon-charts"

    # Using environment variables
    export API_URL="https://api.example.com"
    export API_SECRET="my-secret"
    export CARBON_MCP_TOKEN="new-token"
    $0

EOF
    exit 1
}

# Parse arguments
REPOS=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -s|--secret)
            API_SECRET="$2"
            shift 2
            ;;
        -t|--token)
            CARBON_MCP_TOKEN="$2"
            shift 2
            ;;
        -a|--agent)
            AGENT="$2"
            shift 2
            ;;
        -r|--repos)
            REPOS="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$API_SECRET" ]; then
    echo -e "${RED}Error: API secret is required${NC}"
    echo "Set API_SECRET environment variable or use --secret option"
    exit 1
fi

if [ -z "$CARBON_MCP_TOKEN" ]; then
    echo -e "${RED}Error: Carbon MCP token is required${NC}"
    echo "Set CARBON_MCP_TOKEN environment variable or use --token option"
    exit 1
fi

# Build JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "agent": "$AGENT",
  "token": "$CARBON_MCP_TOKEN"
EOF
)

# Add repos if provided
if [ -n "$REPOS" ]; then
    # Convert comma-separated string to JSON array
    IFS=',' read -ra REPO_ARRAY <<< "$REPOS"
    REPOS_JSON="["
    for i in "${!REPO_ARRAY[@]}"; do
        if [ $i -gt 0 ]; then
            REPOS_JSON+=","
        fi
        REPOS_JSON+="\"${REPO_ARRAY[$i]}\""
    done
    REPOS_JSON+="]"
    
    JSON_PAYLOAD+=",
  \"repos\": $REPOS_JSON"
fi

JSON_PAYLOAD+="
}"

# Print configuration
echo -e "${YELLOW}Carbon MCP Token Refresh${NC}"
echo "========================"
echo "API URL: $API_URL"
echo "Agent: $AGENT"
if [ -n "$REPOS" ]; then
    echo "Repos: $REPOS"
fi
echo ""

# Make API request
echo -e "${YELLOW}Sending refresh request...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/mcp/refresh" \
    -H "Authorization: Bearer $API_SECRET" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

# Extract HTTP status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Token refreshed successfully${NC}"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 0
else
    echo -e "${RED}✗ Token refresh failed (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

# Made with Bob
