/******************************************************************************
 * Token Manager for Carbon MCP Integration
 * 
 * Manages Carbon MCP token configuration for Bob CLI and other agents.
 * Handles token refresh, validation, and status checking.
 *****************************************************************************/

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Get Bob's global MCP configuration directory
 */
function getBobMcpConfigDir() {
  return path.join(os.homedir(), '.bob', 'mcp');
}

/**
 * Get Bob's MCP server list file
 */
function getBobMcpServersFile() {
  return path.join(getBobMcpConfigDir(), 'servers.json');
}

/**
 * Execute a command and return output
 */
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: false,
      ...options
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}\nStderr: ${stderr}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to execute command: ${error.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Command timeout'));
    }, 30000);
  });
}

/**
 * Check if Bob CLI is available
 */
async function isBobAvailable() {
  try {
    await execCommand('bob', ['--version']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if carbon-mcp is available
 */
async function isCarbonMcpAvailable() {
  try {
    await execCommand('npx', ['-y', 'carbon-mcp', '--version']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get current Bob MCP configuration
 */
async function getBobMcpConfig() {
  try {
    const serversFile = getBobMcpServersFile();
    const content = await fs.readFile(serversFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { servers: [] };
    }
    throw error;
  }
}

/**
 * Update Bob MCP configuration
 */
async function updateBobMcpConfig(config) {
  const configDir = getBobMcpConfigDir();
  const serversFile = getBobMcpServersFile();

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write configuration
  await fs.writeFile(serversFile, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Refresh Carbon MCP token for Bob CLI
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.agent - Agent type (bob, claude, codex)
 * @param {string} options.token - New Carbon MCP token/API key
 * @param {string[]} [options.repos] - Repository paths for carbon-mcp
 * @returns {Promise<Object>} - Refresh result
 */
async function refreshMcpToken({ agent = 'bob', token, repos }) {
  if (!token) {
    throw new Error('Token is required');
  }

  // Currently only Bob is supported for MCP configuration
  if (agent !== 'bob') {
    throw new Error(`Token refresh not yet implemented for agent: ${agent}`);
  }

  // Check if Bob is available
  const bobAvailable = await isBobAvailable();
  if (!bobAvailable) {
    throw new Error('Bob CLI is not available. Please install it first.');
  }

  // Check if carbon-mcp is available
  const mcpAvailable = await isCarbonMcpAvailable();
  if (!mcpAvailable) {
    throw new Error('carbon-mcp is not available. Please install it first.');
  }

  try {
    // Get current configuration
    const config = await getBobMcpConfig();

    // Find carbon-mcp server entry
    let carbonMcpServer = config.servers?.find(s => s.name === 'carbon-mcp');

    if (!carbonMcpServer) {
      // Add new carbon-mcp server
      carbonMcpServer = {
        name: 'carbon-mcp',
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'carbon-mcp']
      };

      if (!config.servers) {
        config.servers = [];
      }
      config.servers.push(carbonMcpServer);
    }

    // Update environment variables for carbon-mcp
    if (!carbonMcpServer.env) {
      carbonMcpServer.env = {};
    }

    // Set the token (carbon-mcp might use different env var names)
    carbonMcpServer.env.CARBON_MCP_TOKEN = token;
    carbonMcpServer.env.CARBON_API_KEY = token;

    // Add repository paths if provided
    if (repos && repos.length > 0) {
      // Update args to include --repos flag
      const reposArg = `--repos ${repos.join(',')}`;
      if (!carbonMcpServer.args.includes('--repos')) {
        carbonMcpServer.args.push('--repos', repos.join(','));
      } else {
        // Update existing repos arg
        const reposIndex = carbonMcpServer.args.indexOf('--repos');
        if (reposIndex !== -1 && reposIndex + 1 < carbonMcpServer.args.length) {
          carbonMcpServer.args[reposIndex + 1] = repos.join(',');
        }
      }
    }

    // Save updated configuration
    await updateBobMcpConfig(config);

    console.log('✅ Carbon MCP token refreshed successfully');
    console.log(`   Agent: ${agent}`);
    console.log(`   Config: ${getBobMcpServersFile()}`);

    return {
      configPath: getBobMcpServersFile(),
      serverName: 'carbon-mcp',
      updated: true
    };

  } catch (error) {
    console.error('❌ Failed to refresh MCP token:', error.message);
    throw error;
  }
}

/**
 * Get current MCP configuration status
 * 
 * @returns {Promise<Object>} - Status information
 */
async function getMcpStatus() {
  const status = {
    bobAvailable: false,
    carbonMcpAvailable: false,
    configured: false,
    servers: []
  };

  try {
    // Check Bob availability
    status.bobAvailable = await isBobAvailable();

    // Check carbon-mcp availability
    status.carbonMcpAvailable = await isCarbonMcpAvailable();

    // Get Bob MCP configuration
    if (status.bobAvailable) {
      const config = await getBobMcpConfig();
      status.servers = config.servers || [];
      status.configured = status.servers.some(s => s.name === 'carbon-mcp');
      status.configPath = getBobMcpServersFile();
    }

    return status;

  } catch (error) {
    console.error('Error getting MCP status:', error);
    return {
      ...status,
      error: error.message
    };
  }
}

/**
 * Validate Carbon MCP token
 * 
 * @param {string} token - Token to validate
 * @returns {Promise<boolean>} - True if token is valid
 */
async function validateMcpToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Basic validation - check format
  // Carbon MCP tokens might have specific format requirements
  if (token.length < 10) {
    return false;
  }

  // TODO: Add actual token validation by calling carbon-mcp
  // For now, just check basic format
  return true;
}

/**
 * Remove Carbon MCP configuration
 * 
 * @param {string} agent - Agent type (bob, claude, codex)
 * @returns {Promise<Object>} - Removal result
 */
async function removeMcpConfig(agent = 'bob') {
  if (agent !== 'bob') {
    throw new Error(`Config removal not yet implemented for agent: ${agent}`);
  }

  try {
    const config = await getBobMcpConfig();

    if (!config.servers) {
      return { removed: false, message: 'No servers configured' };
    }

    // Remove carbon-mcp server
    const originalLength = config.servers.length;
    config.servers = config.servers.filter(s => s.name !== 'carbon-mcp');

    if (config.servers.length === originalLength) {
      return { removed: false, message: 'carbon-mcp not found in configuration' };
    }

    // Save updated configuration
    await updateBobMcpConfig(config);

    console.log('✅ Carbon MCP configuration removed');

    return {
      removed: true,
      configPath: getBobMcpServersFile()
    };

  } catch (error) {
    console.error('❌ Failed to remove MCP config:', error.message);
    throw error;
  }
}

module.exports = {
  refreshMcpToken,
  getMcpStatus,
  validateMcpToken,
  removeMcpConfig,
  isBobAvailable,
  isCarbonMcpAvailable,
  getBobMcpConfig
};

// Made with Bob