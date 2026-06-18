# Carbon MCP Setup Summary

## Current Status: ✅ CONFIGURED & CONNECTED

### Verification
```bash
$ bob mcp list
✓ carbon-mcp-server: npx -y carbon-mcp (stdio) - Connected
```

## Configuration

### Global Settings
**Location:** `~/.bob/settings.json`

```json
{
  "mcpServers": {
    "carbon-mcp-server": {
      "command": "npx",
      "args": ["-y", "carbon-mcp"]
    }
  }
}
```

### Project Settings
- **Removed** project-level `.bob/settings.json` and `.bob/mcp.json`
- Using global configuration only to avoid conflicts

## Code Changes

### 1. Removed Settings Override
**File:** `src/agentRunner.js`
- Removed `BOBSHELL_SETTINGS_PATH` environment variable
- Removed `--allowed-mcp-server-names` flag (was causing crashes)
- Now relies on global settings

### 2. Simplified Bundle Creation
**File:** `src/reviewBundle.js`
- Removed settings copying logic
- No longer creates temp `.bob/settings.json`
- Uses global settings directly

### 3. Updated Function Signatures
**Files:** `src/agentRunner.js`, `src/index.js`
- Removed `settingsPath` parameter
- Simplified function calls

## Current Issue

### Symptom
PR reviews show: `⚠️ MCP Service Unavailable - Using model memory fallback`

### Debug Output Shows
```
[MCP DEBUG] <use_mcp_tool>
[MCP DEBUG] <server_name>carbon-mcp-
[MCP DEBUG] </use_mcp_tool>
```

### Analysis
1. ✅ MCP server is configured correctly
2. ✅ MCP server connects successfully (`bob mcp list` shows Connected)
3. ✅ Bob Shell attempts to use MCP tools (debug output shows `<use_mcp_tool>`)
4. ❌ MCP tools don't respond in time during automated CLI execution

### Possible Causes
1. **Startup Time**: MCP server takes time to initialize (loads 126 components, themes)
2. **CLI Mode Timeout**: `--yolo` mode might have shorter timeouts than interactive mode
3. **First-Run Delay**: First execution needs to download/setup carbon-mcp
4. **Process Isolation**: CLI mode might not share MCP connections with interactive sessions

## Recommendations

### Option 1: Pre-warm MCP Server
Start the MCP server before running reviews:
```bash
# In a separate terminal
bob mcp start carbon-mcp-server
```

### Option 2: Increase Timeout
Add longer timeout for first tool use (if Bob Shell supports it)

### Option 3: Interactive Mode
Use Bob Shell interactively instead of CLI for reviews

### Option 4: Accept Fallback
The current implementation correctly falls back to model memory when MCP is unavailable, which is the intended behavior per the spec.

## Testing

### Verify Configuration
```bash
node test-carbon-mcp-setup.js
```

### Check MCP Status
```bash
bob mcp list
```

### Test MCP Tools Manually
```bash
bob
# Then in interactive mode:
# "List carbon components"
```

## Documentation References
- Bob Shell MCP Docs: https://bob.ibm.com/docs/shell/configuration/mcp/mcp-bobshell
- carbon-mcp Package: https://www.npmjs.com/package/carbon-mcp