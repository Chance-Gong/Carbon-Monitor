# Carbon MCP Verification Fix

## Problem

Carbon-Monitor was filtering out all Carbon-specific findings with the error:

```
❌ FILTERED unverified Carbon finding: DataTable missing required 'headers' prop
   Reason: carbonVerified=false, verificationSource=model-memory-fallback
```

All 10 Carbon findings were being filtered because:
1. Bob was NOT using Carbon MCP tools to verify findings
2. Bob was falling back to model memory (`verificationSource=model-memory-fallback`)
3. Bob was NOT setting `requiresDownstreamReview: true` for fallback findings
4. The filter in `reviewParser.js` was correctly rejecting unverified Carbon claims

## Root Causes

### Issue 1: Missing Detailed Prompt Instructions

**Location:** `src/reviewBundle.js`

- The bundle was creating its own **simplified prompt** (lines 158-187)
- This prompt did NOT include the detailed Carbon MCP verification instructions
- The detailed instructions in `src/reviewPrompt.js` (via `buildReviewPrompt()`) were being ignored
- Without proper instructions, Bob didn't know to use Carbon MCP tools

### Issue 2: Bob Not Allowed to Use MCP Server

**Location:** `src/agentRunner.js`

- Bob was being called without the `--allowed-mcp-server-names` flag
- Even though carbon-mcp-server was configured globally (`bob mcp list` showed it connected)
- Bob needs explicit permission to use MCP servers via CLI flag
- Without this flag, Bob couldn't access the MCP tools even if instructed to use them

### Issue 3: BOB_MCP_CONFIG Overriding Global Config

**Location:** `src/agentRunner.js` (line 37)

- Code was setting `BOB_MCP_CONFIG` environment variable to point to bundle's `.bob/mcp.json`
- **Bob doesn't support per-directory MCP config files** - it only uses global config
- This environment variable was overriding Bob's global MCP config
- Bob was being pointed to an empty/non-functional local config instead of using the working global config
- Result: Bob couldn't find any MCP servers even with `--allowed-mcp-server-names` flag

## The Fixes

### Fix 1: Use Detailed Prompt with MCP Instructions

**Changed:** `src/reviewBundle.js`

1. **Added import** of `buildReviewPrompt` from `reviewPrompt.js`:
   ```javascript
   const { buildReviewPrompt } = require('./reviewPrompt');
   ```

2. **Replaced the simplified prompt** with the detailed prompt builder:
   ```javascript
   // Before (lines 158-187):
   const prompt = `You are an agentic PR reviewer...`; // Simplified prompt
   
   // After (line 159):
   const prompt = buildReviewPrompt({ owner, repo }); // Detailed prompt with MCP instructions
   ```

### Fix 2: Allow Bob to Use Carbon MCP Server

**Changed:** `src/agentRunner.js`

Added `--allowed-mcp-server-names` flag to Bob CLI command:

```javascript
// Before (line 56):
args = ['-p', prompt, '--yolo'];

// After (lines 56-62):
args = [
  '-p',
  prompt,
  '--yolo',
  '--allowed-mcp-server-names',
  'carbon-mcp-server'
];
```

This explicitly grants Bob permission to use the carbon-mcp-server that's configured globally.

### Fix 3: Remove BOB_MCP_CONFIG Override

**Changed:** `src/agentRunner.js`

Removed the line that was overriding Bob's global MCP config:

```javascript
// Before (lines 36-42):
if (agent === 'bob') {
  env.BOB_MCP_CONFIG = `${cwd}/.bob/mcp.json`;  // ❌ This was breaking MCP!
} else if (agent === 'claude') {
  env.CLAUDE_MCP_CONFIG = `${cwd}/.claude/mcp_config.json`;
} else if (agent === 'codex') {
  env.CODEX_MCP_CONFIG = `${cwd}/.codex/mcp_config.json`;
}

// After (lines 36-42):
// Note: Bob doesn't support per-directory MCP config, it uses global config only
// The --allowed-mcp-server-names flag works with Bob's global MCP servers
if (agent === 'claude') {
  env.CLAUDE_MCP_CONFIG = `${cwd}/.claude/mcp_config.json`;
} else if (agent === 'codex') {
  env.CODEX_MCP_CONFIG = `${cwd}/.codex/mcp_config.json`;
}
```

**Critical:** Bob only supports globally configured MCP servers (via `bob mcp add`). Setting `BOB_MCP_CONFIG` to a local file was overriding the working global config and pointing Bob to an empty config.

## What This Fixes

The detailed prompt from `buildReviewPrompt()` includes:

1. **Explicit Carbon MCP tool instructions:**
   - When to use `list_carbon_components`, `get_carbon_component`, etc.
   - How to verify Carbon-specific findings
   - Proper categorization rules

2. **Clear verification requirements:**
   - Category 1: Carbon-specific findings (MUST use MCP tools)
   - Category 2: Non-Carbon findings (generic code quality)

3. **Fallback behavior:**
   - If MCP is unavailable, log `⚠️ MCP UNAVAILABLE`
   - Set `requiresDownstreamReview: true` for fallback findings
   - Continue with review (uptime is mandatory)

4. **Pattern detection rules:**
   - Lists all Carbon component names that trigger verification
   - Prevents findings from being incorrectly marked as "not-carbon-specific"

## Expected Behavior After Fix

When Bob reviews a PR with Carbon components:

1. ✅ Bob will **attempt** to use Carbon MCP tools to verify component props, usage, etc.
2. ✅ Successfully verified findings will have `carbonVerified: true, verificationSource: "carbon-mcp"`
3. ✅ All findings will pass through the filter in `reviewParser.js`
4. ✅ MCP-verified inline comments will be posted with "✓ Verified with Carbon MCP" badge

**Model Memory Fallback (Expected Behavior):**

When MCP tools are unavailable or fail for specific findings:

1. ⚠️ Bob will log "⚠️ MCP UNAVAILABLE" in finding body
2. ⚠️ Findings will have `verificationSource: "model-memory-fallback"`
3. ⚠️ Findings will have `requiresDownstreamReview: true`
4. ✅ Findings will **still pass through** the filter (uptime is mandatory)
5. ✅ These findings are **not rejected** - they're flagged for human review

**This is working as designed.** The system prioritizes uptime over perfect verification. Some findings may use model memory fallback due to:
- MCP server timeouts
- Network issues
- Specific MCP tool failures
- Rate limiting

The key improvement is that Bob now **attempts** MCP verification first, and only falls back to model memory when necessary, properly flagging those findings.

## Testing

To test the fix:

```bash
# Run against a Carbon PR
node src/index.js

# Check logs for:
# - "🤖 Running bob review..."
# - "✅ bob review received"
# - "✅ Parsed: X findings" (should be > 0 for Carbon PRs)
# - NO "❌ FILTERED unverified Carbon finding" messages
```

## Files Modified

1. **`src/reviewBundle.js`** - Two changes:
   - Now uses `buildReviewPrompt()` for detailed Carbon MCP instructions
   - Removed useless `.bob/mcp.json` file creation (Bob doesn't support per-directory MCP config)
2. **`src/agentRunner.js`** - Two changes:
   - Added `--allowed-mcp-server-names carbon-mcp-server` flag to Bob command
   - Removed `BOB_MCP_CONFIG` environment variable override

## Files NOT Modified (Working as Designed)

- `src/reviewPrompt.js` - Contains the detailed prompt with Carbon MCP instructions
- `src/reviewParser.js` - Filter logic is correct (rejects unverified Carbon claims)
- `src/index.js` - Main flow is correct

## Verification

To verify the carbon-mcp-server is configured globally:

```bash
bob mcp list
# Should show: ✓ carbon-mcp-server: npx -y carbon-mcp (stdio) - Connected
```

If not configured, add it:

```bash
bob mcp add carbon-mcp-server "npx -y carbon-mcp"
```

## Summary

The issue was a **triple failure**:
1. ❌ Bob wasn't instructed to use MCP tools (missing detailed prompt)
2. ❌ Bob wasn't allowed to use MCP servers (missing `--allowed-mcp-server-names` flag)
3. ❌ Bob's global MCP config was being overridden by `BOB_MCP_CONFIG` pointing to an empty local file

All three issues have been fixed. Bob will now:
- ✅ Receive detailed instructions to use Carbon MCP tools
- ✅ Have permission to access carbon-mcp-server via CLI flag
- ✅ Use the working global MCP config (not overridden by local config)