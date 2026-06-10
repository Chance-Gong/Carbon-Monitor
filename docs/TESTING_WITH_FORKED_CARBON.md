# Testing PR Review Agent with Forked Carbon Repository

This guide walks you through setting up a forked Carbon Design System repository for safe, realistic testing of the PR Review Agent.

## Why Fork Carbon for Testing?

✅ **Realistic code structure** - Test with actual Carbon components and patterns  
✅ **Safe environment** - No risk of commenting on production PRs  
✅ **Full control** - Create, modify, and close test PRs as needed  
✅ **Complete workflow** - Test the entire GitHub integration end-to-end  

## Prerequisites

- GitHub account
- Git installed locally
- Carbon PR Review Agent already set up (see [README.md](../README.md))
- GitHub Personal Access Token with `repo` scope

## Step 1: Fork the Carbon Repository

### On GitHub

1. Navigate to https://github.com/carbon-design-system/carbon
2. Click the **Fork** button in the top-right corner
3. Select your account as the destination
4. **Uncheck** "Copy the main branch only" to get all branches (optional)
5. Click **Create fork**

Your fork will be at: `https://github.com/YOUR-USERNAME/carbon`

### Clone Your Fork Locally

```bash
# Clone your fork
cd ~/Documents/GitHub
git clone https://github.com/YOUR-USERNAME/carbon.git carbon-fork
cd carbon-fork

# Add upstream remote (to pull latest Carbon changes if needed)
git remote add upstream https://github.com/carbon-design-system/carbon.git

# Verify remotes
git remote -v
# Should show:
# origin    https://github.com/YOUR-USERNAME/carbon.git (fetch)
# origin    https://github.com/YOUR-USERNAME/carbon.git (push)
# upstream  https://github.com/carbon-design-system/carbon.git (fetch)
# upstream  https://github.com/carbon-design-system/carbon.git (push)
```

## Step 2: Configure PR Review Agent

### Update Environment Variables

Edit your `.env` file in the Carbon-PR-Review-Agent directory:

```bash
cd ~/Documents/GitHub/Carbon-PR-Review-Agent
nano .env  # or use your preferred editor
```

Update these values:

```bash
# Point to YOUR fork
GITHUB_AI_AGENT_OWNER=YOUR-USERNAME
GITHUB_AI_AGENT_REPO=carbon

# Your GitHub token (needs repo access to YOUR fork)
GITHUB_AI_AGENT_TOKEN=ghp_your_token_here

# Agent configuration
GITHUB_AI_AGENT_CLI=bob
BOBSHELL_API_KEY=your_bob_key_here

# Testing settings (optional)
GITHUB_AI_AGENT_MAX_PRS=3
GITHUB_AI_AGENT_DAYS_BACK=30
GITHUB_AI_AGENT_REVIEW_LABEL=AIReviewed
```

### Verify Configuration

```bash
# Check your .env file
cat .env | grep GITHUB_AI_AGENT_OWNER
cat .env | grep GITHUB_AI_AGENT_REPO

# Should show YOUR username, not carbon-design-system
```

## Step 3: Create Test PRs

### Option A: Simple Test PR (Quick Start)

Create a test PR with a small, intentional issue:

```bash
cd ~/Documents/GitHub/carbon-fork

# Create a test branch
git checkout -b test/pr-review-agent-1

# Make a simple change with an intentional issue
cat > test-component.js << 'EOF'
// Test component with intentional issues for PR review
import React from 'react';

export function TestButton() {
  // Issue 1: Magic number
  const width = 42;
  
  // Issue 2: Missing accessibility
  return (
    <button style={{ width: width }}>
      Click me
    </button>
  );
}
EOF

# Commit and push
git add test-component.js
git commit -m "Add test component for PR review testing"
git push origin test/pr-review-agent-1
```

### Option B: Realistic Carbon Component Change

Modify an actual Carbon component:

```bash
cd ~/Documents/GitHub/carbon-fork

# Create a test branch
git checkout -b test/button-accessibility-fix

# Find a component to modify
cd packages/react/src/components/Button

# Make a realistic change (example: add a prop)
# Edit Button.tsx or Button.js
nano Button.tsx

# Example change: Add a new optional prop
# Add this to the component's props interface:
#   testId?: string;
# 
# Then use it in the component:
#   data-testid={testId}

# Commit and push
git add .
git commit -m "feat(Button): add testId prop for testing"
git push origin test/button-accessibility-fix
```

### Option C: Copy Real Carbon PR Changes

Find an interesting PR from the real Carbon repo and recreate it:

```bash
# 1. Go to https://github.com/carbon-design-system/carbon/pulls
# 2. Find a merged PR with interesting changes
# 3. Note the PR number (e.g., #12345)

cd ~/Documents/GitHub/carbon-fork

# Fetch the PR from upstream
git fetch upstream pull/12345/head:test/recreate-pr-12345
git checkout test/recreate-pr-12345

# Push to your fork
git push origin test/recreate-pr-12345
```

### Create the PR on GitHub

1. Go to your fork: `https://github.com/YOUR-USERNAME/carbon`
2. Click **Pull requests** → **New pull request**
3. Ensure base repository is **YOUR-USERNAME/carbon** (not the upstream!)
4. Select your test branch as the compare branch
5. Click **Create pull request**
6. Add a title and description
7. Click **Create pull request**

## Step 4: Run the PR Review Agent

### Test Single PR Review

```bash
cd ~/Documents/GitHub/Carbon-PR-Review-Agent

# Run the agent
npm start

# Or run directly
node src/index.js
```

Expected output:
```
🔍 Fetching reviewable PRs...
Found 1 PR(s) to review

📝 Reviewing PR #1: Add test component for PR review testing
  - Fetching diff...
  - Building review bundle...
  - Running bob agent...
  ✅ bob review received
  🔍 Parsing review output...
  ⚠️  No END_REVIEW_JSON marker, attempting to parse incomplete JSON
  🔧 Attempting to repair truncated JSON...
  ✂️  Truncated to last complete finding
  ✅ Successfully repaired JSON
  ⚠️  Allowing Carbon finding with detailed reference (fallback): Icon-only button missing iconDescription
  ⚠️  Allowing Carbon finding with detailed reference (fallback): DataTable missing required 'headers' prop
  ✅ Parsed: 12 findings
  - Posting review comment...
  - Adding AIReviewed label...
✅ Review complete!

Summary:
- PRs reviewed: 1
- Comments posted: 1
- Labels added: 1
```

**Note:** The ⚠️ caution messages are **normal and expected**. They indicate the system is working correctly with built-in safety mechanisms. See [Understanding Review Cautions](./UNDERSTANDING_REVIEW_CAUTIONS.md) for a detailed explanation of each warning.

### Verify the Review

1. Go to your PR on GitHub
2. Check for the AI review comment
3. Verify the `AIReviewed` label was added
4. Review the findings and their severity levels

## Step 5: Test Different Scenarios

### Scenario 1: Multiple PRs

Create 3-5 test PRs with different types of issues:

```bash
cd ~/Documents/GitHub/carbon-fork

# PR 1: Accessibility issues
git checkout -b test/a11y-issues
# Add component with missing ARIA labels
git push origin test/a11y-issues

# PR 2: Performance issues  
git checkout main
git checkout -b test/performance-issues
# Add component with inefficient rendering
git push origin test/performance-issues

# PR 3: Style inconsistencies
git checkout main
git checkout -b test/style-issues
# Add component with non-Carbon spacing
git push origin test/style-issues
```

Create PRs for each branch, then run:

```bash
cd ~/Documents/GitHub/Carbon-PR-Review-Agent
GITHUB_AI_AGENT_MAX_PRS=5 npm start
```

### Scenario 2: Large Diff Testing

Create a PR with many file changes:

```bash
cd ~/Documents/GitHub/carbon-fork
git checkout -b test/large-diff

# Copy multiple components
cp packages/react/src/components/Button/Button.tsx packages/react/src/components/Button/Button.test.tsx
# Make changes to several files
# ...

git add .
git commit -m "test: large diff with multiple components"
git push origin test/large-diff
```

### Scenario 3: Already Reviewed PR

Test that the agent skips PRs with the `AIReviewed` label:

1. Create a PR
2. Run the agent (it will review and add label)
3. Run the agent again (it should skip this PR)

```bash
npm start
# First run: Reviews PR #1
npm start  
# Second run: Skips PR #1 (already has AIReviewed label)
```

### Scenario 4: Carbon-Specific Verification

Create a PR that makes Carbon-specific claims:

```bash
cd ~/Documents/GitHub/carbon-fork
git checkout -b test/carbon-tokens

# Create a file that uses Carbon tokens
cat > test-carbon-usage.scss << 'EOF'
@use '@carbon/styles/scss/spacing' as *;
@use '@carbon/styles/scss/theme' as *;

.my-component {
  // Using Carbon spacing tokens
  padding: $spacing-05;
  margin: $spacing-03;
  
  // Using Carbon theme tokens
  background-color: $background;
  color: $text-primary;
}
EOF

git add test-carbon-usage.scss
git commit -m "feat: use Carbon spacing and theme tokens"
git push origin test/carbon-tokens
```

Create the PR and run the agent to see how it handles Carbon-specific code.

## Step 6: Iterate and Refine

### Review Agent Output

After each test run, check:

1. **Comment quality**: Are findings clear and actionable?
2. **Severity accuracy**: Are critical issues marked correctly?
3. **False positives**: Any incorrect findings?
4. **Carbon verification**: Are Carbon claims being verified?

### Adjust Agent Configuration

Based on results, tune your `.env` settings:

```bash
# Increase/decrease PR limit
GITHUB_AI_AGENT_MAX_PRS=10

# Adjust time window
GITHUB_AI_AGENT_DAYS_BACK=7

# Skip Carbon filtering for testing
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true
```

### Clean Up Test PRs

After testing, close and delete test PRs:

```bash
# On GitHub:
# 1. Go to each test PR
# 2. Click "Close pull request"
# 3. Optionally delete the branch

# Locally, clean up branches:
cd ~/Documents/GitHub/carbon-fork
git checkout main
git branch -D test/pr-review-agent-1
git branch -D test/button-accessibility-fix
# ... delete other test branches

# Delete remote branches
git push origin --delete test/pr-review-agent-1
git push origin --delete test/button-accessibility-fix
```

## Step 7: Advanced Testing

### Test with Real Carbon PRs

Periodically sync your fork with upstream to test against real changes:

```bash
cd ~/Documents/GitHub/carbon-fork

# Fetch latest from upstream
git fetch upstream

# Merge upstream changes
git checkout main
git merge upstream/main

# Push to your fork
git push origin main

# Now create test branches based on recent upstream changes
git checkout -b test/based-on-latest upstream/main
# Make your test changes
```

### Test Error Handling

Intentionally create problematic scenarios:

1. **Invalid diff**: Create a PR with binary files
2. **Timeout**: Create a PR with 100+ file changes
3. **API errors**: Temporarily use invalid GitHub token
4. **Parse errors**: Modify agent output format

### Test Different Agents

Switch between Bob, Claude, and Codex:

```bash
# Test with Bob
GITHUB_AI_AGENT_CLI=bob npm start

# Test with Claude
GITHUB_AI_AGENT_CLI=claude npm start

# Compare results
```

## Troubleshooting

### Agent Reviews Wrong Repository

**Problem**: Agent is still reviewing carbon-design-system/carbon instead of your fork

**Solution**:
```bash
# Verify .env configuration
cat .env | grep GITHUB_AI_AGENT_OWNER
# Should show YOUR username

# Restart any running processes
# Re-run the agent
npm start
```

### No PRs Found

**Problem**: Agent reports "Found 0 PR(s) to review"

**Solution**:
```bash
# Check that PRs exist in your fork
# Go to: https://github.com/YOUR-USERNAME/carbon/pulls

# Verify PRs are:
# 1. Open (not closed)
# 2. Don't have AIReviewed label
# 3. Created within GITHUB_AI_AGENT_DAYS_BACK window

# Increase time window
GITHUB_AI_AGENT_DAYS_BACK=90 npm start
```

### Permission Errors

**Problem**: "Resource not accessible by integration" or 403 errors

**Solution**:
```bash
# Verify your GitHub token has correct permissions:
# - repo (full repository access)
# - write:discussion (for comments)

# Generate new token at: https://github.com/settings/tokens
# Update .env with new token
```

### Fork Out of Sync

**Problem**: Your fork is behind upstream Carbon

**Solution**:
```bash
cd ~/Documents/GitHub/carbon-fork

# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Best Practices

1. **Use descriptive branch names**: `test/scenario-description`
2. **Create diverse test cases**: Cover different issue types
3. **Document findings**: Keep notes on agent performance
4. **Clean up regularly**: Delete old test PRs and branches
5. **Test incrementally**: Start with simple PRs, then increase complexity
6. **Version control**: Tag successful test configurations
7. **Sync periodically**: Keep fork updated with upstream Carbon

## Next Steps

After successful testing with your fork:

1. **Document findings**: Create a test report
2. **Tune configuration**: Optimize agent settings
3. **Production readiness**: Decide if ready for real Carbon PRs
4. **Monitoring**: Set up logging and alerting
5. **Rollout plan**: Gradual introduction to production

## Resources

- [Carbon Design System](https://github.com/carbon-design-system/carbon)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [PR Review Agent README](../README.md)
- [Carbon Setup Guide](./CARBON_SETUP.md)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review agent logs in the terminal
3. Verify GitHub token permissions
4. Test with a minimal PR first
5. Open an issue in the Carbon-PR-Review-Agent repository

---

**Happy Testing! 🚀**