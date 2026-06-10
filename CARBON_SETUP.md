# Carbon Verification Setup Guide

## Overview

The Carbon PR Review Agent uses the **carbon-mcp MCP server** to verify Carbon Design System claims during PR reviews. This ensures all Carbon-specific findings are accurate and based on actual Carbon documentation and APIs.

## Prerequisites

1. **Bob CLI** - The AI agent that performs reviews
   ```bash
   # Install Bob (if not already installed)
   npm install -g @ibm/bob-shell
   ```

2. **carbon-mcp** - The MCP server that provides Carbon verification
   ```bash
   # Install carbon-mcp globally
   npm install -g carbon-mcp
   ```

3. **Carbon Repositories** (for carbon-mcp to index)
   - Clone Carbon repos to `D:/carbon-mcp-server/` (or your preferred location)
   - carbon-mcp needs these to search Carbon code and documentation

## Setup Steps

### Step 1: Configure carbon-mcp for Bob

Bob needs carbon-mcp configured **globally** (not per-directory):

```bash
# Add carbon-mcp as a global MCP server for Bob
bob mcp add carbon-mcp npx -y carbon-mcp

# Verify it's configured
bob mcp list
```

Expected output:
```
Configured MCP servers:
✓ carbon-mcp: npx -y carbon-mcp (stdio) - Connected
```

### Step 2: Configure Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# GitHub token for API access
GITHUB_AI_AGENT_TOKEN=your_github_token_here

# Repository to review
GITHUB_AI_AGENT_OWNER=carbon-design-system
GITHUB_AI_AGENT_REPO=carbon

# Agent to use (bob, claude, or codex)
GITHUB_AI_AGENT_CLI=bob

# Label for PRs to review
GITHUB_AI_AGENT_REVIEW_LABEL=AIReviewed
```

### Step 3: Test the Setup

```bash
# Run the agent
npm start
```

Expected startup output:
```
[AI PR Review] repo=carbon-design-system/carbon
[AI PR Review] selectedAgent=bob
✅ Agent 'bob' is available
✅ carbon-mcp MCP server is installed
✅ Carbon verification will be used
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PR Review Agent (Node.js)                                  │
│  - Fetches PR diff and files                                │
│  - Creates review prompt                                    │
│  - Spawns Bob CLI                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Bob CLI                                                     │
│  - Reads prompt with Carbon verification instructions       │
│  - Calls carbon-mcp MCP tools when needed                  │
│  - Returns findings with verification metadata             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ MCP protocol
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  carbon-mcp MCP Server                                      │
│  - Provides code_search, docs_search, get_charts tools     │
│  - Searches Carbon repos for accurate information          │
│  - Returns verified Carbon component/API details           │
└─────────────────────────────────────────────────────────────┘
```

### Verification Process

1. **Bob identifies potential Carbon issue** in PR code
2. **Bob calls carbon-mcp MCP tools**:
   - `code_search` - Search Carbon component code and examples
   - `docs_search` - Search Carbon documentation
   - `get_charts` - Get Carbon Charts information
3. **carbon-mcp returns verified information** from Carbon repos
4. **Bob includes verification in finding**:
   ```json
   {
     "severity": "major",
     "file": "src/Button.jsx",
     "line": 45,
     "title": "Invalid Button kind prop",
     "body": "Verified via carbon-mcp code_search: The 'kind' prop only accepts: primary, secondary, tertiary, ghost, danger. Found: 'custom'",
     "carbonVerified": true,
     "verificationSource": "carbon-mcp"
   }
   ```
5. **Parser accepts verified findings** and posts them to PR

## Verification Filter

The agent automatically filters unverified Carbon-specific findings:

- ✅ **Allowed**: Findings with `carbonVerified: true` and `verificationSource: "carbon-mcp"`
- ✅ **Allowed**: Non-Carbon-specific findings (general code quality)
- ✅ **Allowed**: Findings with detailed Carbon references (fallback)
- ❌ **Filtered**: Carbon-specific claims without verification

## Troubleshooting

### carbon-mcp Not Configured

**Symptom**: `bob mcp list` shows "No MCP servers configured"

**Solution**:
```bash
bob mcp add carbon-mcp npx -y carbon-mcp
```

### All Carbon Findings Filtered

**Symptom**: Console shows "Filtered 15 unverified Carbon-specific finding(s)"

**Possible causes**:
1. carbon-mcp not configured for Bob (see above)
2. carbon-mcp not responding (check if it's installed)
3. Bob not calling MCP tools (check prompt in reviewBundle.js)

**Debug**:
```bash
# Keep artifacts to inspect
GITHUB_AI_AGENT_KEEP_ARTIFACTS=true npm start

# Check Bob's output
cat /tmp/*pull-*/agent-output-raw.txt | grep -i "carbon"
```

### Temporary Bypass (Testing Only)

To see all findings regardless of verification:

```bash
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
```

**Warning**: This allows unverified Carbon claims through. Use only for debugging.

## Configuration Files

### Key Files

- **[`src/reviewBundle.js`](src/reviewBundle.js)** - Creates review prompt with Carbon verification instructions
- **[`src/reviewParser.js`](src/reviewParser.js)** - Filters unverified Carbon findings
- **[`src/agentRunner.js`](src/agentRunner.js)** - Spawns Bob CLI
- **[`.env`](.env)** - Environment configuration

### What Bob Needs

Bob requires:
1. ✅ carbon-mcp configured globally (`bob mcp add`)
2. ✅ Prompt telling it to use carbon-mcp tools
3. ❌ **NOT** per-directory `.bob/mcp.json` files (Bob ignores these)
4. ❌ **NOT** "skill" files (Bob doesn't use skills)

## Testing

### Create a Test PR

Add Carbon code with intentional issues:

```javascript
// Invalid Button kind
<Button kind="custom">Click me</Button>

// Wrong token usage  
const spacing = '16px'; // Should use $spacing-05

// Missing required prop
<Checkbox /> // Missing labelText
```

### Run Review

```bash
# Add AIReviewed label to PR
# Then run:
npm start
```

### Verify Results

Check that:
- ✅ Carbon findings are posted (not filtered)
- ✅ Findings include "Verified via carbon-mcp"
- ✅ Findings reference specific Carbon documentation
- ✅ Console shows fewer/no filtered findings

## Summary

**Required Setup**:
1. Install Bob CLI and carbon-mcp
2. Configure carbon-mcp globally: `bob mcp add carbon-mcp npx -y carbon-mcp`
3. Set environment variables in `.env`
4. Run `npm start`

**How Verification Works**:
- Bob calls carbon-mcp MCP tools to verify Carbon claims
- Findings include `carbonVerified: true` and `verificationSource: "carbon-mcp"`
- Parser allows verified findings through, filters unverified ones

**Key Insight**:
Bob uses **global MCP configuration**, not per-directory config files. The one-time `bob mcp add` command is essential for Carbon verification to work.