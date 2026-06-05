# Demo Component for PR Review Testing

This directory contains example files with intentional code issues to demonstrate the PR review bot's inline comment capabilities.

## demo-component.js

Contains 10 intentional issues across different categories:

1. **Magic Number** (Line 10) - Hardcoded discount percentage
2. **Missing Error Handling** (Line 15) - Async function without try-catch
3. **Inconsistent Naming** (Line 20) - Mixed camelCase and snake_case
4. **Missing Accessibility** (Line 30) - Icon button without aria-label
5. **Inefficient Algorithm** (Line 39) - O(n²) nested loops
6. **Hardcoded Credentials** (Line 52) - Security vulnerability
7. **Missing Input Validation** (Line 56) - Division without zero check
8. **Poor Variable Naming** (Line 61) - Single letter variables
9. **Missing Documentation** (Line 68) - Complex function without JSDoc
10. **Memory Leak** (Line 77) - Event listener not cleaned up

## Purpose

When this file is committed and a PR is created, the review bot should:
- Post inline comments on specific problematic lines
- Provide actionable feedback for each issue
- Include severity levels (blocking, major, minor, nit)
- Show Carbon verification status where applicable

## Testing the Bot

1. Commit this file to a branch
2. Create a PR against main
3. Wait for the bot to review
4. Verify inline comments appear on the correct lines
5. Check that the summary comment includes any unmappable findings
