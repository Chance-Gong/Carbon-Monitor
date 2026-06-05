/**
 * Review Bundle Builder Module
 * Creates temporary workspace with PR context for agent review
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { MAX_DIFF_CHARS } = require('./constants');

/**
 * Build a review bundle for agent execution
 * @param {Object} options - { owner, repo, pr, diff, files }
 * @returns {Promise<Object>} Bundle object with dir, prompt, and cleanup function
 */
async function buildReviewBundle({ owner, repo, pr, diff, files }) {
  // Create temp directory
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${owner}__${repo}__pull-${pr.number}-`)
  );

  try {
    // 1. Write PR metadata
    await fs.writeFile(
      path.join(tempDir, 'pr.json'),
      JSON.stringify(pr, null, 2)
    );

    // 2. Write files list
    await fs.writeFile(
      path.join(tempDir, 'files.json'),
      JSON.stringify(files, null, 2)
    );

    // 3. Write diff (with truncation if needed per spec lines 62-67)
    let diffToWrite = diff;
    let diffTruncated = false;
    
    if (diff.length > MAX_DIFF_CHARS) {
      diffTruncated = true;
      diffToWrite = diff.substring(0, MAX_DIFF_CHARS);
      diffToWrite += '\n\n[... diff truncated due to size ...]\n';
      diffToWrite += `Original size: ${diff.length} chars, truncated to: ${MAX_DIFF_CHARS} chars\n`;
      diffToWrite += `View full diff at: https://github.com/${owner}/${repo}/pull/${pr.number}/files\n`;
    }
    
    await fs.writeFile(
      path.join(tempDir, 'diff.patch'),
      diffToWrite
    );

    // 4. Write PR review request summary
    const prSummary = `# PR Review Request

**Repository:** ${owner}/${repo}
**PR Number:** #${pr.number}
**Title:** ${pr.title}
**Author:** ${pr.user.login}
**Created:** ${pr.created_at}
**Updated:** ${pr.updated_at}

## Description

${pr.body || 'No description provided'}

## Changed Files

${files.map(f => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join('\n')}

## Review Instructions

Review the changes in this PR for:
- Correctness issues
- Accessibility issues
- Test coverage
- Migration concerns
- Carbon Design System compliance

See diff.patch for the full changes.
`;

    await fs.writeFile(
      path.join(tempDir, 'PR_REVIEW_REQUEST.md'),
      prSummary
    );

    // 5. Write agent rules (for all agent types)
    const rules = `# Carbon PR Review Agent Rules

You are reviewing a pull request in ${owner}/${repo}.

Mandatory:
- Use Carbon Builder skill when available before making any Carbon API, prop, token, icon, accessibility, or design-system claim.
- If Carbon Builder is unavailable, use Carbon MCP tools as ground truth.
- Any unverified Carbon claim is invalid and must not be posted.
- Prefer specific actionable findings over general advice.
- Do not edit files.
- Do not run package manager install commands.
- Produce only the requested JSON object and review Markdown.
`;

    // Write for Codex
    await fs.writeFile(
      path.join(tempDir, 'AGENTS.md'),
      rules
    );

    // Write for Claude
    await fs.writeFile(
      path.join(tempDir, 'CLAUDE.md'),
      rules
    );

    // Write for Bob
    const bobRulesDir = path.join(tempDir, '.bob', 'rules');
    await fs.mkdir(bobRulesDir, { recursive: true });
    await fs.writeFile(
      path.join(bobRulesDir, '01-output.md'),
      rules
    );

    // 6. Create review prompt
    const prompt = `You are an agentic PR reviewer for ${owner}/${repo}.

Review the PR bundle in the current directory:
- PR_REVIEW_REQUEST.md
- pr.json
- files.json
- diff.patch

Primary objective:
Find correctness, accessibility, test, migration, and Carbon Design System issues introduced by this PR.

Carbon ground-truth rule:
Before making any Carbon-specific claim about components, imports, icons, tokens, props, styling, layout, accessibility, or design rationale, verify it with Carbon Builder. If Carbon Builder is unavailable, verify it with Carbon MCP. If neither is available, omit the Carbon-specific claim.

Return exactly this JSON between markers:

BEGIN_REVIEW_JSON
{
  "summaryMarkdown": "string",
  "findings": [
    {
      "severity": "blocking|major|minor|nit",
      "file": "repo-relative path",
      "line": 123,
      "title": "short title",
      "body": "specific actionable comment",
      "carbonVerified": true,
      "verificationSource": "carbon-builder|carbon-mcp|not-carbon-specific"
    }
  ],
  "shouldPostInlineComments": true
}
END_REVIEW_JSON`;

    // Return bundle object
    return {
      dir: tempDir,
      prompt,
      cleanup: async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.error('Error cleaning up bundle:', error.message);
        }
      }
    };

  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

module.exports = { buildReviewBundle };

// Made with Bob
