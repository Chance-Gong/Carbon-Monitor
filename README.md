# Carbon PR Review Agent

AI-powered PR review agent for the Carbon Design System repository. This tool automatically reviews pull requests using CLI agents (Bob, Claude, or Codex) and provides structured feedback with Carbon-specific verification.

## Features

- ✅ **Modular Architecture** - Clean separation of concerns across 5 specialized modules
- ✅ **CLI Agent Support** - Works with Bob, Claude, or Codex
- ✅ **Carbon Verification** - Validates Carbon-specific claims using Carbon Builder/MCP
- ✅ **Structured Output** - JSON-formatted findings with severity levels
- ✅ **Minimal Metadata** - Only adds `AIReviewed` label (no complex automation)
- ✅ **Single Repository** - Focused on `carbon-design-system/carbon`

## Architecture

```
carbon-pr-review/
├── src/
│   ├── index.js           # Main orchestrator
│   ├── githubClient.js    # GitHub API operations
│   ├── reviewBundle.js    # Temporary workspace builder
│   ├── agentRunner.js     # CLI agent execution
│   ├── reviewParser.js    # JSON output parsing
│   └── reviewPrompt.js    # Comment formatting
├── docs/
│   ├── AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md
│   └── CARBON_PORT_COMPARISON.md
├── tests/
│   └── test-agent.js
├── package.json
├── .env.example
└── README.md
```

## Prerequisites

1. **Node.js** >= 18.0.0
2. **GitHub Token** with repo permissions
3. **CLI Agent** (choose one):
   - **Bob Shell** - Best for IBM office/VPN (requires `BOBSHELL_API_KEY`)
   - **Claude** - Works anywhere (requires `ANTHROPIC_API_KEY`)
   - **Codex** - Alternative option

## Installation

1. Clone or copy this directory to your system

2. Install dependencies:
```bash
cd carbon-pr-review
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Install your chosen CLI agent:
```bash
# For Bob
npm install -g @ibm/bob-shell
or
npm install -g bob-cli

# For Claude
npm install -g @anthropic-ai/claude-cli

# For Codex
npm install -g openai-codex-cli
```

## Configuration

Edit `.env` file:

```bash
# GitHub Configuration
GITHUB_AI_AGENT_TOKEN=ghp_your_token_here
GITHUB_AI_AGENT_OWNER=carbon-design-system
GITHUB_AI_AGENT_REPO=carbon

# CLI Agent (choose one: bob, claude, or codex)
GITHUB_AI_AGENT_CLI=bob

# Agent API Keys (depending on which agent you use)
BOBSHELL_API_KEY=your_bob_key_here
ANTHROPIC_API_KEY=your_claude_key_here

# Optional Configuration
GITHUB_AI_AGENT_MAX_PRS=5
GITHUB_AI_AGENT_DAYS_BACK=21
GITHUB_AI_AGENT_REVIEW_LABEL=AIReviewed
```

## Usage

### Run the Agent

```bash
npm start
```

This will:
1. Fetch open PRs without the `AIReviewed` label
2. For each PR:
   - Fetch diff and changed files
   - Build a temporary review workspace
   - Run the CLI agent review
   - Parse structured JSON output
   - Filter unverified Carbon claims
   - Post spec-compliant comment
   - Add `AIReviewed` label
   - Clean up temporary files

### Test the Agent

```bash
npm test
```

### Run Manually

```bash
node src/index.js
```

## How It Works

### 1. GitHub Client (`githubClient.js`)
- Fetches reviewable PRs (open, no review label)
- Fetches PR diffs and changed files
- Posts review comments
- Adds labels

### 2. Review Bundle (`reviewBundle.js`)
- Creates temporary workspace with PR context
- Generates files:
  - `pr.json` - PR metadata
  - `files.json` - Changed files list
  - `diff.patch` - Unified diff
  - `PR_REVIEW_REQUEST.md` - Human-readable context
  - `.roo/rules/carbon-review-rules.md` - Carbon-specific rules

### 3. Agent Runner (`agentRunner.js`)
- Executes CLI agent (bob/claude/codex)
- Passes review prompt and workspace
- Captures structured output
- Handles timeouts and errors

### 4. Review Parser (`reviewParser.js`)
- Parses JSON output between markers
- Validates required fields
- Filters unverified Carbon claims
- Counts findings by severity

### 5. Review Prompt (`reviewPrompt.js`)
- Formats spec-compliant comments
- Structures findings by severity
- Includes verification sources
- Adds metadata (agent, commit, counts)

## Output Format

The agent posts structured comments like:

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

#### 🟢 Low (1)
- **Documentation update needed** (Line 120)
  - Severity: low
  - Message: Add JSDoc comments
```

## Carbon Verification

The agent automatically filters findings that make Carbon-specific claims without verification:

**Verified Sources:**
- `carbon_builder` - Verified using Carbon Builder tool
- `carbon_mcp` - Verified using Carbon MCP server

**Filtered Claims:**
- Mentions Carbon components without verification
- References Carbon tokens without verification
- Suggests Carbon patterns without verification

This ensures all Carbon-specific feedback is accurate and trustworthy.

## Comparison to Original A11y System

| Feature | Original A11y | Carbon Port |
|---------|--------------|-------------|
| Repositories | 11 IBM repos | 1 (Carbon) |
| AI Backend | WatsonX API | CLI agents |
| Code Size | 1072 lines | 213 lines |
| Architecture | Monolithic | Modular (6 files) |
| Metadata | Extensive | Minimal |
| Performance | 18-42 min | 2.5-5 min |

See [`docs/CARBON_PORT_COMPARISON.md`](docs/CARBON_PORT_COMPARISON.md) for detailed comparison.

## Recent Fixes

### JSON Truncation Handling (2026-06-05)

Fixed issue where Bob's review output was being truncated mid-JSON, causing parse errors:
```
❌ Error parsing review output: Unterminated string in JSON at position 8165
```

**Solution:** Enhanced `reviewParser.js` with intelligent JSON repair that:
- Detects truncation and finds the last complete finding
- Properly handles escaped quotes and nested structures
- Gracefully falls back to empty findings array if needed
- Recovers maximum findings from partial output

See [`docs/JSON_TRUNCATION_FIX.md`](docs/JSON_TRUNCATION_FIX.md) for technical details.

## Troubleshooting

### Agent Not Found
```bash
# Check if agent is installed
which bob
which claude
which codex

# Install if missing
npm install -g @ibm/bob-shell
```

### API Key Issues
```bash
# Verify environment variables
echo $BOBSHELL_API_KEY
echo $ANTHROPIC_API_KEY

# Check .env file
cat .env
```

### GitHub Token Permissions
Ensure your token has:
- `repo` scope (full repository access)
- `write:discussion` (for comments)

### Bob Cloudflare Blocking
Bob Shell requires IBM office/VPN access. If blocked:
- Use Claude instead (`GITHUB_AI_AGENT_CLI=claude`)
- Or connect to IBM VPN

## Development

### Project Structure
```
src/
├── index.js           # Main entry point, orchestrates workflow
├── githubClient.js    # GitHub API wrapper
├── reviewBundle.js    # Temp workspace management
├── agentRunner.js     # CLI agent execution
├── reviewParser.js    # JSON parsing and validation
└── reviewPrompt.js    # Comment formatting
```

### Adding New Features

1. **New CLI Agent Support**
   - Add to `agentRunner.js`
   - Update environment validation
   - Test with sample PR

2. **Custom Review Rules**
   - Edit `reviewBundle.js`
   - Add rules to `.roo/rules/` directory
   - Update prompt template

3. **Additional Metadata**
   - Modify `githubClient.js`
   - Add new GitHub API calls
   - Update comment format

## License

Apache-2.0

## Support

For issues or questions:
1. Check [`docs/AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md`](docs/AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md)
2. Review [`docs/CARBON_PORT_COMPARISON.md`](docs/CARBON_PORT_COMPARISON.md)
3. Open an issue in the repository

## Credits

Based on the IBM Accessibility PR review system, adapted for Carbon Design System with modular architecture and CLI agent support.