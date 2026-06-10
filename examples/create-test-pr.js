#!/usr/bin/env node
/**
 * Create Test PR in carbon-pr-review-test Repository
 * 
 * This script creates a test PR in Chance-Gong/carbon-pr-review-test
 * based on a Carbon PR, so you can run the review agent locally.
 * 
 * Usage:
 *   node examples/create-test-pr.js <CARBON_PR_NUMBER>
 * 
 * Example:
 *   node examples/create-test-pr.js 22425
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createGitHubClient } = require('../src/githubClient');

const CARBON_OWNER = 'carbon-design-system';
const CARBON_REPO = 'carbon';
const TEST_OWNER = 'Chance-Gong';
const TEST_REPO = 'carbon-pr-review-test';

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

  console.log(`📍 Target repository: ${TEST_OWNER}/${TEST_REPO}\n`);

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

    // Step 4: Get default branch of test repo
    console.log('� Step 4: Getting test repository info...');
    const { data: testRepo } = await octokit.rest.repos.get({
      owner: TEST_OWNER,
      repo: TEST_REPO
    });
    const baseBranch = testRepo.default_branch;
    console.log(`   ✅ Base branch: ${baseBranch}\n`);

    // Step 5: Get base branch SHA
    console.log('🔍 Step 5: Getting base branch SHA...');
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      ref: `heads/${baseBranch}`
    });
    const baseSha = baseRef.object.sha;
    console.log(`   ✅ Base SHA: ${baseSha.substring(0, 7)}\n`);

    // Step 6: Create new branch
    const branchName = `test-carbon-pr-${carbonPRNumber}`;
    console.log(`🌿 Step 6: Creating branch '${branchName}'...`);
    
    try {
      // Try to delete existing branch first
      try {
        await octokit.rest.git.deleteRef({
          owner: TEST_OWNER,
          repo: TEST_REPO,
          ref: `heads/${branchName}`
        });
        console.log(`   🗑️  Deleted existing branch`);
      } catch {
        // Branch doesn't exist, that's fine
      }

      // Create new branch
      await octokit.rest.git.createRef({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      });
      console.log(`   ✅ Created branch '${branchName}'\n`);
    } catch (error) {
      console.error(`   ❌ Error creating branch: ${error.message}`);
      process.exit(1);
    }

    // Step 7: Create test files
    console.log('📝 Step 7: Creating test files...');

    // Create summary file
    const summaryContent = `# Test PR from Carbon #${carbonPRNumber}

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
4. All reviews will be posted to this repository

---
*This is a test PR created from Carbon Design System for local review testing.*
`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      path: `carbon-pr-test/PR-${carbonPRNumber}-summary.md`,
      message: `Add summary for Carbon PR #${carbonPRNumber}`,
      content: Buffer.from(summaryContent).toString('base64'),
      branch: branchName
    });
    console.log(`   ✅ Created summary file`);

    // Create sample files from the Carbon PR
    for (let i = 0; i < Math.min(3, files.length); i++) {
      const file = files[i];
      const fileName = file.filename.split('/').pop(); // Get just the filename
      const sampleContent = `// Sample from Carbon PR #${carbonPRNumber}
// Original file: ${file.filename}
// Status: ${file.status}
// Changes: +${file.additions}/-${file.deletions}

${file.patch || '// No patch available'}
`;

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        path: `carbon-pr-test/${i + 1}-${fileName}`,
        message: `Add sample file ${i + 1} from Carbon PR #${carbonPRNumber}`,
        content: Buffer.from(sampleContent).toString('base64'),
        branch: branchName
      });
      console.log(`   ✅ Created sample file: ${fileName}`);
    }

    // Save diff file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      path: `carbon-pr-test/carbon-pr-${carbonPRNumber}.patch`,
      message: `Add diff from Carbon PR #${carbonPRNumber}`,
      content: Buffer.from(diff).toString('base64'),
      branch: branchName
    });
    console.log(`   ✅ Created diff file\n`);

    // Step 8: Create PR
    console.log('🎯 Step 8: Creating PR...');
    try {
      const { data: newPR } = await octokit.rest.pulls.create({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        title: `[Test] ${carbonPR.title}`,
        head: branchName,
        base: baseBranch,
        body: `# Test PR from Carbon Design System

This is a test PR created from Carbon PR #${carbonPRNumber} for local review testing.

**Original Carbon PR**: ${carbonPR.html_url}

## Purpose
This PR allows you to run the review agent locally and see comments/reviews in this test repository without affecting the Carbon repository.

## Original PR Details
- **Title**: ${carbonPR.title}
- **Author**: @${carbonPR.user.login}
- **Files Changed**: ${files.length}
- **Changes**: +${carbonPR.additions}/-${carbonPR.deletions}

## How to Review
1. Update your \`.env\` file:
   \`\`\`
   GITHUB_AI_AGENT_OWNER=${TEST_OWNER}
   GITHUB_AI_AGENT_REPO=${TEST_REPO}
   \`\`\`

2. Run the review agent:
   \`\`\`bash
   npm start
   \`\`\`

3. The agent will post comments and reviews to THIS PR

## Files in This PR
${files.slice(0, 5).map(f => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join('\n')}
${files.length > 5 ? `\n... and ${files.length - 5} more files` : ''}

## Cleanup
After testing, you can safely delete this PR and branch.

---
*Created from: ${carbonPR.html_url}*
`
      });

      console.log(`   ✅ PR created successfully!\n`);
      console.log('='.repeat(80));
      console.log('🎉 SUCCESS! Your test PR is ready!\n');
      console.log(`📌 PR #${newPR.number}: ${newPR.title}`);
      console.log(`🔗 URL: ${newPR.html_url}\n`);
      console.log('Next steps:');
      console.log('1. Update your .env file:');
      console.log(`   GITHUB_AI_AGENT_OWNER=${TEST_OWNER}`);
      console.log(`   GITHUB_AI_AGENT_REPO=${TEST_REPO}`);
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
        console.error('   - There are no changes to create a PR\n');
        console.error('   You can view existing PRs at:');
        console.error(`   https://github.com/${TEST_OWNER}/${TEST_REPO}/pulls\n`);
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
    console.log('\n📚 Create Test PR in carbon-pr-review-test\n');
    console.log('Usage:');
    console.log('  node examples/create-test-pr.js <CARBON_PR_NUMBER>\n');
    console.log('Example:');
    console.log('  node examples/create-test-pr.js 22425\n');
    console.log('This will:');
    console.log('  1. Fetch the Carbon PR');
    console.log(`  2. Create a PR in ${TEST_OWNER}/${TEST_REPO}`);
    console.log('  3. You can then run the review agent on that PR\n');
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
