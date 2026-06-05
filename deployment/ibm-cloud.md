# IBM Cloud Deployment Guide

Deploy the Carbon PR Review Agent to IBM Cloud using Cloud Foundry or Kubernetes.

## Prerequisites

- IBM Cloud account
- IBM Cloud CLI installed
- Docker installed (for Kubernetes)
- GitHub token and agent API keys

## Option 1: Cloud Foundry Deployment

### 1. Install Cloud Foundry CLI

```bash
# Install CF CLI
curl -L "https://packages.cloudfoundry.org/stable?release=linux64-binary&source=github" | tar -zx
sudo mv cf /usr/local/bin

# Verify installation
cf version
```

### 2. Create manifest.yml

```yaml
# carbon-pr-review/manifest.yml
applications:
- name: carbon-pr-review
  memory: 512M
  instances: 1
  buildpack: nodejs_buildpack
  command: node src/index.js
  env:
    NODE_ENV: production
  services:
    - carbon-pr-review-secrets
```

### 3. Deploy to Cloud Foundry

```bash
# Login to IBM Cloud
ibmcloud login --sso

# Target Cloud Foundry
ibmcloud target --cf

# Create user-provided service for secrets
ibmcloud cf cups carbon-pr-review-secrets -p '{
  "GITHUB_AI_AGENT_TOKEN": "ghp_xxx",
  "GITHUB_AI_AGENT_CLI": "bob",
  "BOBSHELL_API_KEY": "xxx",
  "GITHUB_AI_AGENT_OWNER": "carbon-design-system",
  "GITHUB_AI_AGENT_REPO": "carbon"
}'

# Push application
cd carbon-pr-review
cf push
```

### 4. View Logs

```bash
# Stream logs
cf logs carbon-pr-review

# View recent logs
cf logs carbon-pr-review --recent
```

### 5. Scale Application

```bash
# Scale instances
cf scale carbon-pr-review -i 2

# Scale memory
cf scale carbon-pr-review -m 1G
```

## Option 2: Kubernetes Deployment

### 1. Install IBM Cloud Kubernetes CLI

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install IBM Cloud Kubernetes plugin
ibmcloud plugin install kubernetes-service
```

### 2. Create Kubernetes Cluster

```bash
# Login to IBM Cloud
ibmcloud login --sso

# Create cluster (or use existing)
ibmcloud ks cluster create classic \
  --name carbon-pr-review-cluster \
  --zone dal10 \
  --flavor b3c.4x16 \
  --workers 2

# Wait for cluster to be ready
ibmcloud ks cluster get --cluster carbon-pr-review-cluster

# Configure kubectl
ibmcloud ks cluster config --cluster carbon-pr-review-cluster
```

### 3. Create Kubernetes Secret

```bash
# Create secret from .env file
kubectl create secret generic carbon-pr-review-secrets \
  --from-literal=GITHUB_AI_AGENT_TOKEN=ghp_xxx \
  --from-literal=GITHUB_AI_AGENT_CLI=bob \
  --from-literal=BOBSHELL_API_KEY=xxx \
  --from-literal=GITHUB_AI_AGENT_OWNER=carbon-design-system \
  --from-literal=GITHUB_AI_AGENT_REPO=carbon
```

### 4. Create Kubernetes Deployment

Create `deployment/kubernetes.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbon-pr-review
  labels:
    app: carbon-pr-review
spec:
  replicas: 1
  selector:
    matchLabels:
      app: carbon-pr-review
  template:
    metadata:
      labels:
        app: carbon-pr-review
    spec:
      containers:
      - name: carbon-pr-review
        image: carbon-pr-review:latest
        imagePullPolicy: IfNotPresent
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: carbon-pr-review-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        volumeMounts:
        - name: tmp
          mountPath: /tmp/pr-reviews
      volumes:
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: carbon-pr-review
spec:
  selector:
    app: carbon-pr-review
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### 5. Build and Push Docker Image

```bash
# Build image
docker build -t carbon-pr-review:latest .

# Tag for IBM Cloud Container Registry
docker tag carbon-pr-review:latest \
  us.icr.io/<namespace>/carbon-pr-review:latest

# Login to IBM Cloud Container Registry
ibmcloud cr login

# Push image
docker push us.icr.io/<namespace>/carbon-pr-review:latest
```

### 6. Deploy to Kubernetes

```bash
# Apply deployment
kubectl apply -f deployment/kubernetes.yml

# Check deployment status
kubectl get deployments
kubectl get pods

# View logs
kubectl logs -f deployment/carbon-pr-review
```

### 7. Create CronJob for Scheduled Reviews

Create `deployment/cronjob.yml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: carbon-pr-review-cron
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: carbon-pr-review
            image: us.icr.io/<namespace>/carbon-pr-review:latest
            envFrom:
            - secretRef:
                name: carbon-pr-review-secrets
          restartPolicy: OnFailure
```

Deploy CronJob:

```bash
kubectl apply -f deployment/cronjob.yml
kubectl get cronjobs
```

## Option 3: IBM Code Engine

### 1. Install Code Engine CLI

```bash
# Install plugin
ibmcloud plugin install code-engine

# Login
ibmcloud login --sso

# Target resource group
ibmcloud target -g Default
```

### 2. Create Code Engine Project

```bash
# Create project
ibmcloud ce project create --name carbon-pr-review

# Select project
ibmcloud ce project select --name carbon-pr-review
```

### 3. Create Secrets

```bash
# Create secret
ibmcloud ce secret create --name carbon-pr-review-secrets \
  --from-literal GITHUB_AI_AGENT_TOKEN=ghp_xxx \
  --from-literal GITHUB_AI_AGENT_CLI=bob \
  --from-literal BOBSHELL_API_KEY=xxx
```

### 4. Deploy Application

```bash
# Build and deploy from source
ibmcloud ce app create --name carbon-pr-review \
  --build-source . \
  --env-from-secret carbon-pr-review-secrets \
  --cpu 0.5 \
  --memory 1G \
  --min-scale 0 \
  --max-scale 1

# Or deploy from container image
ibmcloud ce app create --name carbon-pr-review \
  --image us.icr.io/<namespace>/carbon-pr-review:latest \
  --env-from-secret carbon-pr-review-secrets
```

### 5. Create Scheduled Job

```bash
# Create job that runs every 6 hours
ibmcloud ce job create --name carbon-pr-review-job \
  --image us.icr.io/<namespace>/carbon-pr-review:latest \
  --env-from-secret carbon-pr-review-secrets \
  --cpu 0.5 \
  --memory 1G

# Create subscription to run job on schedule
ibmcloud ce subscription cron create --name carbon-pr-review-schedule \
  --destination carbon-pr-review-job \
  --schedule "0 */6 * * *"
```

## Monitoring and Logging

### Cloud Foundry Logs

```bash
# Stream logs
cf logs carbon-pr-review

# View recent logs
cf logs carbon-pr-review --recent
```

### Kubernetes Logs

```bash
# View pod logs
kubectl logs -f deployment/carbon-pr-review

# View logs from all pods
kubectl logs -l app=carbon-pr-review --all-containers=true

# View previous pod logs
kubectl logs deployment/carbon-pr-review --previous
```

### IBM Log Analysis

```bash
# Create Log Analysis instance
ibmcloud resource service-instance-create carbon-pr-review-logs \
  logdna standard us-south

# Bind to application
ibmcloud ks cluster addon enable logdna \
  --cluster carbon-pr-review-cluster \
  --instance carbon-pr-review-logs
```

## Scaling

### Cloud Foundry

```bash
# Manual scaling
cf scale carbon-pr-review -i 2

# Auto-scaling
cf create-autoscaling-rule carbon-pr-review \
  --metric-type cpu \
  --threshold 80 \
  --min-instances 1 \
  --max-instances 3
```

### Kubernetes

```bash
# Manual scaling
kubectl scale deployment carbon-pr-review --replicas=2

# Horizontal Pod Autoscaler
kubectl autoscale deployment carbon-pr-review \
  --cpu-percent=80 \
  --min=1 \
  --max=3
```

## Troubleshooting

### Check Application Status

```bash
# Cloud Foundry
cf app carbon-pr-review

# Kubernetes
kubectl get pods
kubectl describe pod <pod-name>

# Code Engine
ibmcloud ce app get --name carbon-pr-review
```

### View Environment Variables

```bash
# Cloud Foundry
cf env carbon-pr-review

# Kubernetes
kubectl exec -it deployment/carbon-pr-review -- env

# Code Engine
ibmcloud ce app get --name carbon-pr-review --output json
```

### Restart Application

```bash
# Cloud Foundry
cf restart carbon-pr-review

# Kubernetes
kubectl rollout restart deployment/carbon-pr-review

# Code Engine
ibmcloud ce app update --name carbon-pr-review
```

## Security Best Practices

1. **Use Secrets Management**
   - Store credentials in IBM Secrets Manager
   - Never commit secrets to Git
   - Rotate keys regularly

2. **Network Security**
   - Use private endpoints
   - Enable TLS/SSL
   - Restrict network access

3. **Access Control**
   - Use IAM policies
   - Limit service account permissions
   - Enable audit logging

4. **Container Security**
   - Scan images for vulnerabilities
   - Use minimal base images
   - Run as non-root user

## Cost Optimization

1. **Right-size Resources**
   - Start with minimal resources
   - Monitor usage and adjust
   - Use auto-scaling

2. **Use Scheduled Jobs**
   - Run on schedule instead of continuously
   - Scale to zero when not needed
   - Use Code Engine for event-driven workloads

3. **Optimize Container Images**
   - Use multi-stage builds
   - Minimize image size
   - Cache dependencies

## Support

For IBM Cloud support:
- Documentation: https://cloud.ibm.com/docs
- Support: https://cloud.ibm.com/unifiedsupport
- Community: https://community.ibm.com/community/user/cloud