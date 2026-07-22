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
 * Apply unified diff patch hunks to a base file string and return the patched content.
 * Handles added (+), removed (-), and context lines. Ignores hunk headers (@@).
 *
 * @param {string} baseContent - Original file content as a string
 * @param {string} patch       - Unified diff patch string (from GitHub file.patch)
 * @returns {string}           - Patched file content
 */
function applyPatch(baseContent, patch) {
  const baseLines = baseContent.split('\n');
  const result = [];
  let baseIdx = 0; // 0-based index into baseLines

  const patchLines = patch.split('\n');

  for (const line of patchLines) {
    if (line.startsWith('@@')) {
      // @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        const oldStart = parseInt(match[1], 10) - 1; // convert to 0-based
        // Flush unchanged lines between the previous hunk and this one
        while (baseIdx < oldStart) {
          result.push(baseLines[baseIdx]);
          baseIdx++;
        }
      }
      continue;
    }

    if (line.startsWith('+')) {
      result.push(line.slice(1)); // added line — keep, don't advance base
    } else if (line.startsWith('-')) {
      baseIdx++;                  // removed line — skip base, don't emit
    } else if (line.startsWith(' ') || line === '') {
      result.push(baseLines[baseIdx]); // context line — emit from base
      baseIdx++;
    }
    // '\\ No newline at end of file' — ignore
  }

  // Flush any remaining lines after the last hunk
  while (baseIdx < baseLines.length) {
    result.push(baseLines[baseIdx]);
    baseIdx++;
  }

  return result.join('\n');
}

/**
 * Reconstruct committed file content for a PR file.
 *
 * - added:    extract all '+' lines from the patch (no base needed).
 * - modified: fetch base content from the source repo and apply the patch.
 * - deleted:  skip — nothing to commit.
 * - renamed:  treat like modified (patch reflects the content change).
 *
 * Returns null when the file should not be committed (deleted, no patch, or
 * the base fetch failed and the patch is also absent).
 *
 * @param {Object} file       - GitHub PR file object
 * @param {Object} octokit    - Authenticated Octokit instance
 * @param {string} owner      - Source repo owner
 * @param {string} repo       - Source repo name
 * @param {string} baseSha    - Base commit SHA of the PR (pr.base.sha)
 * @returns {Promise<string|null>}
 */
async function resolveFileContent(file, octokit, owner, repo, baseSha) {
  if (file.status === 'deleted') return null;

  // Added file: reconstruct entirely from the patch '+' lines
  if (file.status === 'added') {
    if (!file.patch) return null;
    const lines = file.patch.split('\n');
    const contentLines = [];
    for (const line of lines) {
      if (line.startsWith('@@')) continue;
      if (line.startsWith('+')) contentLines.push(line.slice(1));
    }
    return contentLines.join('\n');
  }

  // Modified / renamed: fetch base content and apply patch
  if (!file.patch) {
    // GitHub omits the patch for files > 5,000 changed lines.
    // We cannot reconstruct content without it — skip this file.
    return null;
  }

  try {
    const { data: baseFile } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: file.previous_filename || file.filename,
      ref: baseSha
    });

    if (baseFile.encoding !== 'base64' || !baseFile.content) return null;
    const baseContent = Buffer.from(baseFile.content, 'base64').toString('utf8');
    return applyPatch(baseContent, file.patch);
  } catch {
    // Base file not fetchable (e.g. very large file, permission, or binary).
    // Fall back gracefully — file won't appear in the test branch diff.
    return null;
  }
}

/**
 * Build a unified diff string from all PR files for embedding in the test PR.
 * Used as the canonical diff source for the review agent (ORIGINAL_DIFF.patch).
 * Appends a visible truncation notice for files whose patch was omitted by GitHub.
 *
 * @param {Array} files - GitHub PR file objects
 * @returns {string} - Unified diff text
 */
function buildOriginalDiff(files) {
  const parts = [];

  for (const f of files) {
    if (f.status === 'deleted' && !f.patch) {
      // Deleted file with no patch — emit a minimal deletion header so the
      // agent knows the file was removed.
      parts.push(
        `diff --git a/${f.filename} b/${f.filename}\n` +
        `deleted file mode 100644\n` +
        `--- a/${f.filename}\n` +
        `+++ /dev/null\n` +
        `[... patch unavailable — file deleted, content not shown ...]`
      );
      continue;
    }

    if (!f.patch) {
      // GitHub omitted the patch (file > 5,000 changed lines).
      parts.push(
        `diff --git a/${f.filename} b/${f.filename}\n` +
        `--- a/${f.filename}\n` +
        `+++ b/${f.filename}\n` +
        `[... patch truncated — file has too many changes for GitHub API patch field. View full diff on the original repository ...]`
      );
      continue;
    }

    const header = f.status === 'added'
      ? `diff --git a/${f.filename} b/${f.filename}\nnew file mode 100644\n--- /dev/null\n+++ b/${f.filename}`
      : `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.filename}\n+++ b/${f.filename}`;
    parts.push(`${header}\n${f.patch}`);
  }

  return parts.join('\n\n');
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

    // Step 2: Fetch files
    console.log('📁 Step 2: Fetching changed files...');
    const files = await client.fetchPRFiles({
      owner: CARBON_OWNER,
      repo: CARBON_REPO,
      pullNumber: carbonPRNumber
    });
    console.log(`   ✅ ${files.length} files changed\n`);

    // Step 3: Get default branch of test repo
    console.log('🔍 Step 3: Getting test repository info...');
    const { data: testRepo } = await octokit.rest.repos.get({
      owner: TEST_OWNER,
      repo: TEST_REPO
    });
    const baseBranch = testRepo.default_branch;
    console.log(`   ✅ Base branch: ${baseBranch}\n`);

    // Step 4: Get base branch SHA
    console.log('🔍 Step 4: Getting base branch SHA...');
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      ref: `heads/${baseBranch}`
    });
    const baseSha = baseRef.object.sha;
    console.log(`   ✅ Base SHA: ${baseSha.substring(0, 7)}\n`);

    // Step 5: Create new branch
    const branchName = `test-carbon-pr-${carbonPRNumber}`;
    console.log(`🌿 Step 5: Creating branch '${branchName}'...`);
    
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

    // Step 6: Commit source files at their real paths so the test PR diff
    // contains the actual changed lines — this makes inline comment positions valid.
    // For modified files we fetch the base content from the Carbon repo and apply
    // the patch hunks. Deleted files are skipped. Files whose patch was omitted by
    // GitHub (>5,000 changed lines) fall back to ORIGINAL_DIFF.patch for review.
    console.log(`📝 Step 6: Committing source files...`);
    const carbonBaseSha = carbonPR.base.sha;

    let committed = 0;
    let skipped = 0;
    for (const file of files) {
      const fileContent = await resolveFileContent(
        file, octokit, CARBON_OWNER, CARBON_REPO, carbonBaseSha
      );
      if (fileContent === null) {
        skipped++;
        const reason = file.status === 'deleted'
          ? 'deleted'
          : !file.patch
            ? 'patch omitted by GitHub (large file) — covered by ORIGINAL_DIFF.patch'
            : 'base fetch failed — covered by ORIGINAL_DIFF.patch';
        console.log(`   ⏭️  Skipped (${reason}): ${file.filename}`);
        continue;
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        path: file.filename,
        message: `${file.status === 'added' ? 'Add' : 'Update'} ${file.filename} from Carbon PR ${carbonPRNumber}`,
        content: Buffer.from(fileContent).toString('base64'),
        branch: branchName
      });
      committed++;
      console.log(`   ✅ [${file.status}] ${file.filename}`);
    }

    // Always commit ORIGINAL_DIFF.patch and ORIGINAL_FILES.json so the review
    // runner uses the real Carbon diff instead of the test repo's generated diff.
    const originalDiff = buildOriginalDiff(files);
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      path: 'ORIGINAL_DIFF.patch',
      message: `Add original diff from Carbon PR ${carbonPRNumber}`,
      content: Buffer.from(originalDiff).toString('base64'),
      branch: branchName
    });

    const filesJson = JSON.stringify(files, null, 2);
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: TEST_OWNER,
      repo: TEST_REPO,
      path: 'ORIGINAL_FILES.json',
      message: `Add original file list from Carbon PR ${carbonPRNumber}`,
      content: Buffer.from(filesJson).toString('base64'),
      branch: branchName
    });
    console.log(`   ✅ ORIGINAL_DIFF.patch + ORIGINAL_FILES.json`);
    console.log(`   📊 ${committed} file(s) committed, ${skipped} skipped\n`);

    // Step 7: Create PR
    console.log('🎯 Step 7: Creating PR...');
    try {
      const { data: newPR } = await octokit.rest.pulls.create({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        title: `[Test] ${carbonPR.title}`,
        head: branchName,
        base: baseBranch,
        body: `# Agent Review Test PR

This PR was created for local review agent testing. It mirrors a set of changes
from the Carbon Design System monorepo.

## Details
- **Title**: ${carbonPR.title}
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
