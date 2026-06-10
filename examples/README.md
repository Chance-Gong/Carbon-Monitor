# Carbon PR Examples

This directory contains example scripts for fetching and testing PRs from the Carbon Design System repository.

## 🎯 Two Ways to Work with Carbon PRs

### 1. **Browse & Fetch** (Read-Only)
Just view Carbon PRs without making any changes.
- Script: [`fetch-carbon-pr.js`](fetch-carbon-pr.js)
- Guide: [README.md](README.md)

### 2. **Create Test PRs** (Local Testing)
Create test PRs in YOUR repository to run the review agent locally.
- Script: [`create-test-pr.js`](create-test-pr.js)
- Guide: [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)

---

## Quick Start - Browse Carbon PRs

## Quick Start

### 1. Set up your environment

Make sure you have a `.env` file in the project root with your GitHub token:

```bash
GITHUB_AI_AGENT_TOKEN=ghp_your_token_here
```

Get a token at: https://github.com/settings/tokens (needs `repo` scope for private repos, or `public_repo` for public repos)

### 2. Install dependencies

```bash
npm install
```

### 3. Run the examples

#### List recent open PRs from Carbon

```bash
node examples/fetch-carbon-pr.js
```

This will show you the 10 most recent open PRs from `carbon-design-system/carbon`.

#### Fetch a specific PR

```bash
node examples/fetch-carbon-pr.js 12345
```

Replace `12345` with any PR number from the Carbon repository.

## What You'll See

When you fetch a specific PR, the script will display:

- **PR Information**: Title, author, dates, status, labels
- **Description**: The PR description/body
- **Changed Files**: List of all files modified with additions/deletions
- **Diff Preview**: First 50 lines of the unified diff (color-coded)
- **Summary Statistics**: Total changes, file count, diff size

## Example Output

```
🔍 Fetching PR #12345 from carbon-design-system/carbon...

================================================================================
📌 PR #12345: Add new Button component variant
================================================================================
👤 Author: @developer
📅 Created: 1/15/2026
📅 Updated: 1/16/2026
🔗 URL: https://github.com/carbon-design-system/carbon/pull/12345
📊 Status: open
💬 Comments: 5
✅ Additions: +150
❌ Deletions: -20
📝 Changed Files: 3
🏷️  Labels: enhancement, component

📄 Description:
--------------------------------------------------------------------------------
This PR adds a new variant to the Button component...
================================================================================

📁 Changed Files:
--------------------------------------------------------------------------------
1. ✏️ packages/react/src/components/Button/Button.js
   +75 -10 (85 changes)
   
2. 🆕 packages/react/src/components/Button/Button.stories.js
   +50 -0 (50 changes)
   
3. ✏️ packages/react/src/components/Button/Button.scss
   +25 -10 (35 changes)

📄 Diff Preview (first 50 lines):
--------------------------------------------------------------------------------
diff --git a/packages/react/src/components/Button/Button.js b/packages/react/src/components/Button/Button.js
...
```

## Use Cases

Once you've fetched a PR, you can use the data for:

1. **Code Review Analysis**: Analyze the changes for quality, patterns, and best practices
2. **Carbon Design System Verification**: Check if changes follow Carbon guidelines
3. **Automated Testing**: Generate test cases based on the changes
4. **Documentation**: Create or update documentation based on new features
5. **Integration Testing**: Test how changes integrate with existing code

## API Reference

The script uses the GitHub client from `src/githubClient.js` which provides:

- `fetchReviewablePRs()`: Get list of open PRs
- `fetchPRFiles()`: Get list of changed files in a PR
- `fetchPRDiff()`: Get unified diff for a PR
- `postReviewComments()`: Post inline review comments
- `postSummaryComment()`: Post a summary comment
- `addReviewedLabel()`: Add a label to a PR

## Next Steps

After fetching a PR, you can:

1. **Run the full review agent**:
   ```bash
   npm start
   ```

2. **Test specific components**:
   ```bash
   npm run test
   ```

3. **Integrate with your workflow**: Use the fetched data in your own scripts

## Troubleshooting

### "GITHUB_AI_AGENT_TOKEN not set"

Create a `.env` file with your GitHub token. See `.env.example` for the template.

### "PR not found"

Make sure the PR number exists in the `carbon-design-system/carbon` repository. You can check at:
https://github.com/carbon-design-system/carbon/pulls

### Rate limiting

GitHub API has rate limits. If you hit them:
- Wait an hour for the limit to reset
- Use a personal access token (higher limits)
- Check your rate limit: https://api.github.com/rate_limit

## Quick Start - Create Test PRs

Want to run the review agent on Carbon PRs in YOUR repository? See the [Local Testing Guide](LOCAL_TESTING_GUIDE.md).

```bash
# 1. Browse Carbon PRs
node examples/fetch-carbon-pr.js

# 2. Create a test PR in YOUR repo
node examples/create-test-pr.js 22425

# 3. Update .env to point to YOUR repo
# GITHUB_AI_AGENT_OWNER=your-username
# GITHUB_AI_AGENT_REPO=your-repo

# 4. Run the review agent
npm start

# 5. Check YOUR PR for comments and reviews!
```

**Benefits:**
- ✅ Safe - All reviews happen in YOUR repository
- ✅ Local - Test on your machine
- ✅ No Impact - Carbon repository is never touched
- ✅ Full Features - See comments, reviews, and labels in action

## Learn More

- [Local Testing Guide](LOCAL_TESTING_GUIDE.md) - Create test PRs in your repo
- [Usage Guide](USAGE_GUIDE.md) - Detailed usage examples
- [Carbon Design System](https://carbondesignsystem.com/)
- [Carbon GitHub Repository](https://github.com/carbon-design-system/carbon)
- [GitHub API Documentation](https://docs.github.com/en/rest)
