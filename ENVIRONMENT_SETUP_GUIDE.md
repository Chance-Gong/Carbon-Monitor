# Environment Variables Setup Guide

## Do I Need to Set Environment Variables?

**Short Answer:** It depends on your deployment method.

## Scenarios

### 1. Running Locally (Development/Testing)

**YES - You need to set environment variables**

Create a `.env` file:
```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

Required variables:
```bash
# API Server
API_SECRET=your-secure-secret-here
API_ENABLE_AUTH=true
API_PORT=3000

# GitHub
GITHUB_AI_AGENT_TOKEN=ghp_your_token_here
GITHUB_AI_AGENT_CLI=bob

# Bob API Key
BOBSHELL_API_KEY=your_bob_key_here

# Carbon MCP (optional, can be refreshed via API)
CARBON_MCP_TOKEN=your_carbon_token_here
```

Then run:
```bash
# Start API server
npm run api

# Or run PR review agent
npm start
```

### 2. IBM Cloud Code Engine

**NO - Environment variables are managed via secrets**

Instead of setting env vars locally, you create them in IBM Cloud:

```bash
# Create secret with all variables
ibmcloud ce secret create \
  --name carbon-pr-review-secrets \
  --from-literal API_SECRET="$(openssl rand -base64 32)" \
  --from-literal API_ENABLE_AUTH=true \
  --from-literal GITHUB_AI_AGENT_TOKEN="ghp_xxx" \
  --from-literal BOBSHELL_API_KEY="your_key" \
  --from-literal CARBON_MCP_TOKEN="your_token"

# Application automatically gets these from the secret
ibmcloud ce application create \
  --name carbon-pr-review-api \
  --image your-image \
  --env-from-secret carbon-pr-review-secrets
```

**The application reads environment variables from the secret automatically.**

### 3. Kubernetes (kubectl)

**NO - Environment variables are managed via Kubernetes secrets**

Create a secret manifest:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: carbon-pr-review-secrets
type: Opaque
stringData:
  API_SECRET: "your-secret"
  API_ENABLE_AUTH: "true"
  GITHUB_AI_AGENT_TOKEN: "ghp_xxx"
  BOBSHELL_API_KEY: "your_key"
  CARBON_MCP_TOKEN: "your_token"
```

Apply it:
```bash
kubectl apply -f secret.yaml
```

**The deployment references the secret, no manual env var setting needed.**

### 4. Docker

**OPTION A: Pass via command line**
```bash
docker run -d \
  -e API_SECRET="your-secret" \
  -e API_ENABLE_AUTH=true \
  -e GITHUB_AI_AGENT_TOKEN="ghp_xxx" \
  -e BOBSHELL_API_KEY="your_key" \
  carbon-pr-review-api
```

**OPTION B: Use .env file**
```bash
# Create .env file
cat > .env << EOF
API_SECRET=your-secret
API_ENABLE_AUTH=true
GITHUB_AI_AGENT_TOKEN=ghp_xxx
BOBSHELL_API_KEY=your_key
EOF

# Run with env file
docker run -d --env-file .env carbon-pr-review-api
```

### 5. Docker Compose

**NO - Environment variables are in docker-compose.yml**

```yaml
version: '3.8'
services:
  api:
    image: carbon-pr-review-api
    environment:
      API_SECRET: "your-secret"
      API_ENABLE_AUTH: "true"
      GITHUB_AI_AGENT_TOKEN: "ghp_xxx"
      BOBSHELL_API_KEY: "your_key"
    # Or use env_file
    env_file:
      - .env
```

## Summary Table

| Deployment Method | Need to Set Env Vars? | How? |
|-------------------|------------------------|------|
| **Local Development** | ✅ YES | Create `.env` file |
| **IBM Cloud Code Engine** | ❌ NO | Use `ibmcloud ce secret create` |
| **Kubernetes** | ❌ NO | Use Kubernetes Secret manifest |
| **Docker (CLI)** | ✅ YES | Pass with `-e` or `--env-file` |
| **Docker Compose** | ❌ NO | Define in `docker-compose.yml` |

## For IBM Cloud Code Engine Specifically

**You do NOT need to manually set environment variables.** Instead:

1. **Create secrets in IBM Cloud:**
   ```bash
   ibmcloud ce secret create --name carbon-pr-review-secrets \
     --from-literal API_SECRET="xxx" \
     --from-literal GITHUB_AI_AGENT_TOKEN="xxx" \
     --from-literal BOBSHELL_API_KEY="xxx"
   ```

2. **Application automatically reads from secret:**
   ```bash
   ibmcloud ce application create \
     --name carbon-pr-review-api \
     --env-from-secret carbon-pr-review-secrets
   ```

3. **Update secrets when needed:**
   ```bash
   ibmcloud ce secret update --name carbon-pr-review-secrets \
     --from-literal CARBON_MCP_TOKEN="new-token"
   ```

## What About Token Refresh?

**The whole point of the token refresh API is that you DON'T need to manually update environment variables!**

### Without Token Refresh API:
```bash
# Old way - manual update required
ibmcloud ce secret update --name carbon-pr-review-secrets \
  --from-literal CARBON_MCP_TOKEN="new-token"

ibmcloud ce application update --name carbon-pr-review-api --force
```

### With Token Refresh API:
```bash
# New way - just call the API
curl -X POST https://your-app.appdomain.cloud/api/mcp/refresh \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"token": "new-token"}'
```

**The API updates Bob's MCP configuration internally, no secret update needed!**

## Quick Start for IBM Cloud Code Engine

```bash
# 1. Create project
ibmcloud ce project create --name carbon-pr-review

# 2. Create secrets (one-time setup)
ibmcloud ce secret create --name carbon-pr-review-secrets \
  --from-literal API_SECRET="$(openssl rand -base64 32)" \
  --from-literal API_ENABLE_AUTH=true \
  --from-literal GITHUB_AI_AGENT_TOKEN="ghp_your_token" \
  --from-literal BOBSHELL_API_KEY="your_bob_key" \
  --from-literal CARBON_MCP_TOKEN="initial_carbon_token"

# 3. Deploy application
ibmcloud ce application create \
  --name carbon-pr-review-api \
  --image us.icr.io/carbon-pr-review/api:latest \
  --port 3000 \
  --env-from-secret carbon-pr-review-secrets

# 4. Get API URL
API_URL=$(ibmcloud ce application get --name carbon-pr-review-api --output url)

# 5. Refresh token via API (no env var update needed!)
curl -X POST $API_URL/api/mcp/refresh \
  -H "Authorization: Bearer $API_SECRET" \
  -d '{"token": "new-token"}'
```

## Common Questions

### Q: Do I need to set CARBON_MCP_TOKEN in the secret?

**A:** It's optional. You can:
- Set it initially in the secret, OR
- Set it later via the token refresh API

### Q: What if I update the secret, does the app restart?

**A:** No, you need to force restart:
```bash
ibmcloud ce application update --name carbon-pr-review-api --force
```

### Q: Can I use the token refresh API to update other secrets?

**A:** No, the API only updates Bob's MCP configuration file (`~/.bob/mcp/servers.json`), not the Kubernetes/Code Engine secrets. For other secrets, use `ibmcloud ce secret update` or `kubectl patch secret`.

### Q: Where does the token actually get stored?

**A:** In Bob's MCP configuration file inside the container:
```
~/.bob/mcp/servers.json
```

The API updates this file, which persists across API calls but not across container restarts (unless you use persistent storage).

## Recommended Approach for Production

1. **Initial Setup:** Use IBM Cloud secrets for all credentials
2. **Token Refresh:** Use the API endpoint (no secret updates needed)
3. **Secret Rotation:** For API_SECRET and other credentials, update secrets and restart

```bash
# Initial setup (one-time)
ibmcloud ce secret create --name carbon-pr-review-secrets \
  --from-literal API_SECRET="xxx" \
  --from-literal GITHUB_AI_AGENT_TOKEN="xxx" \
  --from-literal BOBSHELL_API_KEY="xxx"

# Regular token refresh (via API)
curl -X POST $API_URL/api/mcp/refresh \
  -H "Authorization: Bearer $API_SECRET" \
  -d '{"token": "new-token"}'

# Quarterly secret rotation (manual)
ibmcloud ce secret update --name carbon-pr-review-secrets \
  --from-literal API_SECRET="new-secret"
ibmcloud ce application update --name carbon-pr-review-api --force
```

## Need Help?

- **Local Development:** See [`.env.example`](.env.example)
- **IBM Cloud Code Engine:** See [`deployment/ibm-code-engine-token-refresh.md`](deployment/ibm-code-engine-token-refresh.md)
- **Kubernetes:** See [`deployment/kubectl-token-refresh-guide.md`](deployment/kubectl-token-refresh-guide.md)
- **API Reference:** See [`docs/TOKEN_REFRESH_API.md`](docs/TOKEN_REFRESH_API.md)