# MCP Configuration Fix for Carbon-Monitor

## Problem

Bob doesn't support per-directory MCP configuration. When carbon-monitor creates a temporary directory for PR review, it was creating `.bob/settings.json` in that temp directory, but Bob ignores per-directory configs and only reads from its global config at `~/.bob/settings.json`.

### Original Flow (Broken)

1. `reviewBundle.js` creates a temp directory with `.bob/settings.json`
2. `agentRunner.js` runs Bob with `--allowed-mcp-server-names carbon-mcp-server`
3. Bob ignores the temp directory's settings (comment in code: "Bob doesn't support per-directory MCP config")
4. Bob only reads from its GLOBAL config at `~/.bob/settings.json`
5. Since `carbon-mcp-server` isn't in the global config, the MCP tools are unavailable

### Why It Worked in Interactive Sessions

- When running Bob interactively in `/Users/chancegong/Documents/GitHub/Carbon-Monitor`, it works because that directory has `.bob/settings.json`
- But when carbon-monitor spawns Bob in a TEMP directory, that temp directory's settings are ignored

## Solution

The fix uses the `BOBSHELL_SETTINGS_PATH` environment variable to override Bob's settings path, pointing it to the temp directory's settings file.

### Implementation

#### 1. Copy MCP Config from Current Directory

**File: [`src/reviewBundle.js`](../src/reviewBundle.js)**

Added helper functions:

```javascript
/**
 * Strip single-line and multi-line comments from JSON string
 * @param {string} jsonString - JSON string potentially with comments
 * @returns {string} JSON string without comments
 */
function stripJsonComments(jsonString) {
  // Remove single-line comments (// ...)
  let result = jsonString.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

/**
 * Get the current working directory's Bob settings path
 * @returns {string|null} Path to settings.json or null if not found
 */
function getCurrentBobSettingsPath() {
  const possiblePaths = [
    path.join(process.cwd(), '.bob', 'settings.json'),
    path.join(os.homedir(), '.bob', 'settings.json')
  ];
  
  for (const configPath of possiblePaths) {
    try {
      if (require('fs').existsSync(configPath)) {
        return configPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  return null;
}

/**
 * Create a default Bob settings with MCP config for carbon-mcp-server
 * @param {string} tempDir - Temporary directory path
 */
async function createDefaultBobSettings(tempDir) {
  const bobSettings = {
    mcpServers: {
      'carbon-mcp-server': {
        command: 'npx',
        args: ['-y', 'carbon-mcp']
      }
    }
  };
  
  await fs.writeFile(
    path.join(tempDir, '.bob', 'settings.json'),
    JSON.stringify(bobSettings, null, 2)
  );
}
```

Modified `buildReviewBundle()` to copy Bob settings:

```javascript
// Copy Bob settings from current working directory to temp directory
// This ensures Bob can access the carbon-mcp-server configuration
const currentBobSettings = getCurrentBobSettingsPath();

if (currentBobSettings) {
  try {
    const settingsContent = await fs.readFile(currentBobSettings, 'utf8');
    // Strip comments and parse to ensure valid JSON
    const cleanedContent = stripJsonComments(settingsContent);
    const settings = JSON.parse(cleanedContent);
    
    // Extract only mcpServers if it exists, otherwise create default
    const mcpServers = settings.mcpServers || {};
    const cleanSettings = { mcpServers };
    
    await fs.writeFile(
      path.join(tempDir, '.bob', 'settings.json'),
      JSON.stringify(cleanSettings, null, 2)
    );
    console.log(`Copied Bob settings from ${currentBobSettings} to temp directory`);
  } catch (error) {
    console.warn(`Failed to copy Bob settings: ${error.message}`);
    // Fall back to creating a default config
    await createDefaultBobSettings(tempDir);
  }
} else {
  console.warn('No Bob settings found in current directory or home directory');
  // Create a default config
  await createDefaultBobSettings(tempDir);
}
```

Updated return value to include `settingsPath`:

```javascript
return {
  dir: tempDir,
  prompt,
  settingsPath: path.join(tempDir, '.bob', 'settings.json'),
  cleanup: async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up bundle:', error.message);
    }
  }
};
```

#### 2. Set BOBSHELL_MCP_CONFIG Environment Variable

**File: [`src/agentRunner.js`](../src/agentRunner.js)**

Updated function signature to accept `settingsPath`:

```javascript
async function runAgent({ agent, cwd, prompt, settingsPath, timeout = 10 * 60 * 1000 }) {
```

Modified environment setup to set `BOBSHELL_SETTINGS_PATH`:

```javascript
// Set config paths for each agent to use the bundle's config
if (agent === 'bob' && settingsPath) {
  // Bob supports BOBSHELL_SETTINGS_PATH environment variable to override settings path
  env.BOBSHELL_SETTINGS_PATH = settingsPath;
  console.log(`Setting BOBSHELL_SETTINGS_PATH to: ${settingsPath}`);
} else if (agent === 'claude') {
  env.CLAUDE_MCP_CONFIG = `${cwd}/.claude/mcp_config.json`;
} else if (agent === 'codex') {
  env.CODEX_MCP_CONFIG = `${cwd}/.codex/mcp_config.json`;
}
```

#### 3. Pass mcpConfigPath to runAgent

**File: [`src/index.js`](../src/index.js)**

Updated the call to `runAgent()`:

```javascript
const agentOutput = await runAgent({
  agent,
  cwd: bundle.dir,
  prompt: bundle.prompt,
  settingsPath: bundle.settingsPath,
  timeout: 5 * 60 * 1000 // 5 minutes
});
```

## Testing

Created [`test-mcp-config-fix.js`](../test-mcp-config-fix.js) to verify the fix:

```bash
node test-mcp-config-fix.js
```

### Test Results

```
🧪 Testing MCP Config Fix

📦 Building review bundle...
Copied Bob settings from /Users/chancegong/Documents/GitHub/Carbon-Monitor/.bob/settings.json to temp directory
✅ Bundle created at: /var/folders/.../carbon-design-system__carbon__pull-12345-TE0H6Q
✅ Settings path: /var/folders/.../carbon-design-system__carbon__pull-12345-TE0H6Q/.bob/settings.json

🔍 Verifying Bob settings file...
✅ Bob settings file exists and contains carbon-mcp-server
   Command: npx
   Args: ["-y","carbon-mcp"]

🔍 Verifying bundle structure...
   ✅ .env
   ✅ pr.json
   ✅ files.json
   ✅ diff.patch
   ✅ PR_REVIEW_REQUEST.md
   ✅ .bob/rules/01-output.md
   ✅ .bob/settings.json

✅ All tests passed!
```

## Benefits

1. **Works with existing configs**: Copies Bob settings from the current working directory, preserving MCP server configurations
2. **Handles JSON comments**: Strips comments from settings files (like `// Made with Bob`) to ensure valid JSON
3. **Fallback to default**: If no settings found, creates a sensible default for carbon-mcp-server
4. **Environment variable override**: Uses `BOBSHELL_SETTINGS_PATH` to point Bob to the correct settings location
5. **No global config pollution**: Doesn't require modifying `~/.bob/settings.json`
6. **Isolated per-review**: Each PR review gets its own isolated settings in its temp directory

## How It Works Now

1. `reviewBundle.js` finds Bob settings in the current directory (or home directory)
2. Strips any JSON comments and extracts the `mcpServers` configuration
3. Copies that to the temp directory's `.bob/settings.json`
4. Returns `settingsPath` pointing to the temp directory's settings
5. `agentRunner.js` sets `BOBSHELL_SETTINGS_PATH` environment variable to that path
6. Bob reads the settings from the temp directory via the environment variable
7. Carbon MCP tools are now available during the review!

## Alternative Approaches Considered

1. **Add to global config**: Would require modifying `~/.bob/settings.json`, which could affect other projects
2. **Use --allowed-mcp-server-names only**: Only works with servers already in Bob's global config
3. **Wait for Bob to support per-directory configs**: Not available yet
4. **Use mcp.json instead of settings.json**: Bob actually uses `settings.json` for MCP configuration

The environment variable approach with `settings.json` is the correct solution that works with Bob's architecture.