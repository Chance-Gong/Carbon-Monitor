# Carbon Verification Status

## Current Reality

**The `@carbon/mcp-server` package does not exist.** 

The PR Review Agent has been configured with MCP server integration points, but there is currently **no Carbon Builder MCP server available** to connect to.

## What This Means

### What Works:
- ✅ Agent prompts instruct to verify Carbon claims
- ✅ Parser filters unverified Carbon-specific findings
- ✅ MCP configuration files are created in review bundles
- ✅ Infrastructure is ready for when Carbon MCP server exists

### What Doesn't Work:
- ❌ Agents cannot actually call Carbon Builder (doesn't exist)
- ❌ No real-time Carbon API verification
- ❌ No automated Carbon token validation
- ❌ No Carbon component prop checking

## Current Behavior

When the agent reviews Carbon code, it will:

1. **Attempt to use Carbon Builder** (per instructions)
2. **Find it unavailable** (package doesn't exist)
3. **Either:**
   - Skip Carbon-specific findings entirely (following instructions)
   - Make generic code quality observations only
   - Mark findings as `not-carbon-specific` to bypass filter

## Workarounds

### Option 1: Manual Carbon Verification (Current)

The agent can still provide value by:
- Identifying potential Carbon issues
- Flagging code that should be reviewed by Carbon experts
- Checking general code quality and patterns

But Carbon-specific claims will be filtered out unless marked as `not-carbon-specific`.

### Option 2: Disable Carbon Filter (Testing Only)

For testing purposes, you can disable the Carbon verification filter:

```bash
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
```

**Warning:** This allows unverified Carbon claims through. Use only for testing.

### Option 3: Create Carbon MCP Server

The infrastructure is ready. Someone needs to create `@carbon/mcp-server` that:

1. Implements MCP protocol
2. Provides Carbon Design System verification tools:
   - `search_carbon_docs` - Search Carbon documentation
   - `get_component_info` - Get component API details
   - `verify_carbon_pattern` - Validate Carbon patterns
   - `check_accessibility` - Verify accessibility compliance

## What Should Be Built

### Minimal Carbon MCP Server

```javascript
// @carbon/mcp-server/index.js
const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');

const server = new Server({
  name: 'carbon-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tool: Get component info
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'get_component_info') {
    const { component, prop } = request.params.arguments;
    // Query Carbon docs/API
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          component,
          prop,
          validValues: ['primary', 'secondary', 'tertiary'],
          required: false,
          type: 'string'
        })
      }]
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

## Recommended Path Forward

### Short Term (Now)

1. **Document the limitation** ✅ (this file)
2. **Keep MCP infrastructure** ✅ (ready for future)
3. **Use generic code review** (no Carbon verification)
4. **Disable Carbon filter for testing** (if needed)

### Medium Term (Next Quarter)

1. **Build minimal Carbon MCP server**
   - Start with component API lookup
   - Add token verification
   - Add accessibility checks

2. **Publish to npm**
   - `@carbon/mcp-server` package
   - Include in Carbon Design System org

3. **Test integration**
   - Verify agents can call it
   - Confirm findings are verified
   - Validate accuracy

### Long Term (Future)

1. **Expand Carbon MCP capabilities**
   - Full documentation search
   - Migration guidance
   - Design pattern validation
   - Accessibility auditing

2. **Integrate with Carbon tooling**
   - Connect to Carbon website API
   - Use Carbon component metadata
   - Leverage existing Carbon tools

## Current Configuration

The agent is configured to use `npx -y @carbon/mcp-server`, which will:
- Attempt to download and run the package
- Fail because it doesn't exist
- Agent will continue without Carbon verification

## Testing Without Carbon MCP

You can still test the PR review agent:

```bash
# Run with Carbon filter disabled
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start

# Or accept that Carbon findings will be filtered
npm start
```

The agent will still:
- Review code quality
- Check for bugs and issues
- Identify potential problems
- Post structured findings

It just won't verify Carbon-specific claims.

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| MCP Infrastructure | ✅ Ready | Config files created |
| Carbon MCP Server | ❌ Doesn't Exist | Package not published |
| Carbon Verification | ❌ Not Working | No server to call |
| Generic Code Review | ✅ Works | Non-Carbon findings work |
| Future-Ready | ✅ Yes | Ready when server exists |

**Bottom Line:** The agent is configured for Carbon verification, but the Carbon MCP server doesn't exist yet. The infrastructure is ready for when it does.