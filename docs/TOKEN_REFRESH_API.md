# Carbon MCP Token Refresh API

## Overview

The Carbon PR Review Agent includes an API server for managing Carbon MCP token configuration. This is essential for cloud deployments where the Carbon MCP token needs to be refreshed periodically.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud Environment (IBM Cloud, Kubernetes, etc.)            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Carbon PR Review Agent                            │    │
│  │                                                     │    │
│  │  ┌──────────────┐         ┌──────────────┐        │    │
│  │  │  API Server  │◄────────│ Token Manager│        │    │
│  │  │  (port 3000) │         │              │        │    │
│  │  └──────┬───────┘         └──────┬───────┘        │    │
│  │         │                        │                 │    │
│  │         │                        ▼                 │    │
│  │         │              ┌──────────────────┐        │    │
│  │         │              │ Bob MCP Config   │        │    │
│  │         │              │ ~/.bob/mcp/      │        │    │
│  │         │              │ servers.json     │        │    │
│  │         │              └──────────────────┘        │    │
│  │         │                                          │    │
│  │         ▼                                          │    │
│  │  ┌──────────────┐                                 │    │
│  │  │ Review Agent │                                 │    │
│  │  │ (src/index)  │                                 │    │
│  │  └──────────────┘                                 │    │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       ▲
                       │ HTTPS POST /api/mcp/refresh
                       │
              ┌────────┴────────┐
              │  Admin/CI/CD    │
              │  Token Refresh  │
              └─────────────────┘
```

## Quick Start

### 1. Start the API Server

```bash
# Set required environment variables
export API_SECRET="your-secure-secret-here"
export API_ENABLE_AUTH=true
export API_PORT=3000

# Start the API server
npm run api
```

### 2. Refresh Carbon MCP Token

```bash
curl -X POST http://localhost:3000/api/mcp/refresh \
  -H "Authorization: Bearer your-secure-secret-here" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "bob",
    "token": "your-new-carbon-mcp-token",
    "repos": ["/path/to/carbon-repo"]
  }'
```

## API Endpoints

### Health Check

**GET** `/api/health`

Check if the API server is running.

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "service": "carbon-pr-review-agent",
  "version": "1.0.0",
  "timestamp": "2026-06-10T17:00:00.000Z",
  "uptime": 3600
}
```

### Get Configuration

**GET** `/api/config`

Get current agent configuration (sanitized, no secrets).

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "config": {
    "agent": "bob",
    "owner": "carbon-design-system",
    "repo": "carbon",
    "label": "AIReviewed",
    "maxPRs": 5,
    "daysBack": 21,
    "postInlineComments": true,
    "postSummaryComment": true
  },
  "timestamp": "2026-06-10T17:00:00.000Z"
}
```

### Get MCP Status

**GET** `/api/mcp/status`

Get current Carbon MCP configuration status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "bobAvailable": true,
  "carbonMcpAvailable": true,
  "configured": true,
  "configPath": "/Users/username/.bob/mcp/servers.json",
  "servers": [
    {
      "name": "carbon-mcp",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "carbon-mcp", "--repos", "/path/to/carbon"],
      "env": {
        "CARBON_MCP_TOKEN": "***",
        "CARBON_API_KEY": "***"
      }
    }
  ],
  "timestamp": "2026-06-10T17:00:00.000Z"
}
```

### Refresh MCP Token

**POST** `/api/mcp/refresh`

Refresh the Carbon MCP token configuration.

**Authentication:** Required

**Request Body:**
```json
{
  "agent": "bob",
  "token": "your-new-carbon-mcp-token",
  "repos": ["/path/to/carbon-repo"]
}
```

**Parameters:**
- `agent` (string, optional): Agent type - "bob", "claude", or "codex". Default: "bob"
- `token` (string, required): New Carbon MCP token/API key
- `repos` (array, optional): Array of repository paths for carbon-mcp to index

**Response:**
```json
{
  "success": true,
  "message": "Carbon MCP token refreshed successfully",
  "agent": "bob",
  "configPath": "/Users/username/.bob/mcp/servers.json",
  "serverName": "carbon-mcp",
  "updated": true,
  "timestamp": "2026-06-10T17:00:00.000Z"
}
```

### Trigger Manual Review

**POST** `/api/review/trigger`

Manually trigger a PR review run.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Review triggered, running in background",
  "timestamp": "2026-06-10T17:00:00.000Z"
}
```

## Authentication

### Enable Authentication

Set the `API_ENABLE_AUTH` environment variable:

```bash
export API_ENABLE_AUTH=true
export API_SECRET="your-secure-secret-here"
```

### Disable Authentication (Development Only)

```bash
export API_ENABLE_AUTH=false
```

**⚠️ Warning:** Never disable authentication in production!

### Using Bearer Token

Include the API secret in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/api/mcp/refresh \
  -H "Authorization: Bearer your-secure-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"token": "new-token"}'
```

## Deployment

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Expose API port
EXPOSE 3000

# Start API server
CMD ["npm", "run", "api"]
```

```bash
# Build and run
docker build -t carbon-pr-review-api .
docker run -d \
  -p 3000:3000 \
  -e API_SECRET="your-secret" \
  -e API_ENABLE_AUTH=true \
  -e GITHUB_AI_AGENT_TOKEN="ghp_xxx" \
  carbon-pr-review-api
```

### Kubernetes

```yaml
apiVersion: v1
kind: Service
metadata:
  name: carbon-pr-review-api
  namespace: carbon-pr-review
spec:
  selector:
    app: carbon-pr-review-api
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbon-pr-review-api
  namespace: carbon-pr-review
spec:
  replicas: 1
  selector:
    matchLabels:
      app: carbon-pr-review-api
  template:
    metadata:
      labels:
        app: carbon-pr-review-api
    spec:
      containers:
      - name: api
        image: carbon-pr-review-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: API_PORT
          value: "3000"
        - name: API_ENABLE_AUTH
          value: "true"
        - name: API_SECRET
          valueFrom:
            secretKeyRef:
              name: carbon-pr-review-secrets
              key: api-secret
        - name: GITHUB_AI_AGENT_TOKEN
          valueFrom:
            secretKeyRef:
              name: carbon-pr-review-secrets
              key: github-token
```

### IBM Cloud Code Engine

```bash
# Create application
ibmcloud ce app create \
  --name carbon-pr-review-api \
  --image carbon-pr-review-api:latest \
  --port 3000 \
  --env API_ENABLE_AUTH=true \
  --env-from-secret carbon-pr-review-secrets

# Update token via API
curl -X POST https://carbon-pr-review-api.xxx.appdomain.cloud/api/mcp/refresh \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"token": "new-token"}'
```

## Security Best Practices

### 1. Use Strong API Secrets

```bash
# Generate a secure random secret
openssl rand -base64 32
```

### 2. Use HTTPS in Production

Always use HTTPS for API endpoints in production. Use a reverse proxy like nginx or a cloud load balancer.

### 3. Rotate Secrets Regularly

```bash
# Rotate API secret every 90 days
export NEW_API_SECRET=$(openssl rand -base64 32)

# Update in Kubernetes
kubectl create secret generic carbon-pr-review-secrets \
  --from-literal=api-secret=$NEW_API_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secret
kubectl rollout restart deployment/carbon-pr-review-api -n carbon-pr-review
```

### 4. Limit Network Access

Use firewall rules or security groups to restrict API access:

```bash
# Example: Allow only from specific IP ranges
iptables -A INPUT -p tcp --dport 3000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### 5. Enable Audit Logging

The API server logs all requests. Monitor these logs for suspicious activity:

```bash
# View API logs
kubectl logs -f deployment/carbon-pr-review-api -n carbon-pr-review

# Search for failed auth attempts
kubectl logs deployment/carbon-pr-review-api -n carbon-pr-review | grep "401"
```

## Automation Examples

### Scheduled Token Refresh (Cron)

```bash
#!/bin/bash
# refresh-carbon-token.sh

API_URL="https://carbon-pr-review-api.example.com"
API_SECRET="your-api-secret"
NEW_TOKEN="your-new-carbon-token"

curl -X POST "$API_URL/api/mcp/refresh" \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$NEW_TOKEN\"}" \
  --fail --silent --show-error

if [ $? -eq 0 ]; then
  echo "Token refreshed successfully"
else
  echo "Token refresh failed"
  exit 1
fi
```

```bash
# Add to crontab (refresh every 30 days)
0 0 1 * * /path/to/refresh-carbon-token.sh
```

### GitHub Actions Workflow

```yaml
name: Refresh Carbon MCP Token

on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly
  workflow_dispatch:

jobs:
  refresh-token:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Carbon MCP Token
        run: |
          curl -X POST ${{ secrets.API_URL }}/api/mcp/refresh \
            -H "Authorization: Bearer ${{ secrets.API_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{"token": "${{ secrets.CARBON_MCP_TOKEN }}"}'
```

## Troubleshooting

### API Server Won't Start

**Check port availability:**
```bash
lsof -i :3000
```

**Check environment variables:**
```bash
env | grep API_
```

### Authentication Failures

**Verify API secret:**
```bash
echo $API_SECRET
```

**Test without auth (development only):**
```bash
export API_ENABLE_AUTH=false
npm run api
```

### Token Refresh Fails

**Check Bob availability:**
```bash
bob --version
```

**Check carbon-mcp availability:**
```bash
npx -y carbon-mcp --version
```

**Check Bob MCP config:**
```bash
cat ~/.bob/mcp/servers.json
```

### View API Logs

```bash
# Local
npm run api

# Docker
docker logs carbon-pr-review-api

# Kubernetes
kubectl logs -f deployment/carbon-pr-review-api -n carbon-pr-review
```

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review [Carbon Setup Guide](../CARBON_SETUP.md)
- Open an issue on GitHub

## Made with Bob