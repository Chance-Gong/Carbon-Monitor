# Carbon Builder Integration - Implementation Summary

## ⚠️ Important Discovery

**The `@carbon/mcp-server` package does not exist.** The integration infrastructure has been built and is ready, but there is no Carbon MCP server to connect to yet.

## What Was Done

Carbon Builder MCP server integration infrastructure has been fully configured for the PR Review Agent.

## Changes Made

### 1. Review Bundle Configuration (`src/reviewBundle.js`)

Added MCP server configuration for all three CLI agents:

- **Bob Shell**: 
  - `.bob/mcp.json` - MCP server configuration
  - `.bob/skills/carbon-builder.json` - Skill definition
  
- **Claude**:
  - `.claude/mcp_config.json` - MCP server configuration
  
- **Codex**:
  - `.codex/mcp_config.json` - MCP server configuration

All configs point to `npx -y @carbon/mcp-server` for on-demand execution.

### 2. Agent Runner Updates (`src/agentRunner.js`)

Added environment variables to pass MCP config paths to each agent:
- `BOB_MCP_CONFIG` for Bob
- `CLAUDE_MCP_CONFIG` for Claude  
- `CODEX_MCP_CONFIG` for Codex

### 3. Startup Verification (`src/index.js`)

Added Carbon Builder availability check at startup:
- Attempts to run `npx @carbon/mcp-server --version`
- Warns if not available but continues (graceful degradation)
- Logs clear status message

### 4. Documentation Updates

- **README.md**: Added Carbon Builder as prerequisite and documented verification process
- **docs/CARBON_BUILDER_SETUP.md**: Comprehensive setup and troubleshooting guide

## How It Works

1. **Bundle Creation**: When a PR review starts, the agent creates a temporary directory with:
   - PR metadata and diff
   - Agent-specific rules
   - **MCP configuration files** (NEW)

2. **Agent Execution**: The agent runs with:
   - Working directory set to bundle
   - Environment variables pointing to MCP configs
   - Instructions to use Carbon Builder for verification

3. **Carbon Verification**: The agent can now:
   - Call Carbon Builder via MCP protocol
   - Verify component APIs, props, tokens
   - Check accessibility patterns
   - Validate design system compliance

4. **Finding Validation**: Parser filters findings:
   - Carbon-specific claims must have `carbonVerified: true`
   - Must specify `verificationSource: "carbon-builder"` or `"carbon-mcp"`
   - Unverified Carbon claims are automatically filtered out

## Installation Status

**Carbon Builder MCP server does not exist yet.**

The command `npm install -g @carbon/mcp-server` will fail with:
```
npm error 404 Not Found - GET https://registry.npmjs.org/@carbon%2fmcp-server
npm error 404  '@carbon/mcp-server@*' is not in this registry.
```

The agent will check for this at startup and warn that it's missing.

## Testing

### Current Reality

Without Carbon MCP server:

1. Run the agent: `npm start`
2. Check startup logs for: `⚠️ Carbon Builder MCP server not found`
3. Agent will filter out Carbon-specific findings
4. Only generic code quality findings will be posted

### Testing Without Filter

To test with unverified findings:

```bash
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
```

### When Carbon MCP Server Exists

Future testing steps:

1. Install Carbon Builder: `npm install -g @carbon/mcp-server`
2. Run the agent: `npm start`
3. Check startup logs for: `✅ Carbon Builder MCP server is available`
4. Review a PR with Carbon code
5. Verify findings include `carbonVerified: true` and `verificationSource: "carbon-builder"`

## Files Modified

- `src/reviewBundle.js` - Added MCP config creation (lines 102-165)
- `src/agentRunner.js` - Added MCP env vars (lines 35-42)
- `src/index.js` - Added startup check (lines 78-95)
- `README.md` - Updated prerequisites and verification section
- `docs/CARBON_BUILDER_SETUP.md` - New comprehensive guide

## Verification Status

| Component | Status | Notes |
|-----------|--------|-------|
| MCP Config Files | ✅ Created | For Bob, Claude, Codex |
| Environment Variables | ✅ Set | Config paths passed to agents |
| Startup Check | ✅ Added | Warns if Carbon Builder missing |
| Agent Instructions | ✅ Present | Already in rules files |
| Finding Filter | ✅ Working | Already implemented |
| Documentation | ✅ Complete | README + setup guide |

## Next Steps

### Immediate (Now)

1. **Accept limitation**: Carbon verification not available yet
2. **Test generic review**: Run agent to verify non-Carbon findings work
3. **Use filter bypass**: Test with `GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true` if needed

### Future (When Carbon MCP Server Exists)

1. **Install Carbon Builder**: `npm install -g @carbon/mcp-server`
2. **Test with real PR**: Run agent on Carbon repo PR
3. **Verify findings**: Check that Carbon claims are verified
4. **Monitor logs**: Ensure MCP calls are successful

## Troubleshooting

### Carbon Builder Not Found (Expected)

This is normal - the package doesn't exist yet:

```
⚠️  Carbon Builder MCP server not found
   The agent will have limited Carbon verification capabilities
```

### All Carbon Findings Filtered

This is expected behavior when Carbon MCP server is unavailable. To bypass:

```bash
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
```

### For More Details

1. See full status: `docs/CARBON_VERIFICATION_STATUS.md`
2. See setup guide: `docs/CARBON_BUILDER_SETUP.md`
3. Enable artifact keeping: `GITHUB_AI_AGENT_KEEP_ARTIFACTS=true`
4. Inspect bundle: Check for `.bob/mcp.json` in temp directory

---

**Status**: ⚠️ Carbon Builder integration infrastructure is ready, but `@carbon/mcp-server` package does not exist yet.