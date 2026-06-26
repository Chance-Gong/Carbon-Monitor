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
  comment += `Carbon verification policy: Carbon-specific claims verified via Carbon MCP tools.\n\n`;
  
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

**You are reviewing a Carbon Design System PR. Use Carbon MCP tools to verify all Carbon component usage.**

Review the PR bundle in the current directory:
- PR_REVIEW_REQUEST.md (summary of the PR)
- pr.json (PR metadata)
- files.json (list of changed files)
- diff.patch (unified diff of changes)

**IMPORTANT: Only review the SOURCE CODE files listed in files.json. DO NOT review the bundle files themselves (diff.patch, pr.json, files.json, PR_REVIEW_REQUEST.md).**

Primary objective:
Find correctness, accessibility, test, migration, and Carbon Design System issues introduced by this PR.

**CRITICAL: Carbon Ground-Truth Enforcement**

**Carbon MCP tools are the ONLY source of ground truth for all Carbon component code.**

**IMPORTANT: MCP Server Availability Check**
Before marking ANY finding as "model-memory-fallback", you MUST verify:
1. Did you successfully call code_search? → If YES, MCP IS AVAILABLE
2. Did you successfully call docs_search? → If YES, MCP IS AVAILABLE
3. If ANY Carbon MCP tool returned data (even if other tools failed), MCP IS AVAILABLE

**Carbon MCP Verification Protocol:**
For all Carbon component verification, use Carbon MCP tools (server name: \`carbon-mcp\`):
1. **code_search** - Search for components, icons, pictograms, variants, and code examples
2. **docs_search** - Search design/usage/accessibility documentation for components and tokens
3. **get_charts** - Verify Carbon Charts usage, options, and variants

**CRITICAL: If you successfully used ANY of these tools, set verificationSource: "carbon-mcp" for ALL Carbon findings.**

You MUST categorize each finding correctly - there are ONLY TWO categories:

**Category 1: Carbon-Specific Findings (USE CARBON MCP)**
   - ANY finding about Carbon Design System components, props, tokens, icons, or patterns
   - **Examples that MUST be Category 1:**
     * "DataTable missing required 'headers' prop" → Category 1 (mentions DataTable component)
     * "TextInput missing required 'labelText' prop" → Category 1 (mentions TextInput component)
     * "Using native HTML table instead of Carbon DataTable" → Category 1 (mentions DataTable)
     * "Carbon Button missing iconDescription prop" → Category 1 (mentions Carbon Button component)
     * "Using native checkbox instead of Carbon Checkbox" → Category 1 (mentions Checkbox)
     * "Invalid use of Carbon tokens" → Category 1 (mentions Carbon tokens)
     * "Missing @carbon/react import" → Category 1 (mentions @carbon package)
     * "Button component should use Carbon Button" → Category 1 (mentions Carbon Button)
   
   - **REQUIRED: Use Carbon MCP tools to verify**
     * Available tools: code_search, docs_search, get_charts (server name: carbon-mcp)
     * Example: use_mcp_tool with server_name="carbon-mcp" and tool_name="code_search"
     * If ANY Carbon MCP tool succeeds (even if other tools fail), set: \`carbonVerified: true, verificationSource: "carbon-mcp"\`
     * Tool-specific errors (like "file not found") do NOT mean MCP is unavailable
   
   - **FALLBACK ONLY: Model memory (when MCP SERVER is unavailable)**
     * Only use fallback if the MCP SERVER itself cannot be reached (connection error, server not running)
     * Individual tool errors (file not found, invalid params) are NOT server unavailability
     * If you successfully used ANY Carbon MCP tool (list_carbon_components, get_carbon_component, etc.), the server IS available
     * Log \`⚠️ MCP UNAVAILABLE\` in the finding body ONLY if server connection failed
     * Set: \`carbonVerified: false, verificationSource: "model-memory-fallback"\`
     * Add: \`requiresDownstreamReview: true\`

**Category 2: Non-Carbon Findings (DO NOT USE CARBON MCP)**
   - Generic code quality issues that don't mention Carbon
   - **Examples that MUST be Category 2:**
     * "Function name should be more descriptive" → Category 2 (generic naming)
     * "Missing test coverage for new components" → Category 2 (generic testing)
     * "Missing test coverage for new title attribute behavior" → Category 2 (generic testing)
     * "Potential memory leak in useEffect" → Category 2 (generic React issue)
     * "Variable 'x' should be renamed" → Category 2 (generic naming)
     * "Performance issue with large array" → Category 2 (generic performance)
     * "Consider adding title prop for consistency" → Category 2 (generic HTML attribute suggestion)
   
   - Set: \`carbonVerified: false, verificationSource: "not-carbon-specific"\`

**CRITICAL RULE:**
If your finding title or body mentions ANY of these words, it MUST be Category 1:
- DataTable, TextInput, Button, Checkbox, Dropdown, Modal, Accordion, Tabs, Toggle, TextArea
- @carbon, Carbon, carbon-react, carbon-icons
- Any component name from Carbon Design System

**VERIFICATION ENFORCEMENT:**
If your finding mentions ANY Carbon component (DataTable, TextInput, Button, TextArea, etc.):
- You MUST use carbon-mcp tools to verify
- You MUST set verificationSource: "carbon-mcp" (or "model-memory-fallback" if MCP unavailable)
- You CANNOT use verificationSource: "not-carbon-specific"
- Violation will cause auto-correction and flag finding for human review

DO NOT mark findings about Carbon components as "not-carbon-specific" - this is incorrect!

**IMPORTANT:** Verification fallback policy:
- Carbon MCP tools are the primary and preferred verification method
- If Carbon MCP is unavailable, use model memory as fallback
- Log \`⚠️ MCP UNAVAILABLE\` when falling back to model memory
- Flag fallback findings with \`requiresDownstreamReview: true\`
- Fallback is NOT a failure - uptime is mandatory, continue with review
- Do NOT exclude Carbon findings just because MCP is unavailable

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
      "body": "specific actionable comment (include ⚠️ MCP UNAVAILABLE if using model memory fallback)",
      "carbonVerified": true,
      "verificationSource": "carbon-mcp|model-memory-fallback|not-carbon-specific",
      "requiresDownstreamReview": false
    }
  ],
  "shouldPostInlineComments": true
}
END_REVIEW_JSON

Notes on verificationSource:
- "carbon-mcp": Verified via Carbon MCP tools (primary verification method)
- "model-memory-fallback": Used model memory when MCP unavailable (set requiresDownstreamReview: true, log ⚠️ MCP UNAVAILABLE)
- "not-carbon-specific": Non-Carbon finding (generic code quality issue)
`;
}

module.exports = {
  formatSummaryComment,
  formatInlineComment,
  buildReviewPrompt,
  estimateTokenUsage
};

// Made with Bob
