# Local Testing Guide - Review Carbon PRs in Your Own Repository

This guide shows you how to create test PRs in YOUR repository based on Carbon PRs, so you can run the review agent locally and see all comments/reviews without affecting the Carbon repository.

## Why This Approach?

✅ **Safe**: All reviews happen in YOUR repository  
✅ **Local**: Test the review agent on your machine  
✅ **No Impact**: Carbon repository is never modified  
✅ **Full Features**: See comments, reviews, and labels in action  
✅ **Learning**: Understand how the agent works before using it on real PRs  

## Quick Start

### Step 1: Browse Carbon PRs

First, see what PRs are available:

```bash
node examples/fetch-carbon-pr.js
```

This shows you recent Carbon PRs. Pick one that interests you (e.g., PR #22425).

### Step 2: Create Test PR in Your Repo

```bash
node examples/create-test-pr.js 22425
```

This will:
1. ✅ Fetch Carbon PR #22425
2. ✅ Create a new branch in YOUR repository
3. ✅ Create test files based on the Carbon PR
4. ✅ Push to YOUR GitHub
5. ✅ Create a PR in YOUR repository

### Step 3: Configure Review Agent

Update your `.env` file to point to YOUR repository:

```bash
GITHUB_AI_AGENT_OWNER=your-github-username
GITHUB_AI_AGENT_REPO=your-repo-name
GITHUB_AI_AGENT_MAX_PRS=1
```

### Step 4: Run Review Agent

```bash
npm start
```

The agent will:
- Find your test PR
- Analyze the changes
- Post inline comments
- Post a review summary
- Add the AIReviewed label

### Step 5: Check Your PR

Visit your PR on GitHub to see:
- 💬 Inline comments on specific lines
- 📝 Review summary comment
- 🏷️ AIReviewed label
- 📊 Token usage statistics

## Detailed Workflow

### Example: Testing with Carbon PR #22425

Let's walk through a complete example:

#### 1. Browse Available PRs

```bash
$ node examples/fetch-carbon-pr.js

Found 33 open PR(s):

1. PR #22425: fix: comboBox input field now clears when value is cleared externally
   👤 @sanraj2000 | 📅 6/10/2026
   🔗 https://github.com/carbon-design-system/carbon/pull/22425
```

#### 2. Create Test PR

```bash
$ node examples/create-test-pr.js 22425

🔧 Creating Test PR from Carbon PR #22425
================================================================================

📍 Your repository: your-username/your-repo

📥 Step 1: Fetching Carbon PR #22425...
   ✅ fix: comboBox input field now clears when value is cleared externally
   👤 by @sanraj2000

📄 Step 2: Fetching diff...
   ✅ Diff size: 3601 characters

📁 Step 3: Fetching changed files...
   ✅ 2 files changed

🌿 Step 4: Creating branch 'test-carbon-pr-22425'...
   ✅ Created and switched to 'test-carbon-pr-22425'

💾 Step 5: Saving diff to file...
   ✅ Saved to: /path/to/carbon-pr-diff.patch

📝 Step 6: Creating test files...
   ✅ Created summary: carbon-pr-test/PR-22425-summary.md
   ✅ Created: carbon-pr-test/1-combo-box-test.js
   ✅ Created: carbon-pr-test/2-combo-box.ts

💾 Step 7: Committing changes...
   ✅ Changes committed

📤 Step 8: Pushing to GitHub...
   ✅ Pushed to origin/test-carbon-pr-22425

🎯 Step 9: Creating PR in your repository...
   ✅ PR created successfully!

================================================================================
🎉 SUCCESS! Your test PR is ready!

📌 PR #123: [Test] fix: comboBox input field now clears when value is cleared externally
🔗 URL: https://github.com/your-username/your-repo/pull/123

Next steps:
1. Update your .env file:
   GITHUB_AI_AGENT_OWNER=your-username
   GITHUB_AI_AGENT_REPO=your-repo

2. Run the review agent:
   npm start

3. Check your PR for comments and reviews!
   https://github.com/your-username/your-repo/pull/123

================================================================================
```

#### 3. Update Configuration

Edit your `.env` file:

```bash
# Point to YOUR repository
GITHUB_AI_AGENT_OWNER=your-username
GITHUB_AI_AGENT_REPO=your-repo

# Review only 1 PR at a time
GITHUB_AI_AGENT_MAX_PRS=1

# Enable comments and summary
GITHUB_AI_AGENT_POST_INLINE_COMMENTS=true
GITHUB_AI_AGENT_POST_SUMMARY_COMMENT=true
```

#### 4. Run the Review Agent

```bash
$ npm start

[AI PR Review] repo=your-username/your-repo
[AI PR Review] selectedAgent=bob
[AI PR Review] label=AIReviewed
✅ Agent 'bob' is available
✅ carbon-mcp MCP server is available

📥 Fetching reviewable PRs...
Found 1 PR(s) to review

================================================================================
📌 Reviewing PR #123: [Test] fix: comboBox input field now clears when value is cleared externally
   Author: @your-username
   Created: 6/10/2026
================================================================================

📄 Fetching PR diff...
✅ Diff: 3601 characters
📁 Fetching changed files...
✅ Files: 3 changed
   - carbon-pr-test/PR-22425-summary.md (+50/-0)
   - carbon-pr-test/1-combo-box-test.js (+37/-0)
   - carbon-pr-test/2-combo-box.ts (+20/-3)

📦 Creating review bundle...
✅ Bundle: /tmp/review-bundle-123

🤖 Running bob review...
This may take 30-60 seconds...

✅ bob review received
🔍 Parsing review output...
✅ Parsed: 5 findings

🔍 Mapping findings to diff positions...
✅ Inline: 3, Summary: 2

💬 Posting inline review comments...
✅ Posted 3 inline comment(s)

📊 Calculating token usage...
✅ Estimated tokens: ~15,000 (input: ~12,000, output: ~3,000)

📝 Posting summary comment...
✅ Summary comment posted

🏷️  Adding review label...
✅ Label added

✅ PR #123 review complete

================================================================================
✅ Carbon PR Review Agent Complete
================================================================================
```

#### 5. View Results on GitHub

Visit your PR: `https://github.com/your-username/your-repo/pull/123`

You'll see:

**Inline Comments** (example):
```
📍 carbon-pr-test/2-combo-box.ts:15

🤖 Bob's Review

**Category**: Code Quality
**Severity**: Medium

The `shouldUpdate()` method logic could be simplified...

**Suggestion**: Consider extracting this logic into a separate method...
```

**Summary Comment**:
```
# 🤖 AI Code Review Summary

**Agent**: bob
**PR**: #123
**Commit**: abc123

## 📊 Review Statistics
- Total Findings: 5
- Inline Comments: 3
- Summary Items: 2

## 🎯 Key Findings
1. [Medium] Code Quality: shouldUpdate() logic could be simplified
2. [Low] Documentation: Add JSDoc comments for new methods
...

## 📈 Token Usage
- Input: ~12,000 tokens
- Output: ~3,000 tokens
- Total: ~15,000 tokens
```

## What Gets Created

When you run `create-test-pr.js`, it creates:

```
your-repo/
├── carbon-pr-test/
│   ├── PR-22425-summary.md          # Summary of the Carbon PR
│   ├── 1-combo-box-test.js          # Sample file 1
│   └── 2-combo-box.ts               # Sample file 2
└── carbon-pr-diff.patch             # Full diff from Carbon PR
```

## Use Cases

### 1. Learning the Review Agent
Test the agent on real Carbon PRs without any risk.

### 2. Testing Configuration
Try different agent settings (bob, claude, codex) and see the results.

### 3. Developing New Features
Test changes to the review agent on real-world PRs.

### 4. Training
Show others how the review agent works with live examples.

### 5. Debugging
Investigate issues with specific types of PRs.

## Tips & Best Practices

### Choose Good Test PRs

Look for PRs with:
- ✅ Clear, focused changes (not too large)
- ✅ Good test coverage
- ✅ Interesting patterns to review
- ✅ Mix of code, tests, and documentation

Examples:
```bash
# Bug fixes (usually small and focused)
node examples/create-test-pr.js 22425

# New features (more complex)
node examples/create-test-pr.js 22426

# Accessibility improvements
node examples/create-test-pr.js 22424
```

### Clean Up After Testing

After you're done testing:

```bash
# Delete the test PR on GitHub
# (via GitHub UI or gh CLI)

# Delete the local branch
git checkout main
git branch -D test-carbon-pr-22425

# Delete the remote branch
git push origin --delete test-carbon-pr-22425

# Clean up test files
rm -rf carbon-pr-test/
rm carbon-pr-diff.patch
```

### Test Multiple PRs

Create multiple test PRs to compare:

```bash
node examples/create-test-pr.js 22425  # Bug fix
node examples/create-test-pr.js 22426  # Feature
node examples/create-test-pr.js 22424  # Accessibility

# Then review them all
npm start
```

### Customize the Test

You can modify the test files before running the review:

```bash
# Create test PR
node examples/create-test-pr.js 22425

# Edit the files in carbon-pr-test/
# Add your own code, comments, etc.

# Commit changes
git add .
git commit -m "Customize test"
git push

# Run review
npm start
```

## Troubleshooting

### "Not in a git repository"
Make sure you're in your git repository root:
```bash
cd /path/to/your/repo
node examples/create-test-pr.js 22425
```

### "Could not determine GitHub repository"
Make sure you have a GitHub remote:
```bash
git remote -v
# Should show: origin  https://github.com/your-username/your-repo.git
```

### "Error creating PR"
This might happen if:
- A PR already exists for this branch
- The base branch doesn't exist
- You don't have push permissions

Solution: Create the PR manually at:
`https://github.com/your-username/your-repo/compare/test-carbon-pr-22425`

### "No PRs need review"
Make sure your `.env` points to YOUR repository:
```bash
GITHUB_AI_AGENT_OWNER=your-username  # Not carbon-design-system
GITHUB_AI_AGENT_REPO=your-repo       # Not carbon
```

## Advanced Usage

### Test with Different Agents

```bash
# Test with Bob
GITHUB_AI_AGENT_CLI=bob npm start

# Test with Claude
GITHUB_AI_AGENT_CLI=claude npm start

# Test with Codex
GITHUB_AI_AGENT_CLI=codex npm start
```

### Keep Artifacts for Debugging

```bash
GITHUB_AI_AGENT_KEEP_ARTIFACTS=true npm start
```

This keeps the review bundle in `/tmp/review-bundle-*` for inspection.

### Disable Comments (Dry Run)

```bash
GITHUB_AI_AGENT_POST_INLINE_COMMENTS=false npm start
GITHUB_AI_AGENT_POST_SUMMARY_COMMENT=false npm start
```

This runs the review but doesn't post anything to GitHub.

## Summary

This workflow lets you:
1. ✅ Safely test the review agent on real Carbon PRs
2. ✅ See all features (comments, reviews, labels) in action
3. ✅ Learn how the agent works without risk
4. ✅ Develop and debug new features
5. ✅ All in YOUR repository, on YOUR machine

**Remember**: The Carbon repository is never touched. Everything happens in your own repository!

## Next Steps

- Try creating a test PR: `node examples/create-test-pr.js 22425`
- Run the review agent: `npm start`
- Check your PR on GitHub
- Experiment with different Carbon PRs
- Customize the test files
- Share your findings!

Happy testing! 🎉