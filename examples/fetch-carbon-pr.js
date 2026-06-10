#!/usr/bin/env node
/**
 * Interactive Carbon PR Fetcher
 * 
 * This script demonstrates how to fetch and explore PRs from the
 * carbon-design-system/carbon repository using the GitHub API.
 * 
 * Usage:
 *   node examples/fetch-carbon-pr.js [PR_NUMBER]
 * 
 * If no PR number is provided, it will list recent open PRs.
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createGitHubClient } = require('../src/githubClient');

const CARBON_OWNER = 'carbon-design-system';
const CARBON_REPO = 'carbon';

/**
 * Display PR information in a readable format
 */
function displayPRInfo(pr) {
  console.log('\n' + '='.repeat(80));
  console.log(`📌 PR #${pr.number}: ${pr.title}`);
  console.log('='.repeat(80));
  console.log(`👤 Author: @${pr.user.login}`);
  console.log(`📅 Created: ${new Date(pr.created_at).toLocaleDateString()}`);
  console.log(`📅 Updated: ${new Date(pr.updated_at).toLocaleDateString()}`);
  console.log(`🔗 URL: ${pr.html_url}`);
  console.log(`📊 Status: ${pr.state} ${pr.draft ? '(Draft)' : ''}`);
  console.log(`💬 Comments: ${pr.comments}`);
  console.log(`✅ Additions: +${pr.additions || 0}`);
  console.log(`❌ Deletions: -${pr.deletions || 0}`);
  console.log(`📝 Changed Files: ${pr.changed_files || 0}`);
  
  if (pr.labels && pr.labels.length > 0) {
    console.log(`🏷️  Labels: ${pr.labels.map(l => l.name).join(', ')}`);
  }
  
  if (pr.body) {
    console.log('\n📄 Description:');
    console.log('-'.repeat(80));
    // Truncate long descriptions
    const description = pr.body.length > 500 
      ? pr.body.substring(0, 500) + '...\n[Description truncated]'
      : pr.body;
    console.log(description);
  }
  console.log('='.repeat(80) + '\n');
}

/**
 * Display file changes in a PR
 */
function displayFileChanges(files) {
  console.log('\n📁 Changed Files:');
  console.log('-'.repeat(80));
  
  files.forEach((file, index) => {
    const status = file.status === 'added' ? '🆕' : 
                   file.status === 'removed' ? '🗑️' : 
                   file.status === 'modified' ? '✏️' : '📝';
    
    console.log(`${index + 1}. ${status} ${file.filename}`);
    console.log(`   +${file.additions} -${file.deletions} (${file.changes} changes)`);
    
    if (file.patch) {
      console.log(`   Preview: ${file.patch.split('\n').slice(0, 3).join('\n   ')}`);
      if (file.patch.split('\n').length > 3) {
        console.log('   ...');
      }
    }
    console.log('');
  });
}

/**
 * Display diff preview
 */
function displayDiffPreview(diff) {
  console.log('\n📄 Diff Preview (first 50 lines):');
  console.log('-'.repeat(80));
  
  const lines = diff.split('\n').slice(0, 50);
  lines.forEach(line => {
    if (line.startsWith('+')) {
      console.log(`\x1b[32m${line}\x1b[0m`); // Green
    } else if (line.startsWith('-')) {
      console.log(`\x1b[31m${line}\x1b[0m`); // Red
    } else if (line.startsWith('@@')) {
      console.log(`\x1b[36m${line}\x1b[0m`); // Cyan
    } else {
      console.log(line);
    }
  });
  
  if (diff.split('\n').length > 50) {
    console.log('\n[Diff truncated - showing first 50 lines]');
  }
  console.log('-'.repeat(80) + '\n');
}

/**
 * List recent open PRs
 */
async function listRecentPRs(client) {
  console.log('\n🔍 Fetching recent open PRs from carbon-design-system/carbon...\n');
  
  const prs = await client.fetchReviewablePRs({
    owner: CARBON_OWNER,
    repo: CARBON_REPO,
    daysBack: 30,
    label: 'NonExistentLabel' // Don't filter by label
  });
  
  if (prs.length === 0) {
    console.log('No open PRs found.');
    return;
  }
  
  console.log(`Found ${prs.length} open PR(s):\n`);
  
  prs.slice(0, 10).forEach((pr, index) => {
    console.log(`${index + 1}. PR #${pr.number}: ${pr.title}`);
    console.log(`   👤 @${pr.user.login} | 📅 ${new Date(pr.created_at).toLocaleDateString()}`);
    console.log(`   🔗 ${pr.html_url}\n`);
  });
  
  if (prs.length > 10) {
    console.log(`... and ${prs.length - 10} more PRs\n`);
  }
  
  console.log('\n💡 To fetch details for a specific PR, run:');
  console.log(`   node examples/fetch-carbon-pr.js ${prs[0].number}\n`);
}

/**
 * Fetch and display a specific PR
 */
async function fetchSpecificPR(client, prNumber) {
  console.log(`\n🔍 Fetching PR #${prNumber} from carbon-design-system/carbon...\n`);
  
  try {
    // Fetch PR details
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({
      auth: process.env.GITHUB_AI_AGENT_TOKEN
    });
    
    const { data: pr } = await octokit.rest.pulls.get({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pull_number: prNumber
    });
    
    displayPRInfo(pr);
    
    // Fetch changed files
    console.log('📁 Fetching changed files...');
    const files = await client.fetchPRFiles({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pullNumber: prNumber
    });
    
    displayFileChanges(files);
    
    // Fetch diff
    console.log('📄 Fetching diff...');
    const diff = await client.fetchPRDiff({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pullNumber: prNumber
    });
    
    console.log(`✅ Diff size: ${diff.length} characters`);
    displayDiffPreview(diff);
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   • PR #${pr.number}: ${pr.title}`);
    console.log(`   • Files changed: ${files.length}`);
    console.log(`   • Total changes: +${pr.additions} -${pr.deletions}`);
    console.log(`   • Diff size: ${diff.length} characters`);
    console.log(`   • URL: ${pr.html_url}\n`);
    
    console.log('✅ PR data fetched successfully!\n');
    console.log('💡 You can now use this data for:');
    console.log('   • Code review analysis');
    console.log('   • Carbon Design System verification');
    console.log('   • Automated testing');
    console.log('   • Documentation generation\n');
    
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ PR #${prNumber} not found in ${CARBON_OWNER}/${CARBON_REPO}`);
    } else {
      console.error(`❌ Error fetching PR: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  // Check for GitHub token
  if (!process.env.GITHUB_AI_AGENT_TOKEN) {
    console.error('\n❌ Error: GITHUB_AI_AGENT_TOKEN not set');
    console.error('\n📝 Please create a .env file with your GitHub token:');
    console.error('   GITHUB_AI_AGENT_TOKEN=ghp_your_token_here\n');
    console.error('💡 Get a token at: https://github.com/settings/tokens\n');
    process.exit(1);
  }
  
  // Create GitHub client
  const octokit = new Octokit({
    auth: process.env.GITHUB_AI_AGENT_TOKEN
  });
  const client = createGitHubClient(octokit);
  
  // Get PR number from command line
  const prNumber = process.argv[2];
  
  if (prNumber) {
    // Fetch specific PR
    await fetchSpecificPR(client, parseInt(prNumber));
  } else {
    // List recent PRs
    await listRecentPRs(client);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { fetchSpecificPR, listRecentPRs };

// Made with Bob
