# Carbon MCP Token Refresh System

## Overview

This document provides a quick reference for the Carbon MCP token refresh mechanism. For detailed documentation, see [`docs/TOKEN_REFRESH_API.md`](docs/TOKEN_REFRESH_API.md).

## What Problem Does This Solve?

When the Carbon PR Review Agent runs in cloud environments (IBM Cloud, Kubernetes, etc.), the Carbon MCP token used by Bob CLI needs to be refreshed periodically. This system provides an API endpoint to update the token without redeploying the application.

## Quick Start

### 1. Start the API Server

```bash
# Configure environment
export API_SECRET="your-secure-secret"
export API_ENABLE_AUTH=true
export API_PORT=3000

# Start server
npm run api
```

### 2. Refresh Token

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/mcp/refresh \
  -H "Authorization: Bearer your-secure-secret" \
  -H "Content-Type: application/json" \
  -d '{"token": "new-carbon-mcp-token"}'
```

**Using the provided script:**
```bash
./examples/refresh-token.sh \
  --secret "your-secure-secret" \
  --token "new-carbon-mcp-token"
```

**Using Node.js:**
```javascript
const { refreshCarbonMcpToken } = require('./examples/refresh-token-example');

await refreshCarbonMcpToken({
  apiUrl: 'http://localhost:3000',
  apiSecret: 'your-secure-secret',
  token: 'new-carbon-mcp-token'
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloud Environment                                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Carbon PR Review Agent                        │    │
│  │                                                 │    │
│  │  ┌──────────────┐      ┌──────────────┐       │    │
│  │  │  API Server  │◄─────│Token Manager │       │    │
│  │  │  :3000       │      │              │       │    │
│  │  └──────────────┘      └──────┬───────┘       │    │
│  │                               │                │    │
│  │                               ▼                │    │
│  │                     ┌──────────────────┐       │    │
│  │                     │ Bob MCP Config   │       │    │
│  │                     │ ~/.bob/mcp/      │       │    │
│  │                     └──────────────────┘       │    │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                       ▲
                       │ POST /api/mcp/refresh
                       │
              ┌────────┴────────┐
              │  Admin/CI/CD    │
              └─────────────────┘
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/config` | GET | Yes | Get configuration |
| `/api/mcp/status` | GET | Yes | Get MCP status |
| `/api/mcp/refresh` | POST | Yes | Refresh token |
| `/api/review/trigger` | POST | Yes | Trigger review |

## Files Created

### Core Implementation
- [`src/api/server.js`](src/api/server.js) - API server with endpoints
- [`src/api/tokenManager.js`](src/api/tokenManager.js) - Token management utilities

### Configuration
- [`.env.example`](.env.example) - Updated with API configuration
- [`package.json`](package.json) - Added `npm run api` script

### Documentation
- [`docs/TOKEN_REFRESH_API.md`](docs/TOKEN_REFRESH_API.md) - Complete API documentation
- [`README_TOKEN_REFRESH.md`](README_TOKEN_REFRESH.md) - This file

### Examples
- [`examples/refresh-token.sh`](examples/refresh-token.sh) - Bash script for token refresh
- [`examples/refresh-token-example.js`](examples/refresh-token-example.js) - Node.js example

## Environment Variables

```bash
# API Server Configuration
API_PORT=3000                    # API server port
API_SECRET=your-secret-here      # Authentication secret
API_ENABLE_AUTH=true             # Enable/disable auth

# Carbon MCP Configuration
CARBON_MCP_TOKEN=your-token      # Carbon MCP token
CARBON_API_KEY=your-key          # Carbon API key (if different)
```

## Security Features

1. **Bearer Token Authentication** - All endpoints (except health) require authentication
2. **HTTPS Support** - Use reverse proxy (nginx, cloud LB) for HTTPS in production
3. **Secret Rotation** - Easy to rotate API secrets via environment variables
4. **Audit Logging** - All requests are logged with timestamps
5. **CORS Support** - Configurable cross-origin access

## Deployment Examples

### Docker

```bash
docker run -d \
  -p 3000:3000 \
  -e API_SECRET="your-secret" \
  -e API_ENABLE_AUTH=true \
  carbon-pr-review-api
```

### Kubernetes

```yaml
apiVersion: v1
kind: Service
metadata:
  name: carbon-pr-review-api
spec:
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

### IBM Cloud Code Engine

```bash
ibmcloud ce app create \
  --name carbon-pr-review-api \
  --image carbon-pr-review-api:latest \
  --port 3000 \
  --env API_ENABLE_AUTH=true \
  --env-from-secret carbon-secrets
```

## Automation

### Cron Job (Monthly Refresh)

```bash
# Add to crontab
0 0 1 * * /path/to/refresh-token.sh --secret "$API_SECRET" --token "$NEW_TOKEN"
```

### GitHub Actions

```yaml
name: Refresh Carbon MCP Token
on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Token
        run: |
          curl -X POST ${{ secrets.API_URL }}/api/mcp/refresh \
            -H "Authorization: Bearer ${{ secrets.API_SECRET }}" \
            -d '{"token": "${{ secrets.CARBON_MCP_TOKEN }}"}'
```

## Testing

### Test API Server Locally

```bash
# Terminal 1: Start API server
npm run api

# Terminal 2: Test endpoints
curl http://localhost:3000/api/health

curl -H "Authorization: Bearer your-secret" \
  http://localhost:3000/api/mcp/status

curl -X POST http://localhost:3000/api/mcp/refresh \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"token": "test-token"}'
```

## Troubleshooting

### API Server Won't Start

```bash
# Check if port is in use
lsof -i :3000

# Check environment variables
env | grep API_
```

### Authentication Fails

```bash
# Verify API secret
echo $API_SECRET

# Test without auth (dev only)
export API_ENABLE_AUTH=false
npm run api
```

### Token Refresh Fails

```bash
# Check Bob availability
bob --version

# Check carbon-mcp availability
npx -y carbon-mcp --version

# Check Bob MCP config
cat ~/.bob/mcp/servers.json
```

## Next Steps

1. **Deploy API Server** - Choose deployment platform (Docker, Kubernetes, IBM Cloud)
2. **Configure Secrets** - Set up API_SECRET and other credentials
3. **Set Up Automation** - Configure scheduled token refresh (cron, GitHub Actions)
4. **Enable Monitoring** - Set up logging and alerting for API endpoints
5. **Test Token Refresh** - Verify token refresh works end-to-end

## Support

- **Full Documentation**: [`docs/TOKEN_REFRESH_API.md`](docs/TOKEN_REFRESH_API.md)
- **Carbon Setup**: [`CARBON_SETUP.md`](CARBON_SETUP.md)
- **Deployment Guide**: [`deployment/README.md`](deployment/README.md)
- **Main README**: [`README.md`](README.md)

## Made with Bob