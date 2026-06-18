#!/usr/bin/env node

/**
 * Test script to verify carbon-mcp setup for Bob Shell
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Checking carbon-mcp setup for Bob Shell...\n');

// Check global settings
const globalSettingsPath = path.join(os.homedir(), '.bob', 'settings.json');
console.log(`1. Checking global settings: ${globalSettingsPath}`);

try {
  const globalSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
  if (globalSettings.mcpServers && globalSettings.mcpServers['carbon-mcp-server']) {
    console.log('   ✅ Global settings configured with carbon-mcp-server');
    console.log(`   Command: ${globalSettings.mcpServers['carbon-mcp-server'].command}`);
    console.log(`   Args: ${globalSettings.mcpServers['carbon-mcp-server'].args.join(' ')}`);
  } else {
    console.log('   ❌ carbon-mcp-server not found in global settings');
  }
} catch (error) {
  console.log(`   ❌ Error reading global settings: ${error.message}`);
}

// Check project settings
const projectSettingsPath = path.join(process.cwd(), '.bob', 'settings.json');
console.log(`\n2. Checking project settings: ${projectSettingsPath}`);

try {
  const projectSettings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8'));
  if (projectSettings.mcpServers && projectSettings.mcpServers['carbon-mcp-server']) {
    console.log('   ✅ Project settings configured with carbon-mcp-server');
  } else {
    console.log('   ⚠️  carbon-mcp-server not found in project settings (global will be used)');
  }
} catch (error) {
  console.log(`   ⚠️  No project settings found (global will be used)`);
}

// Check if npx is available
console.log('\n3. Checking npx availability...');
const { execSync } = require('child_process');
try {
  const npxVersion = execSync('npx --version', { encoding: 'utf8' }).trim();
  console.log(`   ✅ npx is available (version ${npxVersion})`);
} catch (error) {
  console.log('   ❌ npx is not available');
}

console.log('\n✅ Setup verification complete!');
console.log('\n📝 Next steps:');
console.log('   1. Restart Bob Shell to load the configuration');
console.log('   2. Run a PR review to test carbon-mcp integration');
console.log('   3. Check that findings show "MCP-verified" instead of "Model memory fallback"');

// Made with Bob
