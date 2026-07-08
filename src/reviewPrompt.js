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

// ---------------------------------------------------------------------------
// Recommendation labels and submitter-facing advice copy
// ---------------------------------------------------------------------------

const RECOMMENDATION_LABELS = {
  'consider-revising': 'Consider Revising',
  'suggested-improvements': 'Suggested Improvements',
  'looks-good': 'Looks Good'
};

const RECOMMENDATION_ADVICE = {
  'consider-revising':
    'There are issues in this PR that should be addressed before merging. ' +
    'Please review the findings below — the blocking and major items include specific suggestions on what to change.',
  'suggested-improvements':
    'This PR is on the right track. The findings below are suggestions worth considering before or shortly after merging — ' +
    'none are hard blockers, but addressing them would improve correctness or maintainability.',
  'looks-good':
    'No blocking or major issues were found. Any nit-level notes below are entirely optional and provided for completeness.'
};

const SEVERITY_GUIDANCE = {
  blocking: 'Should be resolved before this ships.',
  major: 'Worth addressing before merge.',
  minor: 'Consider addressing — not a hard blocker.',
  nit: 'Optional — provided for completeness.'
};

// ---------------------------------------------------------------------------
// formatInlineComment
// ---------------------------------------------------------------------------

/**
 * Format inline review comment for a specific finding
 *
 * @param {Object} finding - Finding object
 * @returns {string} - Formatted inline comment
 */
function formatInlineComment(finding) {
  const guidance = SEVERITY_GUIDANCE[finding.severity] || '';
  let comment = `**${finding.title}**\n\n`;
  comment += `> **[${finding.severity}]** ${guidance}\n\n`;
  comment += finding.body + '\n\n';

  // Only show verification badge for Carbon-specific findings
  if (finding.carbonVerified && finding.verificationSource === 'carbon-mcp') {
    comment += `*✓ Verified with Carbon MCP*\n`;
  }

  return comment;
}

// ---------------------------------------------------------------------------
// formatSummaryComment
// ---------------------------------------------------------------------------

/**
 * Format summary comment with spec-compliant template.
 *
 * All new parameters have safe defaults so existing call sites continue to
 * work without modification — no silent undefined in rendered output.
 *
 * @param {Object}  options
 * @param {string}  options.agent                - Agent name (bob, claude, codex)
 * @param {string}  options.summaryMarkdown       - Agent's 1-2 sentence summary (never mutated)
 * @param {number}  options.prNumber              - PR number
 * @param {string}  options.commitSha             - Head commit SHA
 * @param {Array}   [options.inlineFindings]      - Findings posted as inline comments
 * @param {Array}   [options.summaryFindings]     - Findings included in summary
 * @param {Object}  [options.tokenUsage]          - Token usage { input, output, total }
 * @param {string}  [options.recommendation]      - 'consider-revising'|'suggested-improvements'|'looks-good'
 * @param {string}  [options.recommendationRationale] - One sentence from computeRecommendation
 * @param {string|null} [options.catalogueWarning] - Non-null when agent skipped Step 1 catalogue
 * @param {Array}   [options.findingsTable]       - Typed array from parser: [{area,category,severity,title,file}]
 * @returns {string} - Formatted summary comment
 */
function formatSummaryComment({
  agent,
  summaryMarkdown,
  prNumber,
  commitSha,
  inlineFindings = [],
  summaryFindings = [],
  tokenUsage = null,
  recommendation = 'looks-good',
  recommendationRationale = '',
  catalogueWarning = null,
  findingsTable = []
}) {
  const recLabel = RECOMMENDATION_LABELS[recommendation] || recommendation;
  const recAdvice = RECOMMENDATION_ADVICE[recommendation] || '';

  let comment = `[AI agent review — Carbon grounded] · **${recLabel}**\n\n`;
  comment += `Reviewed by: ${agent} · Commit: ${commitSha.substring(0, 7)}\n`;
  comment += `Carbon verification: Carbon-specific claims verified via Carbon MCP.\n\n`;

  // ── Recommendation section ─────────────────────────────────────────────
  comment += `## Recommendation\n\n`;
  if (recommendationRationale) {
    comment += `${recommendationRationale}\n\n`;
  }
  comment += `${recAdvice}\n\n`;

  // ── Catalogue reliability warning (rendered separately — never in summaryMarkdown) ──
  if (catalogueWarning) {
    comment += `> ⚠️ **Review Reliability Note:** ${catalogueWarning}\n\n`;
  }

  // ── Findings table (rendered from typed array — no Markdown in agent JSON) ──
  if (findingsTable && findingsTable.length > 0) {
    comment += `## Findings\n\n`;
    comment += `| Area | Category | Severity | Finding | File |\n`;
    comment += `|------|----------|----------|---------|------|\n`;
    for (const row of findingsTable) {
      // Sanitise cell values: strip pipes and newlines to prevent table breakage
      const safe = v => String(v || '').replace(/[|\n\r]/g, ' ').trim();
      comment += `| ${safe(row.area)} | ${safe(row.category)} | ${safe(row.severity)} | ${safe(row.title)} | ${safe(row.file)} |\n`;
    }
    comment += '\n';
  }

  // ── Agent summary (verbatim — this field is never mutated after parse) ──
  comment += `## Summary\n\n`;
  comment += summaryMarkdown + '\n\n';

  // ── Additional findings that couldn't be posted inline ─────────────────
  if (summaryFindings && summaryFindings.length > 0) {
    comment += `## Additional Findings\n\n`;
    comment += `The following findings could not be mapped to specific lines in the diff:\n\n`;

    summaryFindings.forEach((finding, index) => {
      const guidance = SEVERITY_GUIDANCE[finding.severity] || '';
      comment += `### ${index + 1}. ${finding.title}\n\n`;
      comment += `**File:** \`${finding.file}\``;
      if (finding.line) {
        comment += ` (Line ${finding.line})`;
      }
      comment += `\n**Severity:** ${finding.severity} — ${guidance}\n\n`;
      comment += finding.body + '\n\n';

      if (finding.carbonVerified && finding.verificationSource === 'carbon-mcp') {
        comment += `*✓ Verified with Carbon MCP*\n\n`;
      }

      comment += '---\n\n';
    });
  }

  // ── Review artifacts ────────────────────────────────────────────────────
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

  // ── Token usage ─────────────────────────────────────────────────────────
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

// ---------------------------------------------------------------------------
// buildReviewPrompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the AI agent
 *
 * @param {Object} options - Prompt options
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo  - Repository name
 * @returns {string} - Formatted prompt
 */
function buildReviewPrompt({ owner, repo }) {
  return `You are an agentic PR reviewer for ${owner}/${repo}.

## Step 1 — Read and catalogue the diff (do this before forming any opinion)

Read PR_REVIEW_REQUEST.md. It contains the PR description, changed files list, and the full diff in one place. You do not need to read pr.json, files.json, or diff.patch separately.

As you read each file, write one line per suspicious item in this format:
\`[file:line] — [what you saw] — [Category 1 / Category 2] — pending\`

Category 1 = the finding is about whether a specific Carbon element accepts a specific attribute, prop, or variant — must verify with MCP.
Category 2 = generic correctness, accessibility omission, or duplicate markup visible from the diff alone — no MCP needed.

Examples of the format (not exhaustive — apply to any change you see):
\`overflow-menu.figma.ts:33 — menu-alignment on <cds-overflow-menu>, body child element exists — Category 1 — pending\`
\`combo-button.figma.ts:46 — Open:True variant identical to default — Category 2 — pending\`
\`time-picker.figma.ts:31 — <cds-time-picker-select> children, no aria-label — Category 2 — pending\`

Do not skip files. Do not stop cataloguing because the changes look safe. Complete the catalogue for ALL files first.

You may skip a file without a catalogue entry ONLY if it is a test fixture (__testfixtures__ path) or a test runner file (__tests__ path). For every skipped file write exactly:
\`SKIP [filename] — [fixture|test]\`

All other files require at least one catalogue entry or an explicit \`NO-FINDINGS [filename] — [one-sentence reason]\` line. Write these lines in your output, not in <thinking>.

Only review SOURCE CODE files listed under "Changed Files" in PR_REVIEW_REQUEST.md. Do NOT review bundle files (e.g. files under dist/, es/, lib/, or ending in .min.js).

Configuration and tooling source files (e.g. \`.figma.ts\`, \`.config.ts\`, storybook files) ARE source code — review them. A file being declarative or additive does not exempt it from review.

**Figma Code Connect context:** Code Connect files are the source of truth for what code developers copy-paste from Figma. A wrong attribute name means every developer who uses that snippet ships broken code. A missing \`aria-label\` means every copied snippet is inaccessible. A duplicate variant means the Figma variant produces no distinct code output — the variant mapping is useless. These are not documentation nits — they are correctness and accessibility bugs with real downstream impact.

For configuration and tooling files that reference Carbon APIs, look specifically for:
1. **Attribute placement** — attributes set on the wrong element in a parent/child pair (placement or direction on a trigger instead of a body/panel element) — **Category 1** (requires MCP)
2. **Duplicate variant examples** — a variant block that emits markup identical to the default with no public API difference (e.g. \`variant: { Open: 'True' }\`, \`variant: { Expanded: 'True' }\`) — **Category 2** (diff-visible, no MCP needed)
3. **Missing accessibility attributes** — interactive child elements (selects, inputs, buttons inside a parent) that omit \`aria-label\` or similar attributes — **Category 2** (diff-visible, no MCP needed)

For codemod and transform files (e.g. files under transforms/, codemods/), look specifically for:
4. **Contradictory inline guidance** — a module-level comment that claims X and a TODO or inline comment in the same file that claims the opposite of X — **Category 2** (diff-visible, no MCP needed)
5. **Prop names in migration guidance** — a TODO or comment directing users to use a specific prop name on a Carbon component — **Category 1** (verify the prop name exists via MCP)

For any source file where the diff introduces a new normalising abstraction (a hook, a computed object, or a helper that replaces direct prop/attribute access — e.g. \`const normalizedProps = useNormalizedInputProps(...)\`, \`const computed = { disabled: ... }\`), look specifically for:
6. **Partial migration** — the diff introduces the abstraction and updates some references, but other \`-\` or context lines in the same diff hunks still read the original raw value (e.g. a \`-\` line inside a changed hunk still checking \`!disabled\` directly instead of \`normalizedProps.disabled\`) — **Category 2** (diff-visible, no MCP needed). Only flag uses visible in the diff's \`+\`, \`-\`, or hunk context lines — do not infer or speculate about code outside the shown hunks.
7. **Unsafe fallback in abstraction arguments** — the new abstraction is called with a fallback that can produce a non-unique value across instances (e.g. \`id ?? ''\` when the abstraction derives DOM IDs from that argument, risking duplicate IDs when the prop is omitted) — **Category 2** (diff-visible, no MCP needed).

In addition, for EVERY changed source file apply these rubric checks during the same per-file pass (do not loop files a second time):

8. **Generic accessibility omissions** — interactive elements (button, select, input, a with no text, img) that are new or modified in the diff and lack aria-label, aria-describedby, alt, or required role — **Category 2** (diff-visible, no MCP needed)
9. **TypeScript / framework correctness** — the principle is: does the diff introduce a type annotation or framework call whose guarantee is immediately contradicted by how it is used? Flag it. The following are examples, not an exhaustive list — apply the principle to any pattern you see:
   - \`!\` non-null assertion on a field that is immediately accessed with \`?.\` optional chaining (or vice versa) — the two are contradictory: either the value can be null/undefined (\`?.\` is correct, \`!\` is a lie to the compiler) or it cannot (\`!\` is correct, \`?.\` is unnecessary noise that masks a real invariant violation)
   - \`@query\` decorator used on a field typed as \`HTMLElement\` but the selector can match zero elements at runtime (e.g. a named slot or conditional child)
   - \`firstUpdated\` override that does not call \`super.firstUpdated()\`
   - \`updateComplete\` awaited without \`await\` (i.e. the promise is dropped)
   - React hook called inside a condition, loop, or nested function
   - \`async\` function whose returned promise is never awaited or \`.catch\`-ed at the call site
   - This check is always **Category 2** regardless of file type — framework behaviour is never Carbon-specific
10. **Unsafe ID / key fallback** — any new abstraction argument or JSX key prop that can produce an empty string or non-unique value across instances (e.g. \`id ?? ''\`, \`key={index}\` on reorderable lists) — **Category 2** (diff-visible, no MCP needed)
11. **Breaking API change without deprecation** — a public export, required prop, or event name removed or renamed in the diff with no deprecation notice or migration comment — **Category 1** (verify the prior API contract via MCP before filing)
12. **Icon name or size verification** — an icon name or size variant introduced or changed in the diff (e.g. \`Add16\`, \`<AddIcon size={20} />\`) — **Category 1** (verify the icon and size exist via MCP code_search with asset_type: "icon")
13. **Test coverage gap** — For every changed source file, determine: does this diff introduce a new exported function, new public method, or clearly new runtime behaviour? If yes, check whether the "Changed Files" list contains a corresponding \`__tests__\`, \`.test.\`, or \`.spec.\` file for the changed source. If no test file is present AND new behaviour was introduced, this is a catalogue item. You may discard it only if you can quote a specific diff line showing the new code is covered by an existing inline test or the change is a pure refactoring with no new code paths. **Do not state that test files exist in the changed files list unless you have verified this by reading the "Changed Files" section of PR_REVIEW_REQUEST.md.** — **Category 2**
14. **Changelog / API hygiene** — a public API surface changes (component added, prop added/removed, event renamed) with no entry in a changelog or breaking-changes file. **Scope: apply this check only when NO \`CHANGELOG\`, \`CHANGELOG.md\`, \`BREAKING_CHANGES\`, or \`BREAKING_CHANGES.md\` file appears in the "Changed Files" list.** — **Category 2**

## Step 2 — Resolve every pending item

For each \`pending\` item in your catalogue:
- If Category 1: call carbon-mcp now, then update the item to \`confirmed finding\` or \`discarded: [reason]\`
- If Category 2: decide from the diff alone, then update to \`confirmed finding\` or \`discarded: [reason]\`

A \`pending\` item may never be silently dropped. If you move to Step 3 with any item still \`pending\`, go back.

Do not raise a finding on a change until you have checked whether the rest of the diff compensates for it.

**Invalid discard reasons — these are not evidence, they are claims that belong in a review comment:**
- "This is intentional" or "this is by design" — the PR author's intent is not visible in the diff
- "This is a Figma visual state" — a variant that emits identical markup has no code effect regardless of Figma intent
- "These are config files, not components" — config files that reference Carbon APIs are in scope
- "The API looks standard" or "this appears correct" — appearance without evidence is not a valid discard reason for ANY category
- A successful MCP call about a different question (e.g. confirming an attribute exists) does NOT discharge a pending item about a different concern (e.g. a falsy check, a missing guard, a logic equivalence question) — each pending item must be resolved on its own merits
- **Stating a factual condition that is not true** — e.g. claiming test files exist in the changed files list when they do not, or claiming the diff does not introduce new behaviour when it does. A discard reason that misstates what the diff or the changed files list contains is invalid. If you are unsure whether a file exists in the changed list, re-read the "Changed Files" section of PR_REVIEW_REQUEST.md before discarding.

**Valid discard reasons:**
- Category 1: MCP returned direct evidence (from an example_clean, props_used, or chunk_text field) that the specific API usage on the specific component is correct — quote the evidence verbatim. Cross-component evidence alone (e.g. toast uses role="status", therefore inline is correct) is NOT a valid discard reason; it is evidence that belongs in mcpEvidence of a minor finding.
- Category 2: Quote the specific diff line (file:line) that makes the concern safe, and explain in one sentence why that line resolves it. A general conclusion ("implementation is correct", "this is handled") without a cited line is not a valid discard reason.

## Step 3 — Compile your findings list

Before writing any JSON, list every \`confirmed finding\` from your catalogue with file path, line, title, severity, and whether MCP verification is complete. Nothing may appear in the JSON that is not in this list. If a confirmed finding still needs MCP evidence, go verify it now before proceeding.

**Contextual layout token pattern — do not flag as breaking change:**
When a JS/TS prop default is removed (e.g. \`size = 'md'\` → \`size\`) AND the same diff adds \`@include layout.use('size', $default: 'md', ...)\` in SCSS, the default has moved from the prop layer to the CSS layer — this is the Carbon contextual layout token migration pattern. The component still renders the same default visually. This is NOT a breaking change. Look for \`layout.use\` with a matching \`$default:\` value in the SCSS changes before flagging a removed JS prop default as breaking.

## Step 4 — Output the JSON

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

Exception for config/tooling files: if the finding is about whether a specific **attribute name** exists on a specific Carbon element (e.g. is \`direction\` a valid attribute on \`<cds-overflow-menu>\`?), it is always Category 1 regardless of whether a similar pattern could appear elsewhere — the correctness of the name depends entirely on Carbon's API.

This exception does NOT apply to structural or output questions. A finding about two variant blocks emitting identical markup is always Category 2 — you can answer it by reading the diff, regardless of which file it appears in. Do not call MCP to ask whether an \`open\` prop exists in order to justify a duplicate-variant finding.

**Framework behaviour is always Category 2** regardless of which file it appears in: Lit lifecycle (@query, firstUpdated, updateComplete), React hooks, TypeScript types, event listeners, async patterns.

**Do not call MCP tools speculatively on general source code.** Exception: for any file that references Carbon component APIs (e.g. \`.figma.ts\`, \`.stories.ts\`), verifying that an **attribute name** exists on the correct element is always a valid MCP call — do not wait for a "specific finding" before checking attribute placement in these files. This exception covers attribute-name and placement questions only — it does not cover duplicate-variant or missing-aria-label findings, which are always Category 2.

**Follow requery_hint before trying docs_search.** When a code_search result shows "example_omitted": true for a variant that is relevant to your finding, follow its requery_hint with size: 1 before falling back to docs_search. The requery_hint fetches the full variant example and is the most precise evidence source for prop requirements.

**Stop after two MCP calls for the same prop.** If two consecutive MCP calls searching for the same prop name return no evidence of it in any example_clean, props_used, or props_catalog field, do not follow additional requery_hints for that prop. Move on — treat as "MCP returned no evidence."

**props_catalog is not exhaustive.** It only reflects props used in indexed storybook stories — not the full component API. Absence of a prop from props_catalog is NOT sufficient evidence to file a finding. Before concluding a prop does not exist:
- Check whether any MCP result (any framework, any variant) shows the prop in an example_clean or props_used field — cross-framework confirmation (e.g. Web Components showing \`hide-steppers\` when reviewing a React prop \`hideSteppers\`) is positive evidence the prop concept exists in Carbon
- Follow requery_hint on at most one relevant variant to get its full example
- Only file a finding about a missing prop if MCP positively shows it was removed, deprecated, or is absent from the TypeScript interface — not merely absent from props_catalog

**mcpEvidence rule:** Must be a direct quote or verbatim field value from a tool response. Acceptable forms:
- A direct quote from a docs_search chunk_text field
- A verbatim example_clean or props_used value from code_search (e.g. "cds-toast-notification default variant shows role=\\"status\\" in example_clean")
- A cross-component observation stated explicitly, e.g. "cds-toast-notification default storybook example uses role=\\"status\\""

Vague summaries like "Verified via code_search" or empty strings will cause the finding to be dropped by the parser. If the only available evidence is a cross-component inference, state it explicitly in that form — do NOT synthesize or paraphrase a quote that was not present in the tool response.

**summaryMarkdown** must contain only:
1. One or two sentences describing what the PR does
2. A single line stating the count and severity of findings
3. (Optional) One sentence noting Carbon MCP unavailability — include this ONLY if Carbon-specific findings were omitted because MCP was unavailable

Must NOT contain checkmark lists, MCP verification claims, broad alignment statements, headings, recommendations, or emoji. The recommendation is computed by the system — do not include it here.

Correct: "This PR suppresses invalid/warn states on TextArea when disabled or readonly. 1 minor finding: readonly/disabled precedence behaviour may need a clarifying comment."
Incorrect: "✅ TextArea API confirmed via code_search. ✅ Implementation aligns with Carbon guidelines."

**findingsTable** must be populated with one entry per confirmed finding — the same findings that appear in the \`findings\` array. Each entry is a plain object with five string fields. Do NOT include rows for clean areas. Do NOT use pipe characters, newlines, or backslashes in any field value — these are plain text labels only.

Return exactly this JSON between markers — this is mandatory, do not end your response without it:

BEGIN_REVIEW_JSON
{
  "summaryMarkdown": "string — 1 to 3 sentences max, no headings, no emoji, no recommendations",
  "findings": [
    {
      "severity": "blocking|major|minor|nit",
      "file": "repo-relative path",
      "line": 123,
      "title": "short title — plain text, no pipes or newlines",
      "body": "specific actionable comment",
      "carbonVerified": true,
      "verificationSource": "carbon-mcp|not-carbon-specific",
      "mcpEvidence": "direct quote from MCP tool response (required when verificationSource is carbon-mcp, omit otherwise)"
    }
  ],
  "findingsTable": [
    {
      "area": "Carbon API|General",
      "category": "Cat 1|Cat 2",
      "severity": "blocking|major|minor|nit",
      "title": "short title — plain text only, no pipes or newlines",
      "file": "repo-relative path — plain text only, no pipes"
    }
  ],
  "shouldPostInlineComments": true
}
END_REVIEW_JSON

verificationSource values:
- "carbon-mcp": verified via Carbon MCP — mcpEvidence MUST be a direct quote from the tool response
- "not-carbon-specific": generic correctness, accessibility, test, or migration finding

findingsTable rules:
- One entry per confirmed finding (mirrors the findings array)
- area: "Carbon API" for carbon-mcp findings, "General" for not-carbon-specific findings
- category: "Cat 1" for carbon-mcp findings, "Cat 2" for not-carbon-specific findings
- No Markdown formatting, no pipe characters, no newline characters in any field value
- Empty array when there are no confirmed findings
`;
}

module.exports = {
  formatSummaryComment,
  formatInlineComment,
  buildReviewPrompt,
  estimateTokenUsage
};

// Made with Bob
