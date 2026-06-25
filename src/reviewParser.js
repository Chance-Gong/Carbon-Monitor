/**
 * Parse and validate structured JSON review output from AI agents
 * STRICTLY filters Carbon-specific claims that lack proper carbon-mcp verification
 */

/**
 * Check if a finding appears to be Carbon Design System specific
 *
 * @param {Object} finding - Review finding object
 * @returns {boolean} - True if finding mentions Carbon-specific terms
 */
function looksCarbonSpecific(finding) {
  const text = `${finding.title} ${finding.body} ${finding.file}`.toLowerCase();
  
  // Carbon-specific patterns that require verification
  const carbonPatterns = [
    /@carbon\//,           // @carbon/react, @carbon/icons-react, etc.
    /\$[a-z]+-\d+/,        // Carbon tokens like $spacing-05, $layer-01
    /carbon design system/,
    /carbon component/,
    /carbon token/,
    /carbon icon/,
    /ibm-products/,
    /cds-[a-z]/,           // Carbon class prefixes
    /bx-[a-z]/,            // Legacy Carbon class prefixes
    /\bcarbon'?s?\s+\w+/,  // "Carbon DataTable", "Carbon's Button", etc. (word boundary)
    /\bdatatable\b/,           // DataTable component (word boundary)
    /\btablecontainer\b/,      // TableContainer component
    /\btablehead\b/,           // TableHead component
    /\btablerow\b/,            // TableRow component
    /\btablecell\b/,           // TableCell component
    /\bcheckbox\b/,            // Checkbox component
    /\bcombobox\b/,            // ComboBox component
    /\bfileuploader\b/,        // FileUploader component
    /\bprogressindicator\b/,   // ProgressIndicator component
    /\bradiobutton\b/,         // RadioButton component
    /\btextarea\b/,            // TextArea component
    /\btextinput\b/,           // TextInput component
    /\buishell\b/,             // UIShell component
  ];
  
  // Check if any Carbon-specific pattern matches
  return carbonPatterns.some(pattern => pattern.test(text));
}

/**
 * Filter out unverified Carbon-specific findings
 * STRICT ENFORCEMENT: Carbon claims MUST be verified via carbon-mcp
 *
 * @param {Array} findings - Array of finding objects
 * @returns {Object} - { filtered: Array, stats: Object }
 */
function filterUnverifiedCarbonFindings(findings) {
  // Skip filter if testing mode is enabled
  if (process.env.GITHUB_AI_AGENT_SKIP_CARBON_FILTER === 'true') {
    console.log('⚠️  Carbon verification filter DISABLED (test mode)');
    return { filtered: findings, stats: { total: findings.length, filtered: 0, carbonVerified: 0 } };
  }
  
  let carbonSpecificCount = 0;
  let carbonVerifiedCount = 0;
  let filteredCount = 0;
  
  const filtered = findings.filter((finding) => {
    const isDetectedCarbon = looksCarbonSpecific(finding);
    const isExplicitCarbon = finding.verificationSource === 'carbon-mcp' || finding.verificationSource === 'model-memory-fallback';

    // Non-Carbon findings explicitly marked as such pass through
    if (finding.verificationSource === 'not-carbon-specific') {
      // But double-check: if it looks Carbon-specific, auto-correct it
      if (isDetectedCarbon) {
        carbonSpecificCount++;
        console.log(`⚠️  AUTO-CORRECTING: "${finding.title}" mentions Carbon but marked not-carbon-specific`);
        console.log(`   Converting to model-memory-fallback and flagging for human review`);
        
        // Auto-correct the finding instead of filtering it out
        finding.verificationSource = 'model-memory-fallback';
        finding.requiresDownstreamReview = true;
        finding.carbonVerified = false;
        finding.body += '\n\n⚠️ **Note:** Auto-corrected from not-carbon-specific due to Carbon component mention. Requires human review.';
        
        // Count as fallback finding
        return true;
      }
      return true;
    }

    if (!isExplicitCarbon && !isDetectedCarbon) {
      return true;  // Not Carbon-specific, pass through
    }
    
    carbonSpecificCount++;
    
    // STRICT: Carbon-specific findings MUST have proper verification source
    // Accept: carbon-mcp (only valid source) or model-memory-fallback (with warning)
    const isMcpVerified = finding.carbonVerified === true && finding.verificationSource === 'carbon-mcp';
    const isFallback = finding.verificationSource === 'model-memory-fallback' && finding.requiresDownstreamReview === true;
    
    if (isMcpVerified) {
      carbonVerifiedCount++;
      return true;
    }
    
    if (isFallback) {
      console.log(`⚠️  Model memory fallback used for: ${finding.title}`);
      console.log(`   This finding requires downstream review (MCP was unavailable)`);
      return true;
    }
    
    // REJECT: Unverified Carbon claims are not allowed
    filteredCount++;
    console.log(`❌ FILTERED unverified Carbon finding: ${finding.title}`);
    console.log(`   Reason: carbonVerified=${finding.carbonVerified}, verificationSource=${finding.verificationSource}`);
    return false;
  });
  
  // Count fallback findings
  const fallbackCount = filtered.filter(f =>
    f.verificationSource === 'model-memory-fallback'
  ).length;
  
  // Log summary only when there are Carbon-specific findings
  if (carbonSpecificCount > 0) {
    console.log(`\n📊 Carbon Verification Summary:`);
    console.log(`   Total findings: ${findings.length}`);
    console.log(`   Carbon-specific: ${carbonSpecificCount}`);
    console.log(`   MCP-verified: ${carbonVerifiedCount}`);
    console.log(`   Fallback (needs review): ${fallbackCount}`);
    console.log(`   Filtered: ${filteredCount}`);
    
    if (fallbackCount > 0) {
      console.log(`\n⚠️  ${fallbackCount} finding(s) used model memory fallback (MCP unavailable)`);
      console.log(`   These findings require downstream human review`);
    }
    
    if (filteredCount > 0) {
      console.log(`\n❌ ${filteredCount} Carbon finding(s) were filtered due to missing verification`);
      console.log(`   To fix: Ensure agent uses Carbon MCP tools before making Carbon claims`);
    }
  }
  
  return {
    filtered,
    stats: {
      total: findings.length,
      carbonSpecific: carbonSpecificCount,
      carbonVerified: carbonVerifiedCount,
      filtered: filteredCount
    }
  };
}

/**
 * Attempt to repair truncated JSON by closing incomplete structures
 *
 * @param {string} jsonStr - Potentially truncated JSON string
 * @returns {string} - Repaired JSON string
 */
function repairTruncatedJSON(jsonStr) {
  try {
    // First, try to parse as-is
    JSON.parse(jsonStr);
    return jsonStr; // Already valid
  } catch (e) {
    // JSON is invalid, attempt repair
    console.log('🔧 Attempting to repair truncated JSON...');
    
    // Strategy: Find the last complete finding and truncate there
    // A complete finding ends with either "},\n" or "}\n]"
    
    // Look for the last occurrence of a complete finding pattern
    // Pattern 1: },\n  { (another finding follows)
    // Pattern 2: }\n] (last finding in array)
    // Pattern 3: }, (simple comma separator)
    
    let repaired = jsonStr;
    let truncateAt = -1;
    
    // Find last complete finding by looking for "}," pattern
    // We need to ensure we're not inside a string when we find this
    let inString = false;
    let escapeNext = false;
    let lastValidComma = -1;
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // Look for "}," pattern outside of strings
      if (!inString && char === '}' && i + 1 < repaired.length && repaired[i + 1] === ',') {
        lastValidComma = i + 1; // Position after the comma
      }
    }
    
    // If we found a complete finding, truncate there
    if (lastValidComma !== -1) {
      repaired = repaired.substring(0, lastValidComma);
      console.log('✂️  Truncated to last complete finding');
    } else {
      // No complete findings found, try to salvage what we can
      // Look for the start of the findings array
      const findingsStart = repaired.indexOf('"findings"');
      if (findingsStart !== -1) {
        const arrayStart = repaired.indexOf('[', findingsStart);
        if (arrayStart !== -1) {
          // Truncate to just before the findings array and provide empty array
          repaired = repaired.substring(0, arrayStart + 1);
          console.log('✂️  No complete findings, using empty array');
        }
      }
    }
    
    // Now count what we need to close
    let braceCount = 0;
    let bracketCount = 0;
    inString = false;
    escapeNext = false;
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
      }
    }
    
    // Close any open brackets first (for arrays)
    while (bracketCount > 0) {
      repaired += ']';
      bracketCount--;
    }
    
    // Close any open braces (for objects)
    while (braceCount > 0) {
      repaired += '}';
      braceCount--;
    }
    
    // Try to parse the repaired JSON
    try {
      JSON.parse(repaired);
      console.log('✅ Successfully repaired JSON');
      return repaired;
    } catch (e2) {
      console.warn('⚠️  Could not repair JSON:', e2.message);
      return jsonStr;
    }
  }
}

/**
 * Parse structured JSON review output from agent
 *
 * @param {string} agentOutput - Raw output from AI agent
 * @returns {Object|null} - Parsed review object or null if invalid
 */
function parseReviewOutput(agentOutput) {
  try {
    // Find JSON markers
    const jsonStart = agentOutput.indexOf('BEGIN_REVIEW_JSON');
    
    if (jsonStart === -1) {
      console.error('❌ No BEGIN_REVIEW_JSON marker found in agent output');
      console.error('Agent output preview:', agentOutput.substring(0, 500));
      return null;
    }
    
    // Extract JSON - try to find END marker, but if not found, take everything
    const afterMarker = jsonStart + 'BEGIN_REVIEW_JSON'.length;
    const jsonEnd = agentOutput.indexOf('END_REVIEW_JSON', afterMarker);
    
    let jsonStr;
    if (jsonEnd !== -1) {
      // Found END marker - extract between markers
      jsonStr = agentOutput.substring(afterMarker, jsonEnd).trim();
    } else {
      // No END marker - take everything after BEGIN marker and try to parse
      jsonStr = agentOutput.substring(afterMarker).trim();
      console.warn('⚠️  No END_REVIEW_JSON marker, attempting to parse incomplete JSON');
      
      // Try to repair truncated JSON
      jsonStr = repairTruncatedJSON(jsonStr);
    }
    
    // Additional cleanup: remove any leading/trailing non-JSON content
    // Look for the first '{' and last '}'
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('❌ No valid JSON object found in extracted content');
      console.error('Extracted content preview:', jsonStr.substring(0, 200));
      return null;
    }
    
    // Extract only the JSON object
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    
    // Parse JSON
    const review = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!review.summaryMarkdown || typeof review.summaryMarkdown !== 'string') {
      console.error('❌ Invalid review: missing or invalid summaryMarkdown');
      return null;
    }
    
    if (!Array.isArray(review.findings)) {
      console.error('❌ Invalid review: findings must be an array');
      return null;
    }
    
    // Validate each finding
    for (const finding of review.findings) {
      if (!finding.severity || !['blocking', 'major', 'minor', 'nit'].includes(finding.severity)) {
        console.error('❌ Invalid finding: invalid severity', finding);
        return null;
      }
      
      if (!finding.file || typeof finding.file !== 'string') {
        console.error('❌ Invalid finding: missing or invalid file', finding);
        return null;
      }
      
      if (!finding.title || typeof finding.title !== 'string') {
        console.error('❌ Invalid finding: missing or invalid title', finding);
        return null;
      }
      
      if (!finding.body || typeof finding.body !== 'string') {
        console.error('❌ Invalid finding: missing or invalid body', finding);
        return null;
      }
    }
    
    // Filter unverified Carbon findings with strict enforcement
    const filterResult = filterUnverifiedCarbonFindings(review.findings);
    review.findings = filterResult.filtered;
    
    // Store verification stats for reporting
    review.verificationStats = filterResult.stats;
    
    return review;
    
  } catch (error) {
    console.error('❌ Error parsing review output:', error.message);
    
    // Show more context for debugging
    if (error instanceof SyntaxError) {
      console.error('\n📋 Debugging Information:');
      console.error('Error type: JSON Syntax Error');
      
      // Try to show the problematic area
      const match = error.message.match(/position (\d+)/);
      if (match) {
        const position = parseInt(match[1]);
        const start = Math.max(0, position - 50);
        const end = Math.min(agentOutput.length, position + 50);
        console.error(`Context around error position ${position}:`);
        console.error(agentOutput.substring(start, end));
      }
      
      // Show first 500 chars of agent output
      console.error('\nAgent output preview (first 500 chars):');
      console.error(agentOutput.substring(0, 500));
      
      // Check for markers
      const hasBegin = agentOutput.includes('BEGIN_REVIEW_JSON');
      const hasEnd = agentOutput.includes('END_REVIEW_JSON');
      console.error(`\nMarkers found: BEGIN=${hasBegin}, END=${hasEnd}`);
    }
    
    return null;
  }
}

/**
 * Count findings by severity
 * 
 * @param {Array} findings - Array of finding objects
 * @returns {Object} - Count by severity level
 */
function countBySeverity(findings) {
  const counts = {
    blocking: 0,
    major: 0,
    minor: 0,
    nit: 0
  };
  
  findings.forEach(finding => {
    const severity = finding.severity || 'minor';
    if (counts[severity] !== undefined) {
      counts[severity]++;
    }
  });
  
  return counts;
}

module.exports = {
  parseReviewOutput,
  filterUnverifiedCarbonFindings,
  looksCarbonSpecific,
  countBySeverity
};

// Made with Bob
