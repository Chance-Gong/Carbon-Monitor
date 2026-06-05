# Deployment Configurations

This directory contains deployment configurations for various platforms.

## Available Deployments

### 1. IBM Cloud (`ibm-cloud.md`)
Complete guide for deploying to IBM Cloud with three options:
- **Cloud Foundry** - Simple PaaS deployment
- **Kubernetes** - Container orchestration
- **Code Engine** - Serverless containers

**Best for:** IBM internal deployments, enterprise environments

### 2. Kubernetes (`kubernetes.yml`)
Production-ready Kubernetes configuration including:
- Namespace isolation
- Secret management
- Deployment with resource limits
- CronJob for scheduled reviews
- Service account with RBAC

**Best for:** Any Kubernetes cluster (IBM Cloud, AWS EKS, Azure AKS, GKE)

### 3. GitHub Actions (`github-actions.yml`)
CI/CD workflow for automated reviews:
- Scheduled runs (every 6 hours)
- Manual trigger support
- Multi-agent support (Bob/Claude/Codex)
- Automatic failure notifications

**Best for:** GitHub-hosted automation, no infrastructure needed

## Quick Start

### Option 1: IBM Cloud (Recommended for IBM)

```bash
# See ibm-cloud.md for detailed instructions
cd carbon-pr-review

# Cloud Foundry
cf push

# Kubernetes
kubectl apply -f deployment/kubernetes.yml

# Code Engine
ibmcloud ce app create --name carbon-pr-review --build-source .
```

### Option 2: Kubernetes (Any Provider)

```bash
# Update secrets in kubernetes.yml
nano deployment/kubernetes.yml

# Apply configuration
kubectl apply -f deployment/kubernetes.yml

# Check status
kubectl get pods -n carbon-pr-review

# View logs
kubectl logs -f deployment/carbon-pr-review -n carbon-pr-review
```

### Option 3: GitHub Actions

```bash
# 1. Copy workflow file
mkdir -p .github/workflows
cp deployment/github-actions.yml .github/workflows/carbon-pr-review.yml

# 2. Add secrets to GitHub repository
# Go to Settings → Secrets and variables → Actions
# Add:
#   - GITHUB_AI_AGENT_TOKEN
#   - GITHUB_AI_AGENT_CLI
#   - BOBSHELL_API_KEY (if using Bob)
#   - ANTHROPIC_API_KEY (if using Claude)

# 3. Commit and push
git add .github/workflows/carbon-pr-review.yml
git commit -m "Add Carbon PR review workflow"
git push
```

### Option 4: Docker Compose (Local/VM)

```bash
cd carbon-pr-review

# Configure environment
cp .env.example .env
nano .env

# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

## Deployment Comparison

| Platform | Setup | Cost | Scaling | Best For |
|----------|-------|------|---------|----------|
| **IBM Cloud Foundry** | Easy | Low | Auto | Quick start |
| **IBM Kubernetes** | Medium | Medium | Manual/Auto | Production |
| **IBM Code Engine** | Easy | Low | Auto | Serverless |
| **GitHub Actions** | Easy | Free* | N/A | CI/CD |
| **Docker Compose** | Easy | VM cost | Manual | Local/VM |

*GitHub Actions: 2,000 minutes/month free for public repos, 3,000 for private

## Configuration

### Required Secrets

All deployments require these secrets:

```bash
GITHUB_AI_AGENT_TOKEN=ghp_xxx        # GitHub personal access token
GITHUB_AI_AGENT_CLI=bob              # bob, claude, or codex
```

### Agent-Specific Secrets

Depending on your chosen agent:

```bash
# For Bob Shell
BOBSHELL_API_KEY=xxx

# For Claude
ANTHROPIC_API_KEY=xxx

# For Codex
OPENAI_API_KEY=xxx
```

### Optional Configuration

```bash
GITHUB_AI_AGENT_OWNER=carbon-design-system
GITHUB_AI_AGENT_REPO=carbon
GITHUB_AI_AGENT_MAX_PRS=5
GITHUB_AI_AGENT_DAYS_BACK=21
GITHUB_AI_AGENT_REVIEW_LABEL=AIReviewed
```

## Scheduling

### Recommended Schedules

- **Development:** Every 12 hours
- **Production:** Every 6 hours
- **High-traffic:** Every 3 hours

### Cron Expressions

```bash
# Every 3 hours
0 */3 * * *

# Every 6 hours
0 */6 * * *

# Every 12 hours
0 */12 * * *

# Daily at 9 AM
0 9 * * *

# Weekdays at 9 AM and 5 PM
0 9,17 * * 1-5
```

## Monitoring

### Health Checks

All deployments include health checks:

```bash
# Docker
docker ps
docker logs carbon-pr-review

# Kubernetes
kubectl get pods -n carbon-pr-review
kubectl logs -f deployment/carbon-pr-review -n carbon-pr-review

# Cloud Foundry
cf app carbon-pr-review
cf logs carbon-pr-review

# GitHub Actions
# Check workflow runs in Actions tab
```

### Metrics to Monitor

1. **Success Rate** - % of successful reviews
2. **Review Time** - Average time per PR
3. **Findings Rate** - Average findings per PR
4. **API Rate Limits** - GitHub API usage
5. **Error Rate** - Failed reviews

## Troubleshooting

### Common Issues

1. **"Agent not found"**
   - Ensure CLI agent is installed in container
   - Check PATH environment variable

2. **"GitHub API rate limit"**
   - Use authenticated token
   - Reduce review frequency
   - Increase DAYS_BACK to reduce API calls

3. **"Timeout errors"**
   - Increase timeout in agentRunner.js
   - Reduce MAX_PRS
   - Check agent API availability

4. **"Permission denied"**
   - Verify GitHub token permissions
   - Check repository access
   - Ensure token hasn't expired

### Debug Mode

Enable verbose logging:

```bash
# Docker
docker run -e DEBUG=* carbon-pr-review

# Kubernetes
kubectl set env deployment/carbon-pr-review DEBUG=* -n carbon-pr-review

# Local
DEBUG=* npm start
```

## Security

### Best Practices

1. **Secrets Management**
   - Use platform-native secrets (Kubernetes Secrets, GitHub Secrets)
   - Never commit secrets to Git
   - Rotate credentials every 90 days

2. **Network Security**
   - Use private networks when possible
   - Enable TLS/SSL
   - Restrict outbound traffic

3. **Container Security**
   - Scan images for vulnerabilities
   - Use minimal base images
   - Run as non-root user (UID 1001)

4. **Access Control**
   - Use service accounts with minimal permissions
   - Enable audit logging
   - Review access regularly

## Scaling

### Horizontal Scaling

```bash
# Kubernetes
kubectl scale deployment carbon-pr-review --replicas=3 -n carbon-pr-review

# Cloud Foundry
cf scale carbon-pr-review -i 3
```

### Vertical Scaling

```bash
# Kubernetes
kubectl set resources deployment carbon-pr-review \
  --limits=cpu=1,memory=2Gi \
  --requests=cpu=500m,memory=1Gi \
  -n carbon-pr-review

# Cloud Foundry
cf scale carbon-pr-review -m 2G
```

### Auto-Scaling

```bash
# Kubernetes HPA
kubectl autoscale deployment carbon-pr-review \
  --cpu-percent=80 \
  --min=1 \
  --max=5 \
  -n carbon-pr-review

# Cloud Foundry
cf create-autoscaling-rule carbon-pr-review \
  --metric-type cpu \
  --threshold 80 \
  --min-instances 1 \
  --max-instances 5
```

## Cost Optimization

1. **Use Scheduled Jobs**
   - Run on schedule instead of continuously
   - Scale to zero between runs
   - Use CronJobs in Kubernetes

2. **Right-size Resources**
   - Start with minimal resources
   - Monitor and adjust based on usage
   - Use auto-scaling

3. **Optimize Images**
   - Use multi-stage builds
   - Minimize dependencies
   - Cache layers effectively

## Migration

### From Local to Cloud

1. Test locally with Docker Compose
2. Deploy to staging environment
3. Monitor for 24-48 hours
4. Deploy to production
5. Decommission local instance

### Between Cloud Providers

1. Export configuration and secrets
2. Update deployment files for new provider
3. Deploy to new environment
4. Run parallel for validation period
5. Switch DNS/routing
6. Decommission old environment

## Support

- **IBM Cloud:** https://cloud.ibm.com/docs
- **Kubernetes:** https://kubernetes.io/docs
- **GitHub Actions:** https://docs.github.com/actions
- **Docker:** https://docs.docker.com

## Next Steps

1. Choose deployment platform
2. Configure secrets
3. Deploy to staging
4. Test thoroughly
5. Deploy to production
6. Set up monitoring
7. Document runbooks