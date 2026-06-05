# Carbon PR Review Agent - Quick Start Guide

Get the Carbon PR review agent running in 5 minutes!

## Prerequisites

- Node.js >= 18.0.0
- GitHub account with access to carbon-design-system/carbon
- One of: Bob Shell, Claude CLI, or Codex CLI

## Step 1: Install Dependencies

```bash
cd carbon-pr-review
npm install
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Required configuration:
```bash
GITHUB_AI_AGENT_TOKEN=ghp_your_token_here
GITHUB_AI_AGENT_CLI=bob  # or claude or codex
BOBSHELL_API_KEY=your_key_here  # if using bob
```

## Step 3: Install CLI Agent

Choose one:

### Option A: Bob Shell (IBM Office/VPN)
```bash
npm install -g @ibm/bob-shell
or
npm install -g bob-cli
```

### Option B: Claude (Works Anywhere)
```bash
npm install -g @anthropic-ai/claude-cli
```

### Option C: Codex
```bash
npm install -g openai-codex-cli
```

## Step 4: Test the Setup

```bash
npm test
```

This will:
- ✅ Verify environment variables
- ✅ Check API keys
- ✅ Test agent availability
- ✅ Test GitHub connection
- ✅ Run a test review

## Step 5: Run the Agent

```bash
npm start
```

The agent will:
1. Fetch open PRs without `AIReviewed` label
2. Review each PR using your chosen CLI agent
3. Post structured comments with findings
4. Add `AIReviewed` label
5. Clean up temporary files

## Docker Deployment (Optional)

### Build and Run with Docker Compose

```bash
# Build the image
docker-compose build

# Run the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Build and Run with Docker

```bash
# Build the image
docker build -t carbon-pr-review .

# Run the container
docker run -d \
  --name carbon-pr-review \
  --env-file .env \
  carbon-pr-review

# View logs
docker logs -f carbon-pr-review

# Stop the container
docker stop carbon-pr-review
```

## Troubleshooting

### "Agent not found in PATH"

Install the CLI agent:
```bash
# For Bob
npm install -g @ibm/bob-shell

# For Claude
npm install -g @anthropic-ai/claude-cli
```

### "GitHub token invalid"

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a fine-grained token with:
   - Repository access: carbon-design-system/carbon
   - Permissions: Contents (read), Pull requests (read/write), Issues (read/write)

### "Bob Shell Cloudflare blocking"

Bob requires IBM office/VPN access. Either:
- Connect to IBM VPN
- Use Claude instead: `GITHUB_AI_AGENT_CLI=claude`

### "No PRs to review"

This is normal if:
- All open PRs already have `AIReviewed` label
- No PRs were created in the last 21 days
- Repository has no open PRs

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_AI_AGENT_TOKEN` | ✅ | - | GitHub personal access token |
| `GITHUB_AI_AGENT_CLI` | ✅ | - | CLI agent: bob, claude, or codex |
| `GITHUB_AI_AGENT_OWNER` | ❌ | carbon-design-system | Repository owner |
| `GITHUB_AI_AGENT_REPO` | ❌ | carbon | Repository name |
| `GITHUB_AI_AGENT_MAX_PRS` | ❌ | 5 | Max PRs to review per run |
| `GITHUB_AI_AGENT_DAYS_BACK` | ❌ | 21 | How far back to look for PRs |
| `GITHUB_AI_AGENT_REVIEW_LABEL` | ❌ | AIReviewed | Label to add after review |
| `BOBSHELL_API_KEY` | ⚠️ | - | Required if using Bob |
| `ANTHROPIC_API_KEY` | ⚠️ | - | Required if using Claude |

### Scheduling (Cron)

To run the agent automatically:

```bash
# Edit crontab
crontab -e

# Add line to run every hour
0 * * * * cd /path/to/carbon-pr-review && npm start >> /var/log/carbon-pr-review.log 2>&1

# Or run every 6 hours
0 */6 * * * cd /path/to/carbon-pr-review && npm start >> /var/log/carbon-pr-review.log 2>&1
```

## Next Steps

1. **Review First Results** - Check the comments posted by the agent
2. **Adjust Configuration** - Tune `MAX_PRS` and `DAYS_BACK` as needed
3. **Set Up Scheduling** - Automate with cron or CI/CD
4. **Monitor Performance** - Track review quality and response times
5. **Customize Rules** - Add Carbon-specific review rules in `reviewBundle.js`

## Support

- 📖 Full documentation: [`README.md`](README.md)
- 📋 Specification: [`docs/AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md`](docs/AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md)
- 📊 Comparison: [`docs/CARBON_PORT_COMPARISON.md`](docs/CARBON_PORT_COMPARISON.md)

## Example Output

When the agent reviews a PR, it posts a comment like:

```markdown
## 🤖 AI Review Summary

**Agent:** bob | **Commit:** abc123def | **Findings:** 5

### Summary

This PR introduces new Carbon components with accessibility improvements...

### Findings by Severity

#### 🔴 Critical (1)
- **Missing ARIA label** (Line 45)
  - Severity: critical
  - Message: Button lacks accessible label
  - Verification: carbon_builder

#### 🟡 Medium (3)
- **Inconsistent spacing** (Line 78)
  - Severity: medium
  - Message: Should use Carbon spacing tokens
  - Verification: carbon_mcp
```

Happy reviewing! 🚀