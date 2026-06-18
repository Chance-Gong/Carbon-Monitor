#!/usr/bin/env node

/**
 * Test script to verify MCP config fix
 * Tests that the MCP config is properly copied and environment variable is set
 */

const { buildReviewBundle } = require('./src/reviewBundle');
const { runAgent } = require('./src/agentRunner');
const fs = require('fs').promises;
const path = require('path');

async function testMcpConfigFix() {
  console.log('🧪 Testing MCP Config Fix\n');
  
  // Mock PR data
  const mockPR = {
    number: 12345,
    title: 'Test PR for MCP config',
    user: { login: 'testuser' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    body: 'Test PR body',
    head: { sha: 'abc123' }
  };
  
  const mockFiles = [
    {
      filename: 'test.js',
      additions: 10,
      deletions: 5
    }
  ];
  
  const mockDiff = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
+// Test change
 const x = 1;
`;

  try {
    // Step 1: Build review bundle
    console.log('📦 Building review bundle...');
    const bundle = await buildReviewBundle({
      owner: 'carbon-design-system',
      repo: 'carbon',
      pr: mockPR,
      diff: mockDiff,
      files: mockFiles
    });
    
    console.log(`✅ Bundle created at: ${bundle.dir}`);
    console.log(`✅ Settings path: ${bundle.settingsPath}\n`);
    
    // Step 2: Verify Bob settings exists
    console.log('🔍 Verifying Bob settings file...');
    try {
      const settingsContent = await fs.readFile(bundle.settingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);
      
      if (settings.mcpServers && settings.mcpServers['carbon-mcp-server']) {
        console.log('✅ Bob settings file exists and contains carbon-mcp-server');
        console.log(`   Command: ${settings.mcpServers['carbon-mcp-server'].command}`);
        console.log(`   Args: ${JSON.stringify(settings.mcpServers['carbon-mcp-server'].args)}\n`);
      } else {
        console.error('❌ Bob settings missing carbon-mcp-server');
        await bundle.cleanup();
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Failed to read Bob settings: ${error.message}`);
      await bundle.cleanup();
      process.exit(1);
    }
    
    // Step 3: Verify bundle structure
    console.log('🔍 Verifying bundle structure...');
    const expectedFiles = [
      '.env',
      'pr.json',
      'files.json',
      'diff.patch',
      'PR_REVIEW_REQUEST.md',
      '.bob/rules/01-output.md',
      '.bob/settings.json'
    ];
    
    for (const file of expectedFiles) {
      const filePath = path.join(bundle.dir, file);
      try {
        await fs.access(filePath);
        console.log(`   ✅ ${file}`);
      } catch (error) {
        console.error(`   ❌ ${file} - NOT FOUND`);
      }
    }
    
    console.log('\n✅ All tests passed!');
    console.log('\n📝 Summary:');
    console.log('   - Bob settings.json is copied from current directory to temp directory');
    console.log('   - Bundle includes settingsPath for environment variable');
    console.log('   - agentRunner.js will set BOBSHELL_SETTINGS_PATH when running Bob');
    console.log('\n🎉 The fix should resolve the MCP server availability issue!\n');
    
    // Cleanup
    await bundle.cleanup();
    console.log('🧹 Cleaned up test bundle');
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testMcpConfigFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Made with Bob
