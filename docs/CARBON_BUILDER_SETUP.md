# Carbon Builder MCP Server Setup

This document explains how the PR Review Agent integrates with Carbon Builder for verifying Carbon Design System claims.

## Overview

The agent uses the **Model Context Protocol (MCP)** to connect CLI agents (Bob, Claude, Codex) with the Carbon Builder server. This enables agents to:

- Verify Carbon component APIs and props
- Check Carbon token usage
- Validate accessibility patterns
- Confirm design system compliance

## Architecture

```
┌─────────────────┐
│  PR Review      │
│  Agent          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  CLI Agent      │◄────►│  Carbon Builder  │
│  (Bob/Claude)   │ MCP  │  MCP Server      │
└─────────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Review Bundle  │
│  with MCP       │
│  Config         │
└─────────────────┘
```

## Installation

### 1. Install Carbon Builder MCP Server

```bash
# Global installation (recommended)
npm install -g @carbon/mcp-server

# Verify installation
npx @carbon/mcp-server --version
```

### 2. Verify Agent Can Access It

The PR Review Agent automatically checks for Carbon Builder at startup:

```bash
npm start
```

Expected output:
```
[AI PR Review] repo=carbon-design-system/carbon
[AI PR Review] selectedAgent=bob
[AI PR Review] label=AIReviewed
Agent: bob
✅ Agent 'bob' is available
🔍 Checking Carbon Builder MCP server...
✅ Carbon Builder MCP server is available
```

## Configuration Files

The agent automatically creates MCP configuration files in each review bundle:

### For Bob Shell

**`.bob/mcp.json`**
```json
{
  "mcpServers": {
    "carbon": {
      "command": "npx",
      "args": ["-y", "@carbon/mcp-server"],
      "env": {}
    }
  }
}
```

**`.bob/skills/carbon-builder.json`**
```json
{
  "name": "carbon-builder",
  "description": "Carbon Design System verification and documentation tool",
  "version": "1.0.0",
  "mcp_server": "carbon",
  "tools": [
    "search_carbon_docs",
    "get_component_info",
    "verify_carbon_pattern",
    "check_accessibility"
  ]
}
```

### For Claude

**`.claude/mcp_config.json`**
```json
{
  "mcpServers": {
    "carbon": {
      "command": "npx",
      "args": ["-y", "@carbon/mcp-server"]
    }
  }
}
```

### For Codex

**`.codex/mcp_config.json`**
```json
{
  "mcpServers": {
    "carbon": {
      "command": "npx",
      "args": ["-y", "@carbon/mcp-server"]
    }
  }
}
```

## Environment Variables

The agent runner sets MCP config paths for each agent:

```javascript
// For Bob
env.BOB_MCP_CONFIG = `${cwd}/.bob/mcp.json`;

// For Claude
env.CLAUDE_MCP_CONFIG = `${cwd}/.claude/mcp_config.json`;

// For Codex
env.CODEX_MCP_CONFIG = `${cwd}/.codex/mcp_config.json`;
```

## Agent Instructions

Each agent receives these instructions in their rules files:

```markdown
# Carbon PR Review Agent Rules

You are reviewing a pull request in carbon-design-system/carbon.

Mandatory:
- Use Carbon Builder skill when available before making any Carbon API, 
  prop, token, icon, accessibility, or design-system claim.
- If Carbon Builder is unavailable, use Carbon MCP tools as ground truth.
- Any unverified Carbon claim is invalid and must not be posted.
- Prefer specific actionable findings over general advice.
- Do not edit files.
- Do not run package manager install commands.
- Produce only the requested JSON object and review Markdown.
```

## Verification Flow

1. **Agent receives PR review task** with Carbon-specific code changes
2. **Agent identifies potential Carbon issue** (e.g., incorrect prop usage)
3. **Agent calls Carbon Builder** via MCP:
   ```
   use_mcp_tool("carbon", "get_component_info", {
     component: "Button",
     prop: "kind"
   })
   ```
4. **Carbon Builder responds** with verified information
5. **Agent includes finding** with verification:
   ```json
   {
     "severity": "major",
     "file": "src/Button.jsx",
     "line": 45,
     "title": "Invalid Button kind prop",
     "body": "The 'kind' prop value 'custom' is not valid. Valid values are: primary, secondary, tertiary, ghost, danger",
     "carbonVerified": true,
     "verificationSource": "carbon-builder"
   }
   ```

## Verification Filtering

The parser automatically filters unverified Carbon claims:

```javascript
function filterUnverifiedCarbonFindings(findings) {
  return findings.filter((finding) => {
    // Non-Carbon-specific findings are always allowed
    if (!looksCarbonSpecific(finding)) {
      return true;
    }
    
    // Carbon-specific findings must be verified
    return finding.carbonVerified === true &&
      ['carbon-builder', 'carbon-mcp'].includes(finding.verificationSource);
  });
}
```

## Troubleshooting

### Carbon Builder Not Found

**Symptom:**
```
⚠️  Carbon Builder MCP server not found
   The agent will have limited Carbon verification capabilities
```

**Solution:**
```bash
npm install -g @carbon/mcp-server
```

### Agent Not Using Carbon Builder

**Check 1: MCP config files created**
```bash
# After a review run with GITHUB_AI_AGENT_KEEP_ARTIFACTS=true
ls -la /tmp/github-ai-agent-pr-review/*/
# Should see .bob/mcp.json, .claude/mcp_config.json, etc.
```

**Check 2: Environment variables set**
```bash
# Add debug logging to agentRunner.js
console.log('MCP Config:', env.BOB_MCP_CONFIG);
```

**Check 3: Agent output includes verification**
```bash
# Look for carbonVerified: true in findings
cat /tmp/github-ai-agent-pr-review/*/agent-output-raw.txt
```

### Findings Being Filtered

If all Carbon findings are being filtered:

1. Check that Carbon Builder is installed
2. Verify MCP config files are created
3. Check agent output for `carbonVerified: true`
4. Temporarily disable filter for testing:
   ```bash
   GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
   ```

## Testing Carbon Builder Integration

Create a test PR with known Carbon issues:

```javascript
// Bad: Invalid Button kind
<Button kind="custom">Click me</Button>

// Bad: Wrong token usage
const spacing = '16px'; // Should use Carbon token

// Bad: Missing required prop
<Checkbox /> // Missing labelText prop
```

Run the agent and verify:
1. Findings include `carbonVerified: true`
2. `verificationSource` is `carbon-builder`
3. Findings reference specific Carbon documentation

## Implementation Files

- **MCP Config Creation**: [`src/reviewBundle.js`](../src/reviewBundle.js) lines 102-165
- **Environment Setup**: [`src/agentRunner.js`](../src/agentRunner.js) lines 35-42
- **Verification Check**: [`src/index.js`](../src/index.js) lines 78-95
- **Finding Filter**: [`src/reviewParser.js`](../src/reviewParser.js) lines 23-40

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Carbon Design System Documentation](https://carbondesignsystem.com/)
- [Carbon MCP Server Repository](https://github.com/carbon-design-system/carbon-mcp-server)