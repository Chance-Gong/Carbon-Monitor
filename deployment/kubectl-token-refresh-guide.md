# kubectl Token Refresh Management Guide

## Overview

This guide covers using kubectl to manage the Carbon MCP token refresh system in IBM Cloud Code Engine or any Kubernetes environment.

## Prerequisites

```bash
# Verify kubectl is installed
kubectl version --client

# For IBM Cloud Code Engine, get kubeconfig
ibmcloud ce project select --name carbon-pr-review --kubecfg

# Verify connection
kubectl get pods
```

## Quick Reference Commands

### View Resources

```bash
# List all applications
kubectl get apps

# List all jobs
kubectl get jobs

# List all secrets
kubectl get secrets

# List all pods
kubectl get pods

# View application details
kubectl describe app carbon-pr-review-api

# View logs
kubectl logs -l app=carbon-pr-review-api --tail=50 -f
```

### Token Refresh Operations

#### 1. Update Token via Secret

```bash
# Method 1: Using kubectl patch
kubectl patch secret carbon-pr-review-secrets \
  -p '{"data":{"CARBON_MCP_TOKEN":"'$(echo -n "new-token-value" | base64)'"}}'

# Method 2: Using kubectl create with --dry-run
kubectl create secret generic carbon-pr-review-secrets \
  --from-literal=CARBON_MCP_TOKEN="new-token-value" \
  --dry-run=client -o yaml | kubectl apply -f -

# Method 3: Edit secret directly
kubectl edit secret carbon-pr-review-secrets
# Note: Values must be base64 encoded
```

#### 2. Restart Application to Pick Up New Token

```bash
# Force restart by updating a label
kubectl patch app carbon-pr-review-api \
  -p '{"spec":{"template":{"metadata":{"labels":{"restart":"'$(date +%s)'"}}}}}'

# Or delete pods to force recreation
kubectl delete pods -l app=carbon-pr-review-api

# Or use Code Engine CLI
ibmcloud ce application update --name carbon-pr-review-api --force
```

#### 3. Verify Token Update

```bash
# Get API URL
API_URL=$(kubectl get app carbon-pr-review-api -o jsonpath='{.status.url}')

# Check MCP status
curl -H "Authorization: Bearer $API_SECRET" \
  $API_URL/api/mcp/status | jq .

# Check logs for token refresh
kubectl logs -l app=carbon-pr-review-api --tail=100 | grep -i "token\|mcp"
```

## Complete Token Refresh Workflow

### Script: kubectl-refresh-token.sh

```bash
#!/bin/bash
# kubectl-refresh-token.sh
# Refresh Carbon MCP token using kubectl

set -e

# Configuration
NEW_TOKEN="${1:-}"
SECRET_NAME="carbon-pr-review-secrets"
APP_NAME="carbon-pr-review-api"

if [ -z "$NEW_TOKEN" ]; then
    echo "Usage: $0 <new-token>"
    exit 1
fi

echo "🔄 Refreshing Carbon MCP token..."

# Step 1: Update secret
echo "1️⃣  Updating secret..."
kubectl patch secret $SECRET_NAME \
  -p '{"data":{"CARBON_MCP_TOKEN":"'$(echo -n "$NEW_TOKEN" | base64)'"}}'

# Step 2: Restart application
echo "2️⃣  Restarting application..."
kubectl patch app $APP_NAME \
  -p '{"spec":{"template":{"metadata":{"labels":{"restart":"'$(date +%s)'"}}}}}'

# Step 3: Wait for rollout
echo "3️⃣  Waiting for rollout..."
kubectl wait --for=condition=Ready app/$APP_NAME --timeout=120s

# Step 4: Verify
echo "4️⃣  Verifying token update..."
API_URL=$(kubectl get app $APP_NAME -o jsonpath='{.status.url}')
echo "   API URL: $API_URL"

# Get API secret from secret
API_SECRET=$(kubectl get secret $SECRET_NAME -o jsonpath='{.data.API_SECRET}' | base64 -d)

# Test API
RESPONSE=$(curl -s -H "Authorization: Bearer $API_SECRET" \
  $API_URL/api/mcp/status)

if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Token refresh successful!"
    echo "$RESPONSE" | jq .
else
    echo "❌ Token refresh failed!"
    echo "$RESPONSE"
    exit 1
fi
```

Make it executable:
```bash
chmod +x kubectl-refresh-token.sh
```

Usage:
```bash
./kubectl-refresh-token.sh "your-new-token-here"
```

## Advanced kubectl Operations

### 1. View Secret Values (Decoded)

```bash
# View all secret values
kubectl get secret carbon-pr-review-secrets -o json | \
  jq -r '.data | to_entries[] | "\(.key): \(.value | @base64d)"'

# View specific secret value
kubectl get secret carbon-pr-review-secrets \
  -o jsonpath='{.data.CARBON_MCP_TOKEN}' | base64 -d
```

### 2. Create Secret from File

```bash
# Create .env file
cat > carbon-secrets.env << EOF
API_SECRET=$(openssl rand -base64 32)
CARBON_MCP_TOKEN=your-token-here
GITHUB_AI_AGENT_TOKEN=ghp_xxx
BOBSHELL_API_KEY=your-bob-key
EOF

# Create secret from file
kubectl create secret generic carbon-pr-review-secrets \
  --from-env-file=carbon-secrets.env

# Clean up file
rm carbon-secrets.env
```

### 3. Export and Backup Secrets

```bash
# Export secret to YAML
kubectl get secret carbon-pr-review-secrets -o yaml > secret-backup.yaml

# Restore from backup
kubectl apply -f secret-backup.yaml
```

### 4. Monitor Application Health

```bash
# Watch pod status
kubectl get pods -l app=carbon-pr-review-api -w

# Check application events
kubectl get events --field-selector involvedObject.name=carbon-pr-review-api

# View resource usage
kubectl top pods -l app=carbon-pr-review-api
```

### 5. Scale Application

```bash
# Scale up
kubectl scale app carbon-pr-review-api --replicas=3

# Scale down
kubectl scale app carbon-pr-review-api --replicas=1

# Auto-scale (if HPA is configured)
kubectl autoscale app carbon-pr-review-api \
  --min=1 --max=5 --cpu-percent=80
```

## Kubernetes Manifests

### Complete Deployment Manifest

```yaml
# carbon-pr-review-k8s.yaml
apiVersion: v1
kind: Secret
metadata:
  name: carbon-pr-review-secrets
type: Opaque
stringData:
  API_SECRET: "your-api-secret-here"
  API_ENABLE_AUTH: "true"
  CARBON_MCP_TOKEN: "your-carbon-token-here"
  GITHUB_AI_AGENT_TOKEN: "ghp_xxx"
  BOBSHELL_API_KEY: "your-bob-key"
  GITHUB_AI_AGENT_CLI: "bob"
  GITHUB_AI_AGENT_OWNER: "carbon-design-system"
  GITHUB_AI_AGENT_REPO: "carbon"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbon-pr-review-api
  labels:
    app: carbon-pr-review-api
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
        image: us.icr.io/carbon-pr-review/carbon-pr-review-api:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: API_PORT
          value: "3000"
        envFrom:
        - secretRef:
            name: carbon-pr-review-secrets
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: carbon-pr-review-api
  labels:
    app: carbon-pr-review-api
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: carbon-pr-review-api

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: carbon-pr-review-job
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: review
            image: us.icr.io/carbon-pr-review/carbon-pr-review-api:latest
            command: ["npm", "start"]
            envFrom:
            - secretRef:
                name: carbon-pr-review-secrets
            resources:
              requests:
                cpu: 500m
                memory: 1Gi
              limits:
                cpu: 2000m
                memory: 4Gi
          restartPolicy: OnFailure
```

Apply the manifest:
```bash
kubectl apply -f carbon-pr-review-k8s.yaml
```

## Token Refresh Automation with kubectl

### Option 1: Kubernetes Job for Token Refresh

```yaml
# token-refresh-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: carbon-token-refresh
spec:
  template:
    spec:
      containers:
      - name: refresh
        image: curlimages/curl:latest
        command:
        - sh
        - -c
        - |
          API_URL=$(kubectl get svc carbon-pr-review-api -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          API_SECRET=$(kubectl get secret carbon-pr-review-secrets -o jsonpath='{.data.API_SECRET}' | base64 -d)
          NEW_TOKEN=$(kubectl get secret carbon-pr-review-secrets -o jsonpath='{.data.CARBON_MCP_TOKEN}' | base64 -d)
          
          curl -X POST http://$API_URL/api/mcp/refresh \
            -H "Authorization: Bearer $API_SECRET" \
            -H "Content-Type: application/json" \
            -d "{\"token\": \"$NEW_TOKEN\"}"
      restartPolicy: Never
  backoffLimit: 3
```

Run the job:
```bash
kubectl apply -f token-refresh-job.yaml
kubectl logs job/carbon-token-refresh
```

### Option 2: Kubernetes CronJob for Scheduled Refresh

```yaml
# token-refresh-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: carbon-token-refresh-schedule
spec:
  schedule: "0 0 1 * *"  # Monthly on 1st day
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: carbon-token-refresher
          containers:
          - name: refresh
            image: bitnami/kubectl:latest
            command:
            - sh
            - -c
            - |
              # Get new token from external source or secret
              NEW_TOKEN="your-new-token-here"
              
              # Update secret
              kubectl patch secret carbon-pr-review-secrets \
                -p '{"data":{"CARBON_MCP_TOKEN":"'$(echo -n "$NEW_TOKEN" | base64)'"}}'
              
              # Restart application
              kubectl rollout restart deployment/carbon-pr-review-api
              
              # Wait for rollout
              kubectl rollout status deployment/carbon-pr-review-api
          restartPolicy: OnFailure
```

Create service account with permissions:
```bash
# Create service account
kubectl create serviceaccount carbon-token-refresher

# Create role
kubectl create role carbon-token-refresher \
  --verb=get,patch,update \
  --resource=secrets,deployments

# Bind role
kubectl create rolebinding carbon-token-refresher \
  --role=carbon-token-refresher \
  --serviceaccount=default:carbon-token-refresher
```

## Monitoring and Debugging

### Real-time Log Streaming

```bash
# Stream all API logs
kubectl logs -f -l app=carbon-pr-review-api

# Stream logs from specific pod
POD=$(kubectl get pods -l app=carbon-pr-review-api -o jsonpath='{.items[0].metadata.name}')
kubectl logs -f $POD

# Stream logs with timestamps
kubectl logs -f -l app=carbon-pr-review-api --timestamps

# View previous container logs (if crashed)
kubectl logs -l app=carbon-pr-review-api --previous
```

### Debug Container Issues

```bash
# Execute command in running container
kubectl exec -it $(kubectl get pods -l app=carbon-pr-review-api -o jsonpath='{.items[0].metadata.name}') \
  -- /bin/sh

# Check environment variables
kubectl exec $(kubectl get pods -l app=carbon-pr-review-api -o jsonpath='{.items[0].metadata.name}') \
  -- env | grep -i carbon

# Test Bob CLI in container
kubectl exec $(kubectl get pods -l app=carbon-pr-review-api -o jsonpath='{.items[0].metadata.name}') \
  -- bob --version

# Check MCP configuration
kubectl exec $(kubectl get pods -l app=carbon-pr-review-api -o jsonpath='{.items[0].metadata.name}') \
  -- cat ~/.bob/mcp/servers.json
```

### Port Forwarding for Local Testing

```bash
# Forward API port to localhost
kubectl port-forward svc/carbon-pr-review-api 3000:80

# Test locally
curl http://localhost:3000/api/health
```

## Best Practices

1. **Always backup secrets before updating**
   ```bash
   kubectl get secret carbon-pr-review-secrets -o yaml > secret-backup-$(date +%Y%m%d).yaml
   ```

2. **Use kubectl dry-run to test changes**
   ```bash
   kubectl patch secret carbon-pr-review-secrets \
     -p '{"data":{"CARBON_MCP_TOKEN":"'$(echo -n "new-token" | base64)'"}}' \
     --dry-run=client
   ```

3. **Monitor rollout status**
   ```bash
   kubectl rollout status deployment/carbon-pr-review-api
   ```

4. **Use labels for organization**
   ```bash
   kubectl label secret carbon-pr-review-secrets \
     app=carbon-pr-review \
     component=api
   ```

5. **Set resource limits**
   ```bash
   kubectl set resources deployment carbon-pr-review-api \
     --limits=cpu=1,memory=2Gi \
     --requests=cpu=250m,memory=512Mi
   ```

## Troubleshooting

### Secret Not Updating

```bash
# Verify secret was updated
kubectl get secret carbon-pr-review-secrets -o yaml

# Check if pods picked up new secret
kubectl describe pod -l app=carbon-pr-review-api | grep -A 5 "Environment"

# Force pod recreation
kubectl delete pods -l app=carbon-pr-review-api
```

### Application Not Restarting

```bash
# Check deployment status
kubectl get deployment carbon-pr-review-api

# View deployment events
kubectl describe deployment carbon-pr-review-api

# Check pod events
kubectl get events --field-selector involvedObject.name=carbon-pr-review-api
```

### Permission Issues

```bash
# Check service account
kubectl get serviceaccount

# View role bindings
kubectl get rolebindings

# Describe role
kubectl describe role carbon-token-refresher
```

## Summary

You now have comprehensive kubectl commands for:
- ✅ Viewing and managing secrets
- ✅ Updating Carbon MCP tokens
- ✅ Restarting applications
- ✅ Monitoring and debugging
- ✅ Automating token refresh
- ✅ Managing deployments and jobs

For IBM Cloud Code Engine specific commands, see [`ibm-code-engine-token-refresh.md`](ibm-code-engine-token-refresh.md).