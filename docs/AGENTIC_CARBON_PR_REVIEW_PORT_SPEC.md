# Agentic Carbon PR Review Port Spec

## Purpose

Port the existing `genAI/github_ai_agents` PR review job from a direct Watsonx generation call to a modern agentic CLI review flow for the Carbon monorepo:

- Repository: `carbon-design-system/carbon`
- PR source: `https://github.com/carbon-design-system/carbon/pulls`
- Runtime: Node server, scheduled from `index.js`
- Agent model: one selected CLI agent per PR, no failover
- Supported CLIs: `bob`, `claude`, `codex`
- Ground truth: Carbon Builder skill where available, otherwise Carbon MCP
- Tracking: preserve the stable `AIReviewed` label workflow
- Removed: Watsonx review generation and old internal repo metadata automation

The goal is to keep the current orchestration simple and reliable while replacing the LLM call with a CLI-agent review that can use Carbon-specific tooling.

## Existing System To Preserve

The scheduler already calls `reviewPRs()` daily from [index.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/index.js):

```js
const rule = new schedule.RecurrenceRule();
rule.hour = 3;
rule.minute = 0;
rule.tz = 'America/Chicago';

schedule.scheduleJob(rule, async () => {
  console.log("Running AI Agent for internal PR reviews...");
  await reviewPRs();
});
```

Keep this integration point. The port should continue exporting `reviewPRs` from [agent_prs.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/agent_prs.js), so `index.js` does not need to change for the first implementation.

The current loop in [agent_prs.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/agent_prs.js) does three broad things:

1. Fetch open, non-draft PRs that do not have `AIReviewed`.
2. Apply internal metadata automation: labels, reviewers, assignees, projects, sprint/status.
3. Generate a PR review with Watsonx, post a comment, then add `AIReviewed`.

For the Carbon port:

- Keep step 1.
- Remove internal metadata automation except `AIReviewed`.
- Replace Watsonx analysis with one selected CLI agent.
- Add `AIReviewed` only after the selected agent successfully produces and posts a review.

## Recommended Context Strategy

Use a hybrid strategy: diff-first, targeted context second.

Do not full-checkout every PR by default. A full checkout in a cloud Node service is more operationally expensive: disk cleanup, Git auth, concurrent jobs, branch refs, and larger agent context. For review, the diff plus changed-file metadata is usually enough to find actionable PR issues.

However, diffs alone are sometimes too thin for Carbon review. They may omit nearby component context, package versions, exports, and existing patterns. The agent should receive an ephemeral review bundle and be allowed to request or inspect targeted files when needed.

Implementation shape:

1. Fetch PR metadata, changed files, and unified diff from GitHub.
2. Build a token-conservative review bundle in a temp directory.
3. Include the full diff only if under budget.
4. If the diff is large, include:
   - PR title/body
   - changed files list with additions/deletions/status
   - truncated hunks
   - links/API coordinates for targeted follow-up
5. Optionally fetch full contents only for changed files that are small and Carbon-relevant.
6. Run the selected CLI in the temp directory against this bundle.

This keeps the cloud service simple while still giving the agent a filesystem-oriented task. If later reviews are too shallow, add an optional shallow checkout mode behind an env var.

## New File Layout

Keep the first port contained inside `genAI/github_ai_agents`:

```text
genAI/github_ai_agents/
  agent_prs.js                         # existing export; becomes thin orchestrator
  constants.js                         # Carbon repo config + runtime defaults
  agentRunner.js                       # CLI detection + command construction
  reviewBundle.js                      # build temp review workspace
  reviewPrompt.js                      # prompt templates and output contract
  githubClient.js                      # Octokit wrapper and GitHub operations
  reviewParser.js                      # parse agent JSON/Markdown output
  AGENTIC_CARBON_PR_REVIEW_PORT_SPEC.md
```

Do this in phases. First add the modules with narrow tests or manual smoke commands, then simplify [agent_prs.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/agent_prs.js) to call them.

## Environment Contract

Use env vars instead of hardcoded repo and model values.

Required:

```bash
GITHUB_AI_AGENT_TOKEN=...
GITHUB_AI_AGENT_OWNER=carbon-design-system
GITHUB_AI_AGENT_REPO=carbon
GITHUB_AI_AGENT_REVIEW_LABEL=AIReviewed
GITHUB_AI_AGENT_CLI=codex
```

Optional:

```bash
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_AI_AGENT_MAX_PRS=5
GITHUB_AI_AGENT_DAYS_BACK=21
GITHUB_AI_AGENT_MAX_DIFF_CHARS=120000
GITHUB_AI_AGENT_POST_INLINE_COMMENTS=true
GITHUB_AI_AGENT_POST_SUMMARY_COMMENT=true
GITHUB_AI_AGENT_DEV_LOGIN=scottw1
BOBSHELL_API_KEY=...
```

Notes:

- `GITHUB_AI_AGENT_CLI` must be exactly `bob`, `claude`, or `codex`.
- No failover. If the selected CLI is unavailable, log and skip the run.
- `BOBSHELL_API_KEY` is passed through only when `GITHUB_AI_AGENT_CLI=bob`.
- Do not persist secrets in files or generated prompts.

## Constants Update

Replace the internal repo map in [constants.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/constants.js) with Carbon defaults:

```js
const GITHUB_OWNER = process.env.GITHUB_AI_AGENT_OWNER || 'carbon-design-system';
const GITHUB_REPO = process.env.GITHUB_AI_AGENT_REPO || 'carbon';
const REVIEW_LABEL = process.env.GITHUB_AI_AGENT_REVIEW_LABEL || 'AIReviewed';
const REVIEW_AGENT = process.env.GITHUB_AI_AGENT_CLI || 'codex';

const N_DAYS_SINCE_PR_CREATED = Number(process.env.GITHUB_AI_AGENT_DAYS_BACK || 21);
const MAX_DIFF_CHARS = Number(process.env.GITHUB_AI_AGENT_MAX_DIFF_CHARS || 120000);
const MAX_PRS_PER_RUN = Number(process.env.GITHUB_AI_AGENT_MAX_PRS || 5);

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  REVIEW_LABEL,
  REVIEW_AGENT,
  N_DAYS_SINCE_PR_CREATED,
  MAX_DIFF_CHARS,
  MAX_PRS_PER_RUN,
};
```

Do not carry over `REPOS`, `SQUADS_LABEL`, project fields, sprint fields, or Watsonx constants.

## GitHub Client

Move Octokit setup into `githubClient.js`:

```js
async function getOctokit() {
  const { Octokit } = await import('@octokit/rest');
  return new Octokit({
    auth: process.env.GITHUB_AI_AGENT_TOKEN,
    baseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
  });
}
```

Functions to expose:

```js
fetchReviewablePRs({ owner, repo, daysBack, label });
fetchPRDiff({ owner, repo, pullNumber });
fetchPRFiles({ owner, repo, pullNumber });
fetchPRDetails({ owner, repo, pullNumber });
postSummaryComment({ owner, repo, pullNumber, body });
postReviewComments({ owner, repo, pullNumber, commitId, comments });
addReviewedLabel({ owner, repo, pullNumber, label });
```

Filtering rules:

- `state === "open"`
- `draft === false`
- created within configured window
- no `AIReviewed` label

This mirrors the stable behavior in the current `fetchRecentPRs`.

## Agent Runner

Use Carbon Migrate’s CLI command style, simplified for Node and single-agent execution.

Reference: [long_running_agent_supervisor.py](/Users/scottw1/PROJECTS/Accessibility/GitHub/carbon-migration/carbon-migrate/front-end-developer/long_running_agent_supervisor.py) has these command shapes:

```py
claude -p --dangerously-skip-permissions --output-format stream-json --verbose <prompt>
codex exec --full-auto <prompt>
bob -p <prompt> --yolo
```

Port that into `agentRunner.js`:

```js
const { spawn } = require('child_process');
const { promisify } = require('util');
const which = promisify(require('which'));

async function resolveAgentExecutable(agent) {
  if (!['bob', 'claude', 'codex'].includes(agent)) {
    throw new Error(`Unsupported review agent: ${agent}`);
  }
  return which(agent);
}

function buildAgentCommand(agent, exe, prompt) {
  if (agent === 'claude') {
    return [
      exe,
      ['-p', '--dangerously-skip-permissions', '--output-format', 'stream-json', '--verbose', prompt],
    ];
  }
  if (agent === 'codex') {
    return [exe, ['exec', '--full-auto', prompt]];
  }
  if (agent === 'bob') {
    return [exe, ['-p', prompt, '--yolo']];
  }
  throw new Error(`Unsupported review agent: ${agent}`);
}
```

Spawn with cloud-safe env:

```js
const env = {
  ...process.env,
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  TERM: 'dumb',
  CI: 'true',
};

if (agent !== 'bob') {
  delete env.BOBSHELL_API_KEY;
}
```

Set a hard timeout per PR, for example 10 minutes. If the agent exits non-zero, do not label the PR.

## Review Bundle

Create one temp directory per PR:

```text
/tmp/github-ai-agent-pr-review/
  carbon-design-system__carbon__pull-1234/
    PR_REVIEW_REQUEST.md
    pr.json
    files.json
    diff.patch
    AGENTS.md
    CLAUDE.md
    .bob/rules/01-output.md
```

`AGENTS.md`, `CLAUDE.md`, and `.bob/rules/01-output.md` should contain the same ground rules so each CLI gets equivalent instructions. Carbon Migrate writes these files in [supervisorService.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/carbon-migration/carbon-migrate/src/services/supervisorService.js), using:

- `AGENTS.md` for Codex
- `CLAUDE.md` for Claude
- `.bob/rules/01-output.md` for Bob

For this project, the rules should say:

```md
# Carbon PR Review Agent Rules

You are reviewing a pull request in carbon-design-system/carbon.

Mandatory:
- Use Carbon Builder skill when available before making any Carbon API, prop, token, icon, accessibility, or design-system claim.
- If Carbon Builder is unavailable, use Carbon MCP tools as ground truth.
- Any unverified Carbon claim is invalid and must not be posted.
- Prefer specific actionable findings over general advice.
- Do not edit files.
- Do not run package manager install commands.
- Produce only the requested JSON object and review Markdown.
```

## Prompt Contract

`reviewPrompt.js` should build one prompt string passed to the CLI. Keep it explicit and machine-parseable:

```md
You are an agentic PR reviewer for carbon-design-system/carbon.

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
END_REVIEW_JSON
```

The parser should reject output that does not include valid JSON between markers.

## Review Comment Strategy

Use the modern GitHub review approach:

1. Post inline review comments for specific findings when file and line can be mapped to the PR diff.
2. Post one summary comment for the whole review.
3. Add `AIReviewed` after successful posting.

If inline mapping fails, include those findings in the summary comment instead of dropping them.

Summary comment template:

```md
[AI agent review — Carbon grounded]

Reviewed by: <agent>
Carbon verification policy: Carbon-specific claims require Carbon Builder or Carbon MCP verification.

<agent summaryMarkdown>

Review artifacts:
- PR: #<number>
- Commit: <head sha>
- Agent: <agent>
```

Do not use the old friendly metadata message from [agent_prs.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/agent_prs.js). Carbon repo comments should be concise and professional.

## `reviewPRs` New Flow

The new [agent_prs.js](/Users/scottw1/PROJECTS/Accessibility/GitHub/rms_server/genAI/github_ai_agents/agent_prs.js) should become roughly:

```js
async function reviewPRs() {
  if (process.env.TRAVIS_BRANCH && process.env.TRAVIS_BRANCH !== 'main') {
    return;
  }

  const prs = await fetchReviewablePRs({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    daysBack: N_DAYS_SINCE_PR_CREATED,
    label: REVIEW_LABEL,
  });

  for (const pr of prs.slice(0, MAX_PRS_PER_RUN)) {
    const bundle = await buildReviewBundle({ owner: GITHUB_OWNER, repo: GITHUB_REPO, pr });
    const agentOutput = await runReviewAgent({
      agent: REVIEW_AGENT,
      cwd: bundle.dir,
      prompt: bundle.prompt,
    });
    const review = parseReviewOutput(agentOutput.stdout);

    await postInlineCommentsWherePossible(review.findings);
    await postSummaryComment({ owner: GITHUB_OWNER, repo: GITHUB_REPO, pullNumber: pr.number, body });
    await addReviewedLabel({ owner: GITHUB_OWNER, repo: GITHUB_REPO, pullNumber: pr.number, label: REVIEW_LABEL });
  }
}
```

Important failure rule:

- If bundle creation fails, skip PR and do not label.
- If agent execution fails, skip PR and do not label.
- If parsing fails, post no review and do not label.
- If posting fails, do not label.

The label means "a review was posted", not "an attempt occurred".

## Carbon Verification Rules

These are hard requirements for the intern implementation and prompt:

- Carbon-specific claims must set `carbonVerified: true`.
- `verificationSource` must be `carbon-builder` or `carbon-mcp` for Carbon-specific claims.
- If a finding cannot be verified, the agent must omit it or mark it as non-Carbon-specific only when it truly is generic code review.
- The summary comment should state that Carbon-specific claims were verified.
- The parser can defensively drop findings with `carbonVerified !== true` when their body mentions `@carbon`, Carbon components, tokens, icons, SCSS imports, or Carbon MCP.

Suggested parser guard:

```js
function looksCarbonSpecific(finding) {
  const text = `${finding.title} ${finding.body} ${finding.file}`.toLowerCase();
  return /carbon|@carbon|cds-|bx-|token|scss|icon|component|design system/.test(text);
}

function filterUnverifiedCarbonFindings(findings) {
  return findings.filter((finding) => {
    if (!looksCarbonSpecific(finding)) return true;
    return finding.carbonVerified === true &&
      ['carbon-builder', 'carbon-mcp'].includes(finding.verificationSource);
  });
}
```

## Cloud Runtime Notes

Because the service runs in cloud:

- The container/image must include the selected CLI binary.
- The selected CLI must be authenticated non-interactively.
- Carbon MCP must be installed/configured for the selected CLI environment.
- For Codex, include `AGENTS.md` in the bundle.
- For Claude, include `CLAUDE.md` in the bundle.
- For Bob, include `.bob/rules/01-output.md` and pass `BOBSHELL_API_KEY` only via env.
- Clean temp review directories after each PR unless `GITHUB_AI_AGENT_KEEP_ARTIFACTS=true`.

Add startup logging:

```js
console.log(`[AI PR Review] repo=${GITHUB_OWNER}/${GITHUB_REPO}`);
console.log(`[AI PR Review] selectedAgent=${REVIEW_AGENT}`);
console.log(`[AI PR Review] label=${REVIEW_LABEL}`);
```

Never log token values or API keys.

## Testing Plan

Minimum manual test path:

1. Set `GITHUB_AI_AGENT_DEV_LOGIN` to your GitHub login.
2. Set `GITHUB_AI_AGENT_MAX_PRS=1`.
3. Run `node -e "require('./genAI/github_ai_agents/agent_prs').reviewPRs()"`.
4. Confirm one eligible non-draft Carbon PR is reviewed.
5. Confirm summary comment appears.
6. Confirm `AIReviewed` is added only after comment success.
7. Re-run and confirm the same PR is skipped.

Unit-level tests or smoke tests:

- `buildAgentCommand('codex')` returns `codex exec --full-auto`.
- `buildAgentCommand('claude')` returns Claude print mode with stream JSON.
- `buildAgentCommand('bob')` returns Bob print mode with `--yolo`.
- `parseReviewOutput` rejects missing markers.
- `filterUnverifiedCarbonFindings` drops unverified Carbon findings.
- `fetchReviewablePRs` filters draft and `AIReviewed` PRs.

## Migration Phases

### Phase 1: Configuration cleanup

- Replace old multi-repo constants with Carbon repo env-backed constants.
- Keep `reviewPRs` export stable.
- Remove Watsonx imports from `agent_prs.js`.

### Phase 2: GitHub operations

- Extract Octokit code into `githubClient.js`.
- Implement public GitHub support via `https://api.github.com`.
- Keep `AIReviewed` label add behavior.

### Phase 3: Review bundle

- Build temp directory.
- Write PR metadata, changed files, and diff.
- Write agent rule files for Codex, Claude, and Bob.

### Phase 4: Agent runner

- Implement CLI detection and command building.
- Implement timeout and stdout/stderr capture.
- No failover.

### Phase 5: Review parser and posting

- Parse marked JSON.
- Filter unverified Carbon findings.
- Post inline comments where possible.
- Post summary comment.
- Add `AIReviewed`.

### Phase 6: Cloud hardening

- Add startup preflight for selected CLI.
- Add temp cleanup.
- Add max PR cap.
- Add clear logs without secrets.

## Definition Of Done

The port is complete when:

- `index.js` still runs the daily `reviewPRs()` schedule unchanged.
- Watsonx is no longer used by the PR review job.
- The job reviews `carbon-design-system/carbon` PRs.
- Exactly one selected CLI agent reviews each PR.
- Bob, Claude, and Codex command builders are supported.
- Carbon-specific review findings must be grounded in Carbon Builder or Carbon MCP.
- The job posts a review comment and optional inline comments.
- `AIReviewed` is applied only after the review is posted.
- Already-labeled PRs are skipped.
- No old internal metadata automation remains in the Carbon path.
