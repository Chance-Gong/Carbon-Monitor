#!/usr/bin/env node

/**
 * Test Carbon MCP server directly to see if there are timeout issues
 */

const { spawn } = require('child_process');

async function testMCP() {
  console.log('🧪 Testing Carbon MCP server...\n');
  
  // Start the MCP server
  const mcp = spawn('npx', ['-y', 'carbon-mcp'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';

  mcp.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcp.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log('📝 Server log:', data.toString());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📤 Sending list_carbon_components request...\n');

  // Send a test request
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'list_carbon_components',
      arguments: {
        limit: 5
      }
    }
  };

  mcp.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n📥 Response received:');
  console.log(output);

  if (errorOutput) {
    console.log('\n⚠️  Errors:');
    console.log(errorOutput);
  }

  mcp.kill();
  console.log('\n✅ Test complete');
}

testMCP().catch(console.error);

// Made with Bob
