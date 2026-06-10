# Carbon PR Fetcher - Usage Guide

## What You Just Did

You successfully fetched PR #22425 from the Carbon Design System repository! Here's what you learned:

### PR Details Retrieved:
- **Title**: fix: comboBox input field now clears when value is cleared externally
- **Author**: @sanraj2000
- **Status**: Open (3 comments)
- **Changes**: +57 additions, -3 deletions across 2 files
- **Issue**: Closes #20319

### Files Changed:
1. `combo-box-test.js` - Added test cases (+37 lines)
2. `combo-box.ts` - Fixed the ComboBox component logic (+20/-3 lines)

## How to Use This Data

### 1. Quick PR Browsing
```bash
# List recent PRs
node examples/fetch-carbon-pr.js

# View specific PR
node examples/fetch-carbon-pr.js 22425
```

### 2. Integrate with Your Review Agent

You can now use this PR data with your review agent:

```bash
# Set the PR number in your .env
GITHUB_AI_AGENT_OWNER=carbon-design-system
GITHUB_AI_AGENT_REPO=carbon

# Run the full review agent
npm start
```

### 3. Analyze Specific Aspects

The fetched data includes:

**PR Metadata:**
- Title, description, author
- Creation/update dates
- Labels, status, comments count

**Code Changes:**
- List of changed files
- Additions/deletions per file
- Full unified diff with color coding

**Use Cases:**
- ✅ Code quality review
- ✅ Carbon Design System compliance check
- ✅ Test coverage analysis
- ✅ Documentation verification
- ✅ Breaking change detection

### 4. Example: Analyzing PR #22425

This PR is a **bug fix** for the ComboBox component:

**What Changed:**
- Fixed input field not clearing when value is set to empty externally
- Added comprehensive test cases for the fix
- Modified the `shouldUpdate()` and `updated()` lifecycle methods

**Review Points:**
- ✅ Includes test cases (good practice)
- ✅ Fixes a reported issue (#20319)
- ✅ Small, focused change (60 lines)
- ✅ Follows Carbon's web components pattern

**Carbon Verification:**
- Component: `cds-combo-box` (Carbon web component)
- Pattern: Follows Carbon's lifecycle methods
- Testing: Uses Carbon's test utilities

## Next Steps

### Option 1: Review More PRs
```bash
# Try these interesting PRs:
node examples/fetch-carbon-pr.js 22426  # Codemod for PageHeader
node examples/fetch-carbon-pr.js 22424  # Accessibility fix
node examples/fetch-carbon-pr.js 22418  # Tree shaking improvements
```

### Option 2: Run Full Review Agent

To run the complete AI-powered review on Carbon PRs:

1. Update your `.env`:
   ```bash
   GITHUB_AI_AGENT_OWNER=carbon-design-system
   GITHUB_AI_AGENT_REPO=carbon
   GITHUB_AI_AGENT_MAX_PRS=1
   ```

2. Run the agent:
   ```bash
   npm start
   ```

### Option 3: Create Custom Analysis

Use the fetched data in your own scripts:

```javascript
const { createGitHubClient } = require('./src/githubClient');
const { Octokit } = require('@octokit/rest');

async function analyzeCarbon() {
  const octokit = new Octokit({ auth: process.env.GITHUB_AI_AGENT_TOKEN });
  const client = createGitHubClient(octokit);
  
  // Fetch PR data
  const diff = await client.fetchPRDiff({
    owner: 'carbon-design-system',
    repo: 'carbon',
    pullNumber: 22425
  });
  
  // Your custom analysis here
  console.log('Analyzing Carbon PR...');
}
```

## Understanding the Output

### Color-Coded Diff
- 🟢 **Green lines** (`+`): Added code
- 🔴 **Red lines** (`-`): Removed code
- 🔵 **Cyan lines** (`@@`): Location markers
- ⚪ **White lines**: Context (unchanged)

### File Status Icons
- 🆕 **Added**: New file
- ✏️ **Modified**: Changed file
- 🗑️ **Removed**: Deleted file

### PR Status
- **Open**: Active PR awaiting review
- **Draft**: Work in progress
- **Closed**: Merged or rejected

## Tips for Carbon PRs

1. **Look for Carbon Components**: PRs often modify components like Button, ComboBox, DataTable
2. **Check Test Coverage**: Good PRs include test files (`*-test.js`)
3. **Verify Accessibility**: Look for `a11y` labels or accessibility-related changes
4. **Review Breaking Changes**: Check for version bumps or migration guides
5. **Carbon Patterns**: Ensure changes follow Carbon Design System guidelines

## Common Carbon PR Patterns

### Component Updates
- Location: `packages/react/src/components/`
- Tests: `packages/react/src/components/**/__tests__/`
- Styles: `packages/react/src/components/**/*.scss`

### Web Components
- Location: `packages/web-components/src/components/`
- Tests: `packages/web-components/src/components/**/__tests__/`

### Icons & Assets
- Location: `packages/icons/`, `packages/pictograms/`

### Documentation
- Location: `docs/`, `*.md` files

## Troubleshooting

### "No PRs found"
- Carbon might not have open PRs at the moment
- Try adjusting `GITHUB_AI_AGENT_DAYS_BACK` in `.env`

### "Rate limit exceeded"
- GitHub API has rate limits (60/hour unauthenticated, 5000/hour authenticated)
- Wait an hour or use a personal access token

### "PR not found"
- Verify the PR number exists: https://github.com/carbon-design-system/carbon/pulls
- PR might be closed or merged

## Resources

- [Carbon Design System](https://carbondesignsystem.com/)
- [Carbon GitHub](https://github.com/carbon-design-system/carbon)
- [Carbon Components](https://react.carbondesignsystem.com/)
- [Contributing Guide](https://github.com/carbon-design-system/carbon/blob/main/.github/CONTRIBUTING.md)

## Summary

You now have a powerful tool to:
- ✅ Browse Carbon PRs from your terminal
- ✅ Fetch detailed PR information
- ✅ Analyze code changes
- ✅ Integrate with review workflows
- ✅ Learn from Carbon's codebase

**Remember**: This tool is read-only and safe to use. It won't make any changes to the Carbon repository!

Happy reviewing! 🎉