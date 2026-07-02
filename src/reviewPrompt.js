/**
 * Format review comments according to Carbon PR review spec
 */

/**
 * Estimate token usage for a PR review
 *
 * @param {Object} options - Token estimation options
 * @param {string} options.prompt - Review prompt text
 * @param {string} options.diff - PR diff content
 * @param {string} options.agentOutput - Agent's output
 * @returns {Object} - Token usage estimate { input: number, output: number, total: number }
 */
function estimateTokenUsage({ prompt, diff, agentOutput }) {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is a conservative estimate; actual tokenization varies by model
  const CHARS_PER_TOKEN = 4;
  
  const inputChars = (prompt?.length || 0) + (diff?.length || 0);
  const outputChars = agentOutput?.length || 0;
  
  const inputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);
  const outputTokens = Math.ceil(outputChars / CHARS_PER_TOKEN);
  const totalTokens = inputTokens + outputTokens;
  
  return {
    input: inputTokens,
    output: outputTokens,
    total: totalTokens
  };
}

/**
 * Format summary comment with spec-compliant template
 *
 * @param {Object} options - Formatting options
 * @param {string} options.agent - Agent name (bob, claude, codex)
 * @param {string} options.summaryMarkdown - Agent's summary markdown
 * @param {number} options.prNumber - PR number
 * @param {string} options.commitSha - Head commit SHA
 * @param {Array} [options.inlineFindings] - Findings posted as inline comments
 * @param {Array} [options.summaryFindings] - Findings included in summary
 * @param {Object} [options.tokenUsage] - Token usage estimate { input, output, total }
 * @returns {string} - Formatted summary comment
 */
function formatSummaryComment({ agent, summaryMarkdown, prNumber, commitSha, inlineFindings = [], summaryFindings = [], tokenUsage = null }) {
  let comment = `[AI agent review — Carbon grounded]\n\n`;
  comment += `Reviewed by: ${agent}\n`;
  comment += `Carbon verification policy: Carbon-specific claims require Carbon MCP verification.\n\n`;
  
  // Add agent's summary
  comment += summaryMarkdown + '\n\n';
  
  // Add findings that couldn't be posted inline
  if (summaryFindings && summaryFindings.length > 0) {
    comment += `## Additional Findings\n\n`;
    comment += `The following findings could not be mapped to specific lines in the diff:\n\n`;
    
    summaryFindings.forEach((finding, index) => {
      comment += `### ${index + 1}. ${finding.title}\n\n`;
      comment += `**File:** \`${finding.file}\``;
      if (finding.line) {
        comment += ` (Line ${finding.line})`;
      }
      comment += `\n**Severity:** ${finding.severity}\n\n`;
      comment += finding.body + '\n\n';
      
      // Only show verification badge for Carbon-specific findings
      if (finding.carbonVerified && finding.verificationSource === 'carbon-mcp') {
        comment += `*✓ Verified with Carbon MCP*\n\n`;
      }
      
      comment += '---\n\n';
    });
  }
  
  // Add review artifacts
  comment += `Review artifacts:\n`;
  comment += `- PR: #${prNumber}\n`;
  comment += `- Commit: ${commitSha.substring(0, 7)}\n`;
  comment += `- Agent: ${agent}\n`;
  
  if (inlineFindings && inlineFindings.length > 0) {
    comment += `- Inline comments: ${inlineFindings.length}\n`;
  }
  if (summaryFindings && summaryFindings.length > 0) {
    comment += `- Summary findings: ${summaryFindings.length}\n`;
  }
  
  // Add token usage estimate if available
  if (tokenUsage) {
    comment += `\n---\n\n`;
    comment += `**Estimated Token Usage:**\n`;
    comment += `- Input tokens: ~${tokenUsage.input.toLocaleString()}\n`;
    comment += `- Output tokens: ~${tokenUsage.output.toLocaleString()}\n`;
    comment += `- Total tokens: ~${tokenUsage.total.toLocaleString()}\n`;
    comment += `\n*Note: Token estimates are approximate and based on character count (1 token ≈ 4 characters).*\n`;
  }
  
  return comment;
}

/**
 * Format inline review comment for a specific finding
 * 
 * @param {Object} finding - Finding object
 * @returns {string} - Formatted inline comment
 */
function formatInlineComment(finding) {
  let comment = `**${finding.title}**\n\n`;
  comment += `Severity: ${finding.severity}\n\n`;
  comment += finding.body + '\n\n';
  
  // Only show verification badge for Carbon-specific findings
  if (finding.carbonVerified && finding.verificationSource === 'carbon-mcp') {
    comment += `*✓ Verified with Carbon MCP*\n`;
  }
  
  return comment;
}

/**
 * Build the prompt for the AI agent
 * 
 * @param {Object} options - Prompt options
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @returns {string} - Formatted prompt
 */
function buildReviewPrompt({ owner, repo }) {
  return `You are an agentic PR reviewer for ${owner}/${repo}.

## Step 1 — Read and catalogue the diff (do this before forming any opinion)

Read PR_REVIEW_REQUEST.md. It contains the PR description, changed files list, and the full diff in one place. You do not need to read pr.json, files.json, or diff.patch separately.

Before writing any findings, produce a private catalogue of every change you can see. For each changed file, list:
- Every function, prop, class, or variable whose signature or default value changed
- Every deleted block and what replaced it (even if the replacement looks correct)
- Every new behaviour added (new hooks, observers, guards, conditionals)

Do not skip files. Do not stop cataloguing because the changes look safe. Complete the catalogue for ALL files first.

Only review SOURCE CODE files listed under "Changed Files" in PR_REVIEW_REQUEST.md. Do NOT review bundle files.

## Step 2 — Evaluate each catalogued change

For each item in your catalogue, ask:
1. Is the full change visible in the diff — is there a corresponding change elsewhere that makes this safe? (e.g. a removed JS default replaced by a CSS/SCSS default)
2. Is this a correctness, accessibility, test, migration, or Carbon Design System issue?
3. Apply the category test below before classifying.

Do not raise a finding on a change until you have checked whether the rest of the diff compensates for it.

## Step 3 — Output the JSON

Your ONLY output is the JSON block between BEGIN_REVIEW_JSON and END_REVIEW_JSON markers below. Do not call attempt_completion, do not write prose. Writing the JSON block IS the completion step — do it even when findings is an empty array.

Primary objective: Find correctness, accessibility, test, migration, and Carbon Design System issues introduced by this PR.

**Carbon verification rule:**
For any finding about a Carbon component's API (props, tokens, icons, patterns, accessibility), you MUST verify it using Carbon MCP tools (server: \`carbon-mcp\`): code_search, docs_search, get_charts.
If Carbon MCP is unavailable or returns no usable response, DO NOT reclassify the finding as Category 2 — omit it entirely and note in summaryMarkdown that Carbon findings were skipped due to MCP unavailability.

**Two categories only:**

Category 1 — Carbon API finding: about a Carbon component's props, tokens, variants, or accessibility patterns.
- MUST verify with carbon-mcp tools before posting
- Set: carbonVerified: true, verificationSource: "carbon-mcp"
- mcpEvidence MUST be a direct quote from the tool response
- If MCP unavailable or tool call fails: omit the finding, do NOT reclassify it as not-carbon-specific

Category 2 — Non-Carbon finding: generic correctness, accessibility, test coverage, or migration issue visible in the diff.
- Do NOT use carbon-mcp tools
- Set: carbonVerified: false, verificationSource: "not-carbon-specific"

**Category test:** Ask "Could this finding appear on a non-Carbon component using the same framework?" If YES → Category 2. If NO → Category 1.

**Framework behaviour is always Category 2** regardless of which file it appears in: Lit lifecycle (@query, firstUpdated, updateComplete), React hooks, TypeScript types, event listeners, async patterns.

**Do not call MCP tools speculatively.** Only call carbon-mcp tools after you have identified a specific finding AND it has passed the category test as Category 1. Do not search MCP to understand what a piece of code does — only to verify a claim you are about to make about a Carbon component's consumer-facing API.

**Follow requery_hint before trying docs_search.** When a code_search result shows "example_omitted": true for a variant that is relevant to your finding, follow its requery_hint with size: 1 before falling back to docs_search. The requery_hint fetches the full variant example and is the most precise evidence source for prop requirements.

**mcpEvidence rule:** Must be a direct quote from the tool response. Vague phrases like "Verified via code_search" or empty strings will cause the finding to be dropped by the parser.

**summaryMarkdown** must contain only:
1. One or two sentences describing what the PR does
2. A single line stating the count and severity of findings

Must NOT contain checkmark lists, MCP verification claims, broad alignment statements, headings, or emoji.

Correct: "This PR suppresses invalid/warn states on TextArea when disabled or readonly. 1 minor finding: readonly/disabled precedence behaviour may need a clarifying comment."
Incorrect: "✅ TextArea API confirmed via code_search. ✅ Implementation aligns with Carbon guidelines."

Only mention Carbon MCP availability if Carbon findings were omitted because MCP was unavailable.

Return exactly this JSON between markers — this is mandatory, do not end your response without it:

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
      "verificationSource": "carbon-mcp|not-carbon-specific",
      "mcpEvidence": "direct quote from MCP tool response (required when verificationSource is carbon-mcp, omit otherwise)"
    }
  ],
  "shouldPostInlineComments": true
}
END_REVIEW_JSON

verificationSource values:
- "carbon-mcp": verified via Carbon MCP — mcpEvidence MUST be a direct quote from the tool response
- "not-carbon-specific": generic correctness, accessibility, test, or migration finding
`;
}

module.exports = {
  formatSummaryComment,
  formatInlineComment,
  buildReviewPrompt,
  estimateTokenUsage
};

// Made with Bob
