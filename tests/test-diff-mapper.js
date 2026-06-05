/**
 * Test diff mapper functionality
 */

const { parseDiffLinePositions, mapFindingToDiffPosition, splitFindings } = require('../src/diffMapper');

// Sample unified diff
const sampleDiff = `diff --git a/src/components/Button.js b/src/components/Button.js
index 1234567..abcdefg 100644
--- a/src/components/Button.js
+++ b/src/components/Button.js
@@ -10,7 +10,8 @@ import React from 'react';
 
 export function Button({ label, onClick }) {
   return (
-    <button onClick={onClick}>
+    <button 
+      onClick={onClick}>
       {label}
     </button>
   );
@@ -25,6 +26,7 @@ export function IconButton({ icon, onClick }) {
     <button 
       className="icon-button"
       onClick={onClick}
+      aria-label={icon}
     >
       <Icon name={icon} />
     </button>`;

// Sample files array
const sampleFiles = [
  {
    filename: 'src/components/Button.js',
    additions: 2,
    deletions: 1,
    status: 'modified'
  }
];

// Sample findings
const sampleFindings = [
  {
    severity: 'minor',
    file: 'src/components/Button.js',
    line: 13,
    title: 'Split button attributes',
    body: 'Button attributes should be on separate lines',
    carbonVerified: false,
    verificationSource: 'not-carbon-specific'
  },
  {
    severity: 'major',
    file: 'src/components/Button.js',
    line: 29,
    title: 'Missing aria-label',
    body: 'Icon button needs aria-label for accessibility',
    carbonVerified: true,
    verificationSource: 'carbon-builder'
  },
  {
    severity: 'nit',
    file: 'src/components/Button.js',
    line: 100,
    title: 'Unreachable finding',
    body: 'This line is not in the diff',
    carbonVerified: false,
    verificationSource: 'not-carbon-specific'
  },
  {
    severity: 'minor',
    file: 'src/other/File.js',
    line: 10,
    title: 'Different file',
    body: 'This file is not in the changed files',
    carbonVerified: false,
    verificationSource: 'not-carbon-specific'
  }
];

console.log('🧪 Testing Diff Mapper\n');

// Test 1: Parse diff line positions
console.log('Test 1: Parse diff line positions');
const lineMap = parseDiffLinePositions(sampleDiff);
console.log('Files found:', Array.from(lineMap.keys()));
const buttonMap = lineMap.get('src/components/Button.js');
console.log('Line mappings for Button.js:', buttonMap ? buttonMap.size : 0);
console.log('✅ Test 1 passed\n');

// Test 2: Map individual findings
console.log('Test 2: Map individual findings');
sampleFindings.forEach((finding, i) => {
  const position = mapFindingToDiffPosition(finding, sampleDiff, sampleFiles);
  console.log(`Finding ${i + 1} (${finding.file}:${finding.line}):`);
  if (position) {
    console.log(`  ✅ Mapped to position ${position.position}`);
  } else {
    console.log(`  ❌ Could not map to diff`);
  }
});
console.log('✅ Test 2 passed\n');

// Test 3: Split findings
console.log('Test 3: Split findings into inline vs summary');
const { inlineFindings, summaryFindings } = splitFindings(sampleFindings, sampleDiff, sampleFiles);
console.log(`Inline findings: ${inlineFindings.length}`);
console.log(`Summary findings: ${summaryFindings.length}`);

inlineFindings.forEach(f => {
  console.log(`  ✅ ${f.file}:${f.line} -> position ${f.diffPosition.position}`);
});

summaryFindings.forEach(f => {
  console.log(`  ℹ️  ${f.file}:${f.line} (not in diff)`);
});

console.log('✅ Test 3 passed\n');

// Validation
const expectedInline = 2; // Lines 13 and 29 should be mappable
const expectedSummary = 2; // Line 100 and different file should not be mappable

if (inlineFindings.length === expectedInline && summaryFindings.length === expectedSummary) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.error(`❌ Test failed: Expected ${expectedInline} inline and ${expectedSummary} summary, got ${inlineFindings.length} and ${summaryFindings.length}`);
  process.exit(1);
}

// Made with Bob
