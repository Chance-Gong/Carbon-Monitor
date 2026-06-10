# Test PR from Carbon #22425

## Original PR
- **Title**: fix: comboBox input field now clears when value is cleared externally
- **Author**: @sanraj2000
- **URL**: https://github.com/carbon-design-system/carbon/pull/22425
- **Status**: open

## Changes
- **Files**: 2
- **Additions**: +57
- **Deletions**: -3

## Description
Closes #20319

### Changelog
Fix ComboBox input field not clearing when value is cleared externally via JavaScript

**Changed**

- Fixed ComboBox input field to properly clear when the `value` attribute is set to empty string, null, or undefined externally
- Reordered logic in `shouldUpdate()` method to check for empty value before checking `_selectedItemContent`
- Added direct DOM synchronization in `updated()` lifecycle method to ensure input field stays in sync with value changes
- Enhanced Controlled story in Storybook with better documentation and demonstration of external value clearing

#### Testing / Reviewing

## PR Checklist

<!-- 
  Do not remove checklist items.
  If some are incomplete, create a draft pull request using the create button dropdown.
  If some do not apply, ~strike through the item text with tildes~.
-->

As the author of this PR, before marking ready for review, confirm you:

- [x] Reviewed every line of the diff
- [ ] ~Updated documentation and storybook examples~
- [x] Wrote passing tests that cover this change
- [ ] ~Addressed any impact on accessibility (a11y)~
- [x] Tested for cross-browser consistency
- [x] Validated that this code is ready for review and status checks should pass

More details can be found in the [pull request guide](https://github.com/carbon-design-system/carbon/blob/main/docs/guides/reviewing-pull-requests.md)


## Files Changed
- packages/web-components/src/components/combo-box/__tests__/combo-box-test.js (+37/-0)
- packages/web-components/src/components/combo-box/combo-box.ts (+20/-3)

## Testing Instructions
1. Review the changes in this PR
2. Run the review agent: `npm start`
3. Check the comments and review summary
4. All reviews will be posted to YOUR repository, not Carbon's

## Diff
The full diff is available in: `carbon-pr-diff.patch`
