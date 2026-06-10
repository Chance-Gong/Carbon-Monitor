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

    // Write agent rules for Bob
    const bobRulesDir = path.join(tempDir, '.bob', 'rules');
    await fs.mkdir(bobRulesDir, { recursive: true });
    await fs.writeFile(
      path.join(bobRulesDir, '01-output.md'),
      rules
    );

    // Note: Bob uses globally configured MCP servers, not per-directory .bob/mcp.json
    // The carbon-mcp server must be configured globally with: bob mcp add carbon-mcp npx -y carbon-mcp

    // 6. Create review prompt
    const prompt = `You are an agentic PR reviewer for ${owner}/${repo}.

Review the PR bundle in the current directory:
- PR_REVIEW_REQUEST.md
- pr.json
- files.json
- diff.patch

Primary objective:
Find correctness, accessibility, test, migration, and Carbon Design System issues introduced by this PR.

CRITICAL Carbon Verification Protocol:

1. BEFORE making ANY Carbon-specific claim, you MUST:
   a. Use the carbon-mcp MCP server tools to verify the claim
   b. Call code_search or docs_search MCP tools
   c. Include verification metadata in the finding

2. Carbon-specific topics requiring verification:
   - Component names, props, or APIs (Button, Modal, DataTable, etc.)
   - Carbon tokens ($spacing-05, $layer-01, etc.)
   - Carbon icons (@carbon/icons-react)
   - IBM Products components (@carbon/ibm-products)
   - Carbon Charts usage
   - Accessibility patterns from Carbon
   - Design system compliance

3. How to verify using carbon-mcp MCP tools:
   - Use code_search tool with query like "Button kind prop" and filters.component_type="React"
   - Use docs_search tool for design guidance and accessibility patterns
   - Use get_charts tool for Carbon Charts information
   - Parse the JSON response to extract valid values/patterns

4. Verification metadata format (REQUIRED for Carbon findings):
   {
     "severity": "major",
     "file": "src/Button.jsx",
     "line": 45,
     "title": "Invalid Button kind prop",
     "body": "Verified via carbon-mcp code_search: The 'kind' prop only accepts: primary, secondary, tertiary, ghost, danger, danger--tertiary, danger--ghost. Found: 'custom'",
     "carbonVerified": true,
     "verificationSource": "carbon-mcp"
   }

5. If carbon-mcp MCP server is unavailable:
   - DO NOT make Carbon-specific claims
   - Focus on general code quality issues only
   - Mark non-Carbon findings as: "carbonVerified": false, "verificationSource": "not-carbon-specific"

6. Example verification workflow:
   - Spot potential issue: <Button kind="custom">
   - Call carbon-mcp code_search tool with query="Button kind prop" and filters.component_type="React"
   - Parse JSON response to get valid prop values
   - Create finding with carbonVerified: true and verificationSource: "carbon-mcp"

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
      "body": "specific actionable comment with verification details if Carbon-related",
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
