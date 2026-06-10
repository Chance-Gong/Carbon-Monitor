/**
 * Carbon MCP Token Refresh - Node.js Example
 * 
 * This example demonstrates how to refresh the Carbon MCP token
 * programmatically using Node.js.
 */

const https = require('https');
const http = require('http');

/**
 * Refresh Carbon MCP token via API
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.apiUrl - API server URL
 * @param {string} options.apiSecret - API authentication secret
 * @param {string} options.token - New Carbon MCP token
 * @param {string} [options.agent='bob'] - Agent type (bob, claude, codex)
 * @param {string[]} [options.repos] - Repository paths
 * @returns {Promise<Object>} - API response
 */
async function refreshCarbonMcpToken(options) {
  const {
    apiUrl,
    apiSecret,
    token,
    agent = 'bob',
    repos = []
  } = options;

  // Validate required parameters
  if (!apiUrl) {
    throw new Error('apiUrl is required');
  }
  if (!apiSecret) {
    throw new Error('apiSecret is required');
  }
  if (!token) {
    throw new Error('token is required');
  }

  // Parse URL
  const url = new URL(apiUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  // Build request payload
  const payload = {
    agent,
    token
  };

  if (repos.length > 0) {
    payload.repos = repos;
  }

  const postData = JSON.stringify(payload);

  // Request options
  const requestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/api/mcp/refresh',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiSecret}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = httpModule.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API request failed (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Get MCP status via API
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.apiUrl - API server URL
 * @param {string} options.apiSecret - API authentication secret
 * @returns {Promise<Object>} - Status information
 */
async function getMcpStatus(options) {
  const { apiUrl, apiSecret } = options;

  if (!apiUrl || !apiSecret) {
    throw new Error('apiUrl and apiSecret are required');
  }

  const url = new URL(apiUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const requestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/api/mcp/status',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiSecret}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = httpModule.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`API request failed (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Example usage
async function main() {
  try {
    // Configuration from environment variables
    const config = {
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      apiSecret: process.env.API_SECRET,
      token: process.env.CARBON_MCP_TOKEN,
      agent: process.env.AGENT || 'bob',
      repos: process.env.REPOS ? process.env.REPOS.split(',') : []
    };

    console.log('Carbon MCP Token Refresh Example');
    console.log('=================================\n');

    // Check current status
    console.log('Checking current MCP status...');
    const statusBefore = await getMcpStatus(config);
    console.log('Status:', JSON.stringify(statusBefore, null, 2));
    console.log('');

    // Refresh token
    console.log('Refreshing Carbon MCP token...');
    const result = await refreshCarbonMcpToken(config);
    console.log('✓ Token refreshed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');

    // Check status after refresh
    console.log('Checking MCP status after refresh...');
    const statusAfter = await getMcpStatus(config);
    console.log('Status:', JSON.stringify(statusAfter, null, 2));
    console.log('');

    console.log('✓ Token refresh complete');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

// Export functions for use as module
module.exports = {
  refreshCarbonMcpToken,
  getMcpStatus
};

// Run if executed directly
if (require.main === module) {
  main();
}

// Made with Bob