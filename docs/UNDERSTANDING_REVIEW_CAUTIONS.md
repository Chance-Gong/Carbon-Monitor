# Understanding PR Review Agent Cautions

This document explains the warning messages you see during PR reviews and what they mean.

## Overview

When running the PR Review Agent, you may see several caution messages (⚠️) in the output. **These are normal and expected** - they indicate the agent is working correctly with built-in safety mechanisms.

## Common Caution Messages

### 1. JSON Truncation Handling

```
⚠️  No END_REVIEW_JSON marker, attempting to parse incomplete JSON
🔧 Attempting to repair truncated JSON...
✂️  Truncated to last complete finding
✅ Successfully repaired JSON
```

**What it means:**
- Bob's output was cut off mid-JSON (common with large reviews)
- The parser detected the truncation and automatically repaired it
- It found the last complete finding and discarded incomplete data
- The review continues with all valid findings

**Why it happens:**
- AI agents have output length limits
- Large PRs with many findings can exceed these limits
- The agent prioritizes quality over quantity

**Is this a problem?** ❌ No
- This is expected behavior for large reviews
- The JSON repair system recovers all complete findings
- You still get valuable review feedback

**What to do:**
- Nothing! The system handles this automatically
- If you need more findings, consider reviewing smaller PRs
- Or break large PRs into smaller chunks

---

### 2. Carbon Verification Fallback

```
⚠️  Allowing Carbon finding with detailed reference (fallback): Icon-only button missing required iconDescription/aria-label
⚠️  Allowing Carbon finding with detailed reference (fallback): DataTable missing required 'headers' prop
⚠️  Allowing Carbon finding with detailed reference (fallback): Not using DataTable render props correctly
```

**What it means:**
- The agent found Carbon-specific issues (Button, DataTable, TextInput, etc.)
- These findings couldn't be verified through Carbon Builder/MCP (not yet available)
- BUT the findings include detailed references and explanations
- The system allows them through using a "detailed reference fallback"

**Why it happens:**
- Carbon Builder MCP server (`@carbon/mcp-server`) doesn't exist yet
- The agent can't verify Carbon claims against official documentation
- As a fallback, findings with detailed explanations are trusted

**Is this a problem?** ⚠️ Partially
- **Good:** You still get Carbon-specific feedback
- **Risk:** Findings aren't verified against official Carbon docs
- **Mitigation:** Findings must have detailed explanations to pass

**What to do:**
- Review Carbon findings manually against [Carbon documentation](https://carbondesignsystem.com/)
- Treat these as suggestions, not absolute requirements
- When Carbon MCP is available, these will be properly verified

---

### 3. Carbon Filter Status

```
⚠️  Carbon verification filter DISABLED (test mode)
```

**What it means:**
- You're running in test mode with `GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true`
- ALL Carbon findings are allowed through, even unverified ones
- This is useful for testing but not recommended for production

**Why it happens:**
- You explicitly enabled test mode in your `.env` file
- Used for development and testing purposes

**Is this a problem?** ⚠️ Only in production
- **Testing:** This is fine and expected
- **Production:** Should be disabled for real reviews

**What to do:**
- For testing: Keep it enabled
- For production: Remove or set to `false` in `.env`

---

## Understanding the Review Flow

Here's what happens during a review:

```
1. 🔍 Fetch PR diff and files
2. 📦 Build review bundle with context
3. 🤖 Run Bob agent with Carbon rules
4. ✅ Bob review received (raw output)
5. 🔍 Parse review output
   ├─ Look for BEGIN_REVIEW_JSON marker
   ├─ Extract JSON content
   ├─ Check for END_REVIEW_JSON marker
   │  ├─ ✅ Found: Parse complete JSON
   │  └─ ⚠️  Missing: Repair truncated JSON
   └─ ✅ Successfully repaired JSON
6. 🔍 Filter findings
   ├─ Check each finding for Carbon-specific terms
   ├─ Verify Carbon claims (if MCP available)
   ├─ ⚠️  Fallback: Allow detailed references
   └─ ✅ Parsed: X findings
7. 💬 Post review comment to GitHub
8. 🏷️  Add AIReviewed label
```

---

## Caution Categories

### 🟢 Safe Cautions (Expected Behavior)

These indicate the system is working correctly:

- ✂️ JSON truncation and repair
- ⚠️ Allowing Carbon findings with detailed references
- 🔧 Attempting to repair truncated JSON

**Action:** None needed - system is self-healing

### 🟡 Informational Cautions

These provide context about what's happening:

- ⚠️ No END_REVIEW_JSON marker
- ⚠️ Carbon verification filter status

**Action:** Be aware, but no immediate action needed

### 🔴 Error Cautions (Require Attention)

These indicate actual problems:

- ❌ No BEGIN_REVIEW_JSON marker found
- ❌ Invalid review: missing summaryMarkdown
- ❌ Invalid finding: invalid severity

**Action:** Check agent configuration and output format

---

## Detailed Explanation: Carbon Verification Fallback

### The Problem

Carbon Design System has specific requirements for components:
- Button with `hasIconOnly` needs `iconDescription`
- DataTable requires `headers` prop
- TextInput needs `labelText` for accessibility
- Form inputs should use Carbon components, not native HTML

**Ideally**, the agent would verify these against official Carbon documentation using Carbon Builder MCP.

**Reality**: Carbon Builder MCP doesn't exist yet as a published package.

### The Solution

The agent uses a **detailed reference fallback**:

```javascript
// From reviewParser.js lines 42-48
const hasDetailedReference = finding.body && (
  finding.body.includes('Carbon documentation') ||
  finding.body.includes('Carbon Design System') ||
  finding.body.includes('@carbon/') ||
  /carbondesignsystem\.com/.test(finding.body) ||
  finding.body.length > 100 // Detailed findings are likely researched
);
```

**Criteria for fallback approval:**
1. Finding mentions "Carbon documentation"
2. Finding mentions "Carbon Design System"
3. Finding references `@carbon/` packages
4. Finding links to carbondesignsystem.com
5. Finding has detailed explanation (>100 characters)

### Example: Good vs Bad Findings

**✅ ALLOWED (Detailed Reference):**
```json
{
  "title": "Icon-only button missing required iconDescription/aria-label",
  "body": "The Button component with hasIconOnly={true} requires an iconDescription prop for accessibility. This provides screen reader users with context about the button's purpose. See Carbon documentation: https://carbondesignsystem.com/components/button/usage#icon-only-buttons",
  "severity": "major"
}
```

**❌ BLOCKED (Vague Claim):**
```json
{
  "title": "Wrong button style",
  "body": "Use Carbon button",
  "severity": "minor"
}
```

---

## When to Be Concerned

### 🚨 Red Flags

You should investigate if you see:

1. **No findings at all** despite obvious issues
   - Agent may not be running correctly
   - Check agent logs for errors

2. **All findings blocked**
   ```
   ✅ Parsed: 0 findings
   ```
   - Carbon filter may be too strict
   - Try test mode: `GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true`

3. **Parse errors**
   ```
   ❌ Error parsing review output: Unexpected token
   ```
   - Agent output format may be incorrect
   - Check agent configuration

4. **Repeated truncation on small PRs**
   - Should only happen on large PRs (>10 files, >500 lines)
   - May indicate agent configuration issue

### ✅ Normal Behavior

These are expected and fine:

- 1-3 truncation warnings per large PR
- 5-15 Carbon fallback warnings per PR
- "Successfully repaired JSON" messages
- "Allowing Carbon finding with detailed reference"

---

## Configuration Options

### Disable Carbon Filter (Testing Only)

```bash
# In .env
GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true
```

**Use when:**
- Testing the agent
- Debugging Carbon findings
- Comparing verified vs unverified results

**Don't use when:**
- Running production reviews
- Posting to real PRs
- Need high-confidence findings

### Adjust PR Limits

```bash
# In .env
GITHUB_AI_AGENT_MAX_PRS=3        # Review fewer PRs
GITHUB_AI_AGENT_DAYS_BACK=7      # Only recent PRs
```

**Use when:**
- Testing with limited resources
- Focusing on recent changes
- Avoiding rate limits

---

## Troubleshooting

### Problem: Too Many Cautions

**Symptoms:**
- 20+ caution messages per PR
- Most findings are blocked
- Review seems incomplete

**Solutions:**
1. Enable test mode temporarily:
   ```bash
   GITHUB_AI_AGENT_SKIP_CARBON_FILTER=true npm start
   ```

2. Check if Carbon MCP is configured:
   ```bash
   bob mcp list
   # Should show: ✓ carbon-mcp: npx -y carbon-mcp (stdio) - Connected
   ```

3. Review smaller PRs first to test

### Problem: No Cautions at All

**Symptoms:**
- Clean output with no warnings
- But also no findings

**Solutions:**
1. Check agent is running:
   ```bash
   which bob
   echo $BOBSHELL_API_KEY
   ```

2. Verify PR has actual issues to find

3. Check agent logs for errors

### Problem: JSON Parse Failures

**Symptoms:**
```
❌ Error parsing review output: Unterminated string
⚠️  Could not repair JSON
```

**Solutions:**
1. Update to latest version (includes JSON repair)
2. Check agent output format
3. Try with smaller PR
4. Report issue with agent output sample

---

## Summary

**Key Takeaways:**

1. ⚠️ **Cautions are normal** - They show the system is working
2. 🔧 **JSON repair is automatic** - Handles truncated output gracefully
3. 🎯 **Carbon fallback is temporary** - Until Carbon MCP is available
4. ✅ **Findings are still valuable** - Even with fallback verification
5. 🧪 **Test mode available** - For debugging and development

**When to worry:**
- ❌ Parse errors that can't be repaired
- ❌ No findings on PRs with obvious issues
- ❌ Agent crashes or timeouts

**When NOT to worry:**
- ⚠️ JSON truncation and repair messages
- ⚠️ Carbon fallback allowances
- ⚠️ Detailed reference approvals

---

## Related Documentation

- [Testing with Forked Carbon](./TESTING_WITH_FORKED_CARBON.md)
- [JSON Truncation Fix](./JSON_TRUNCATION_FIX.md)
- [Carbon Verification Status](./CARBON_VERIFICATION_STATUS.md)
- [Main README](../README.md)

---

**Questions?** Check the [troubleshooting section](#troubleshooting) or open an issue.