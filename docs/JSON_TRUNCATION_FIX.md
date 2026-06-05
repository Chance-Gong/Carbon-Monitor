# JSON Truncation Fix

## Problem

The PR review system was encountering errors when parsing Bob's review output:

```
❌ Error parsing review output: Unterminated string in JSON at position 8165 (line 108 column 280)
❌ Failed to parse review output
```

This occurred when Bob's output was truncated mid-JSON, typically due to:
- Output buffer limits
- Network interruptions
- Process termination
- Token limits

## Root Cause

The original `repairTruncatedJSON()` function had a flawed repair strategy:

1. It would detect an unterminated string and close it with `"`
2. Then it would try to find the last complete finding using `},` pattern
3. However, the logic didn't properly handle the case where truncation occurred mid-string within a finding object
4. The brace/bracket counting was done after string closure, leading to incorrect truncation points

## Solution

The fix implements a more robust repair strategy:

### Key Improvements

1. **Find Last Complete Finding First**: Before attempting any repairs, scan for the last occurrence of `},` pattern (which indicates a complete finding followed by another)

2. **Proper String State Tracking**: Track whether we're inside a string while scanning, respecting escape sequences (`\"`)

3. **Truncate to Safety**: Once we find the last complete finding, truncate the JSON there, discarding any incomplete findings

4. **Fallback to Empty Array**: If no complete findings are found, truncate to just after the `"findings": [` and provide an empty array

5. **Close Structures Properly**: After truncation, count remaining open braces and brackets, then close them in the correct order (brackets first for arrays, then braces for objects)

### Algorithm Flow

```
1. Try to parse JSON as-is (fast path for valid JSON)
2. If invalid, scan for last complete finding ("},")
3. If found, truncate to that point
4. If not found, truncate to empty findings array
5. Count remaining open structures
6. Close brackets (arrays) first
7. Close braces (objects) second
8. Attempt to parse repaired JSON
9. Return repaired JSON or original if repair fails
```

## Test Coverage

Created comprehensive tests in:
- `tests/test-parser.js` - Basic truncation scenarios
- `tests/test-truncation-edge-cases.js` - Edge cases including:
  - Truncation at position 8165 (reported error)
  - Truncation mid-property name
  - Truncation mid-array
  - Truncation with escaped quotes
  - Truncation before any complete findings

All tests pass successfully.

## Results

The fix successfully:
- ✅ Recovers all complete findings from truncated JSON
- ✅ Handles truncation at any position (mid-string, mid-property, mid-array)
- ✅ Properly handles escaped quotes in strings
- ✅ Provides graceful fallback to empty findings array
- ✅ Maintains JSON validity after repair
- ✅ Preserves the review summary when possible

## Example

**Before (Failed):**
```
Unterminated string in JSON at position 8165
Failed to parse review output
Skipping this PR
```

**After (Success):**
```
🔧 Attempting to repair truncated JSON...
✂️  Truncated to last complete finding
✅ Successfully repaired JSON
✅ Recovered 15 findings from truncated JSON
```

## Impact

This fix ensures that:
1. PRs are not skipped due to truncated output
2. All complete findings are preserved and posted
3. The review process is more resilient to output issues
4. Users get maximum value from partial reviews

## Future Considerations

If truncation continues to be an issue, consider:
1. Increasing output buffer sizes in `agentRunner.js`
2. Implementing streaming JSON parsing
3. Adding pagination for large reviews
4. Setting token limits in agent prompts to prevent truncation