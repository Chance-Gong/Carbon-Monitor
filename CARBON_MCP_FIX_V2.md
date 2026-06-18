# Carbon MCP Server Unavailability - Root Cause and Fix

## Problem

When Bob reviews PRs, the Carbon MCP server is unavailable, resulting in:
- Warning: "⚠️ Note: Carbon MCP verification tools were unavailable during this review"
- All Carbon findings marked as `verificationSource: "model-memory-fallback"`
- Findings flagged with `requiresDownstreamReview: true`

## Root Cause

**Bob cannot access MCP servers when running from a different working directory.**

When the Carbon-Monitor spawns Bob to review a PR:
1. It creates a temporary bundle directory (e.g., `/tmp/owner__repo__pull-123-xyz/`)
2. It spawns Bob with `cwd` set to this temporary directory
3. Bob looks for `.bob/mcp.json` in the current working directory
4. Without a local MCP config, Bob cannot access any MCP servers
5. The `--allowed-mcp-server-names` flag alone is NOT sufficient

**Key Discovery:** Even though `bob mcp list` shows carbon-mcp-server is configured globally, Bob cannot use it when running from a different directory without a local `.bob/mcp.json` file.

## The Fix

### 1. Create Local MCP Config in Bundle

**File:** `src/reviewBundle.js`

Added code to write `.bob/mcp.json` in the bundle directory:

```javascript
// Write Bob MCP config - Bob DOES support per-directory .bob/mcp.json
const bobMcpConfig = {
  mcpServers: {
    'carbon-mcp-server': {
      command: 'npx',
      args: ['-y', 'carbon-mcp'],
      trust: true,
      alwaysAllow: [
        'search_docs',
        'search_file_content',
        'list_carbon_components',
        'get_carbon_component',
        'list_carbon_charts',
        'get_carbon_chart',
        'list_carbon_icons',
        'get_carbon_icon',
        'list_carbon_pictograms',
        'get_carbon_pictogram'
      ]
    }
  }
};

await fs.writeFile(
  path.join(tempDir, '.bob', 'mcp.json'),
  JSON.stringify(bobMcpConfig)
);
```

### 2. Add .env File to Bundle

**File:** `src/reviewBundle.js`

Bob also looks for `BOBSHELL_API_KEY` in a `.env` file in the current directory:

```javascript
// Write .env file with API key for Bob
const envContent = `BOBSHELL_API_KEY=${process.env.BOBSHELL_API_KEY || ''}\n`;
await fs.writeFile(
  path.join(tempDir, '.env'),
  envContent
);
```

This ensures Bob can authenticate even when running from the temporary directory.

## Why This Works

1. **Local MCP Config:** Bob reads `.bob/mcp.json` from the current working directory
2. **MCP Server Definition:** The config tells Bob how to spawn the carbon-mcp-server (`npx -y carbon-mcp`)
3. **Trust and Permissions:** The `trust: true` and `alwaysAllow` settings grant Bob permission to use the tools
4. **API Key Access:** The `.env` file ensures Bob can authenticate

## Testing

To verify the fix works:

```bash
# Run a PR review
npm start

# Check logs for:
# - "🤖 Running bob review..."
# - "✅ bob review received"
# - "✅ Parsed: X findings"
# - Look for findings with verificationSource: "carbon-mcp" (not "model-memory-fallback")
```

## Previous Misunderstanding

The original CARBON_MCP_FIX.md document incorrectly stated:
> "Bob doesn't support per-directory MCP config via .bob/mcp.json"

This was **incorrect**. Bob DOES support per-directory MCP config files. The issue was that we weren't creating them in the bundle directory.

## Files Modified

1. **`src/reviewBundle.js`**
   - Added `.env` file creation with BOBSHELL_API_KEY
   - Added `.bob/mcp.json` creation with carbon-mcp-server configuration
   - Updated comment numbering

2. **`src/reviewParser.js`**
   - Enhanced JSON extraction to handle text before/after JSON markers
   - Improved error diagnostics for debugging

## Expected Behavior After Fix

When Bob reviews a PR:

1. ✅ Bob will have access to carbon-mcp-server via local `.bob/mcp.json`
2. ✅ Bob will authenticate using `.env` file in bundle directory
3. ✅ Bob will use Carbon MCP tools to verify component props, usage, etc.
4. ✅ Successfully verified findings will have `carbonVerified: true, verificationSource: "carbon-mcp"`
5. ✅ No more "MCP tools were unavailable" warnings (unless MCP actually fails)

## Verification

To confirm carbon-mcp-server is working:

```bash
# Test from project directory (should work)
bob -p "List 2 Carbon components" --yolo --allowed-mcp-server-names carbon-mcp-server

# Test from temp directory with local config (should now work)
mkdir -p /tmp/test-bob && cd /tmp/test-bob
mkdir -p .bob
cat > .bob/mcp.json << 'EOF'
{
  "mcpServers": {
    "carbon-mcp-server": {
      "command": "npx",
      "args": ["-y", "carbon-mcp"],
      "trust": true
    }
  }
}
EOF
echo "BOBSHELL_API_KEY=your_key_here" > .env
bob -p "List 2 Carbon components" --yolo --allowed-mcp-server-names carbon-mcp-server
```

## Summary

The carbon-mcp server was unavailable because:
1. ❌ Bob was running from a temporary directory without local MCP config
2. ❌ Bob couldn't find `.bob/mcp.json` in the bundle directory
3. ❌ Bob couldn't authenticate without `.env` file in bundle directory

The fix:
1. ✅ Create `.bob/mcp.json` in bundle directory with carbon-mcp-server config
2. ✅ Create `.env` file in bundle directory with BOBSHELL_API_KEY
3. ✅ Bob can now access and use carbon-mcp-server from any directory