#!/usr/bin/env node
/**
 * Create Test PR from Carbon PR
 * 
 * This script helps you create a test PR in your own repository
 * based on a Carbon PR, so you can run the review agent locally
 * and see comments/reviews without affecting the Carbon repository.
 * 
 * Usage:
 *   node examples/create-test-pr.js <CARBON_PR_NUMBER>
 * 
 * What it does:
 * 1. Fetches the Carbon PR diff
 * 2. Creates a new branch in your local repo
 * 3. Applies the changes from the Carbon PR
 * 4. Pushes to your GitHub repository
 * 5. Creates a PR in your repo
 * 6. You can then run the review agent on YOUR PR
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createGitHubClient } = require('../src/githubClient');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CARBON_OWNER = 'carbon-design-system';
const CARBON_REPO = 'carbon';

/**
 * Execute a git command
 */
function git(command) {
  try {
    const result = execSync(`git ${command}`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim();
  } catch (error) {
    throw new Error(`Git command failed: ${command}\n${error.message}`);
  }
}

/**
 * Check if we're in a git repository
 */
function isGitRepo() {
  try {
    git('rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current git remote
 */
function getRemoteInfo() {
  try {
    const remoteUrl = git('config --get remote.origin.url');
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Create a test PR from a Carbon PR
 */
async function createTestPR(carbonPRNumber) {
  console.log('\n🔧 Creating Test PR from Carbon PR #' + carbonPRNumber);
  console.log('='.repeat(80) + '\n');

  // Check environment
  if (!process.env.GITHUB_AI_AGENT_TOKEN) {
    console.error('❌ Error: GITHUB_AI_AGENT_TOKEN not set in .env file');
    process.exit(1);
  }

  // Check if we're in a git repo
  if (!isGitRepo()) {
    console.error('❌ Error: Not in a git repository');
    console.error('   Please run this from your git repository root');
    process.exit(1);
  }

  // Get remote info
  const remote = getRemoteInfo();
  if (!remote) {
    console.error('❌ Error: Could not determine GitHub repository');
    console.error('   Make sure you have a GitHub remote configured');
    process.exit(1);
  }

  console.log(`📍 Your repository: ${remote.owner}/${remote.repo}\n`);

  // Create GitHub client
  const octokit = new Octokit({
    auth: process.env.GITHUB_AI_AGENT_TOKEN
  });
  const client = createGitHubClient(octokit);

  try {
    // Step 1: Fetch Carbon PR
    console.log('📥 Step 1: Fetching Carbon PR #' + carbonPRNumber + '...');
    const { data: carbonPR } = await octokit.rest.pulls.get({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pull_number: carbonPRNumber
    });
    console.log(`   ✅ ${carbonPR.title}`);
    console.log(`   👤 by @${carbonPR.user.login}\n`);

    // Step 2: Fetch diff
    console.log('📄 Step 2: Fetching diff...');
    const diff = await client.fetchPRDiff({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pullNumber: carbonPRNumber
    });
    console.log(`   ✅ Diff size: ${diff.length} characters\n`);

    // Step 3: Fetch files
    console.log('📁 Step 3: Fetching changed files...');
    const files = await client.fetchPRFiles({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pullNumber: carbonPRNumber
    });
    console.log(`   ✅ ${files.length} files changed\n`);

    // Step 4: Create branch
    const branchName = `test-carbon-pr-${carbonPRNumber}`;
    console.log(`🌿 Step 4: Creating branch '${branchName}'...`);
    
    try {
      // Make sure we're on main/master
      const currentBranch = git('rev-parse --abbrev-ref HEAD');
      if (currentBranch !== 'main' && currentBranch !== 'master') {
        console.log(`   ⚠️  Currently on '${currentBranch}', switching to main...`);
        try {
          git('checkout main');
        } catch {
          git('checkout master');
        }
      }
      
      // Delete branch if it exists
      try {
        git(`branch -D ${branchName}`);
        console.log(`   🗑️  Deleted existing branch`);
      } catch {
        // Branch doesn't exist, that's fine
      }
      
      // Create new branch
      git(`checkout -b ${branchName}`);
      console.log(`   ✅ Created and switched to '${branchName}'\n`);
    } catch (error) {
      console.error(`   ❌ Error creating branch: ${error.message}`);
      process.exit(1);
    }

    // Step 5: Save diff to file
    console.log('💾 Step 5: Saving diff to file...');
    const diffPath = path.join(process.cwd(), 'carbon-pr-diff.patch');
    fs.writeFileSync(diffPath, diff);
    console.log(`   ✅ Saved to: ${diffPath}\n`);

    // Step 6: Create test files
    console.log('📝 Step 6: Creating test files...');
    const testDir = path.join(process.cwd(), 'carbon-pr-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a summary file
    const summaryPath = path.join(testDir, `PR-${carbonPRNumber}-summary.md`);
    const summary = `# Test PR from Carbon #${carbonPRNumber}

## Original PR
- **Title**: ${carbonPR.title}
- **Author**: @${carbonPR.user.login}
- **URL**: ${carbonPR.html_url}
- **Status**: ${carbonPR.state}

## Changes
- **Files**: ${files.length}
- **Additions**: +${carbonPR.additions}
- **Deletions**: -${carbonPR.deletions}

## Description
${carbonPR.body || 'No description provided'}

## Files Changed
${files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

## Testing Instructions
1. Review the changes in this PR
2. Run the review agent: \`npm start\`
3. Check the comments and review summary
4. All reviews will be posted to YOUR repository, not Carbon's

## Diff
The full diff is available in: \`carbon-pr-diff.patch\`
`;

    fs.writeFileSync(summaryPath, summary);
    console.log(`   ✅ Created summary: ${summaryPath}`);

    // Create sample files to demonstrate the changes
    files.slice(0, 3).forEach((file, index) => {
      const fileName = path.basename(file.filename);
      const testFilePath = path.join(testDir, `${index + 1}-${fileName}`);
      const content = `// Sample from Carbon PR #${carbonPRNumber}
// Original file: ${file.filename}
// Status: ${file.status}
// Changes: +${file.additions}/-${file.deletions}

${file.patch || '// No patch available'}
`;
      fs.writeFileSync(testFilePath, content);
      console.log(`   ✅ Created: ${testFilePath}`);
    });

    console.log('');

    // Step 7: Commit changes
    console.log('💾 Step 7: Committing changes...');
    git('add .');
    git(`commit -m "Test PR from Carbon #${carbonPRNumber}: ${carbonPR.title}"`);
    console.log(`   ✅ Changes committed\n`);

    // Step 8: Push to GitHub
    console.log('📤 Step 8: Pushing to GitHub...');
    console.log(`   Pushing to: ${remote.owner}/${remote.repo}`);
    try {
      git(`push -u origin ${branchName}`);
      console.log(`   ✅ Pushed to origin/${branchName}\n`);
    } catch (error) {
      console.error(`   ❌ Error pushing: ${error.message}`);
      console.error('   You may need to push manually:');
      console.error(`   git push -u origin ${branchName}\n`);
    }

    // Step 9: Create PR
    console.log('🎯 Step 9: Creating PR in your repository...');
    try {
      const { data: newPR } = await octokit.rest.pulls.create({
        owner: remote.owner,
        repo: remote.repo,
        title: `[Test] ${carbonPR.title}`,
        head: branchName,
        base: 'main',
        body: `# Test PR from Carbon Design System

This is a test PR created from Carbon PR #${carbonPRNumber} for local review testing.

**Original Carbon PR**: ${carbonPR.html_url}

## Purpose
This PR allows you to run the review agent locally and see comments/reviews in YOUR repository without affecting the Carbon repository.

## Original PR Details
${summary}

## How to Review
1. Run the review agent: \`npm start\`
2. The agent will post comments and reviews to THIS PR
3. All activity stays in your repository

## Cleanup
After testing, you can safely delete this PR and branch.
`
      });

      console.log(`   ✅ PR created successfully!\n`);
      console.log('='.repeat(80));
      console.log('🎉 SUCCESS! Your test PR is ready!\n');
      console.log(`📌 PR #${newPR.number}: ${newPR.title}`);
      console.log(`🔗 URL: ${newPR.html_url}\n`);
      console.log('Next steps:');
      console.log('1. Update your .env file:');
      console.log(`   GITHUB_AI_AGENT_OWNER=${remote.owner}`);
      console.log(`   GITHUB_AI_AGENT_REPO=${remote.repo}`);
      console.log('');
      console.log('2. Run the review agent:');
      console.log('   npm start');
      console.log('');
      console.log('3. Check your PR for comments and reviews!');
      console.log(`   ${newPR.html_url}\n`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      if (error.status === 422) {
        console.error('   ❌ Error: Could not create PR');
        console.error('   This might be because:');
        console.error('   - A PR already exists for this branch');
        console.error('   - The base branch (main) does not exist');
        console.error('   - There are no changes to create a PR\n');
        console.error('   You can still manually create a PR at:');
        console.error(`   https://github.com/${remote.owner}/${remote.repo}/compare/${branchName}\n`);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.status === 404) {
      console.error(`   Carbon PR #${carbonPRNumber} not found`);
    }
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const carbonPRNumber = process.argv[2];

  if (!carbonPRNumber) {
    console.log('\n📚 Create Test PR from Carbon PR\n');
    console.log('Usage:');
    console.log('  node examples/create-test-pr.js <CARBON_PR_NUMBER>\n');
    console.log('Example:');
    console.log('  node examples/create-test-pr.js 22425\n');
    console.log('This will:');
    console.log('  1. Fetch the Carbon PR');
    console.log('  2. Create a branch in YOUR repository');
    console.log('  3. Create test files based on the Carbon PR');
    console.log('  4. Push to YOUR GitHub');
    console.log('  5. Create a PR in YOUR repository');
    console.log('  6. You can then run the review agent on YOUR PR\n');
    console.log('💡 First, browse available PRs:');
    console.log('   node examples/fetch-carbon-pr.js\n');
    process.exit(0);
  }

  await createTestPR(parseInt(carbonPRNumber));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { createTestPR };

// Made with Bob
