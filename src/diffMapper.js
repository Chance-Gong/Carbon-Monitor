/**
 * Diff Mapper Module
 * Maps finding locations to GitHub diff positions for inline comments
 */

/**
 * Parse unified diff to extract line mappings
 * @param {string} diff - Unified diff text
 * @returns {Map} Map of file paths to line position mappings
 */
function parseDiffLinePositions(diff) {
  const fileMap = new Map();
  
  const lines = diff.split('\n');
  let currentFile = null;
  let position = 0;
  let oldLine = 0;
  let newLine = 0;
  
  for (const line of lines) {
    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      // Extract the b/ path (the new file path)
      const match = line.match(/\sb\/(.+)$/);
      if (match) {
        currentFile = match[1];
        fileMap.set(currentFile, new Map());
        position = 0;
      }
      continue;
    }
    
    // Hunk header: @@ -old_start,old_count +new_start,new_count @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      position++;
      continue;
    }
    
    // Skip file metadata lines
    if (line.startsWith('---') || line.startsWith('+++') || 
        line.startsWith('index ') || line.startsWith('new file') ||
        line.startsWith('deleted file')) {
      position++;
      continue;
    }
    
    if (!currentFile) continue;
    
    // Increment position first (GitHub uses 1-based positions)
    position++;
    
    // Context line (unchanged)
    if (line.startsWith(' ')) {
      fileMap.get(currentFile).set(newLine, position);
      oldLine++;
      newLine++;
    }
    // Addition line
    else if (line.startsWith('+')) {
      fileMap.get(currentFile).set(newLine, position);
      newLine++;
    }
    // Deletion line
    else if (line.startsWith('-')) {
      oldLine++;
    }
  }
  
  return fileMap;
}

/**
 * Map a finding to a diff position for inline commenting
 * @param {Object} finding - Finding object with file and line
 * @param {string} diff - Unified diff text
 * @param {Array} files - Array of changed file objects from GitHub
 * @returns {Object|null} - { path, position, side } or null if not mappable
 */
function mapFindingToDiffPosition(finding, diff, files) {
  // Validate finding has required fields
  if (!finding.file || !finding.line) {
    return null;
  }
  
  // Check if file is in the changed files list
  // Handle both full paths and relative paths
  let changedFile = files.find(f => f.filename === finding.file);
  let matchedFilename = finding.file;
  
  if (!changedFile) {
    // Try matching by basename if full path doesn't match
    const findingBasename = finding.file.split('/').pop();
    changedFile = files.find(f => f.filename.endsWith(finding.file) || f.filename.split('/').pop() === findingBasename);
    if (changedFile) {
      matchedFilename = changedFile.filename;
    } else {
      return null;
    }
  }
  
  // Parse diff to get line-to-position mappings
  const fileMap = parseDiffLinePositions(diff);
  const lineMap = fileMap.get(matchedFilename);
  
  if (!lineMap) {
    // File not found in diff (shouldn't happen if file is in changed files)
    return null;
  }
  
  // Look up the diff position for this line number
  const diffPosition = lineMap.get(finding.line);
  
  if (!diffPosition) {
    // Line not found in diff - it's an unchanged line or outside the diff context
    return null;
  }
  
  // Return the actual diff position
  return {
    path: matchedFilename,
    position: diffPosition  // Use actual diff position
  };
}

/**
 * Split findings into those that can be posted inline vs summary only
 * @param {Array} findings - Array of finding objects
 * @param {string} diff - Unified diff text
 * @param {Array} files - Array of changed file objects
 * @returns {Object} - { inlineFindings, summaryFindings }
 */
function splitFindings(findings, diff, files) {
  const inlineFindings = [];
  const summaryFindings = [];
  
  for (const finding of findings) {
    const position = mapFindingToDiffPosition(finding, diff, files);
    
    if (position) {
      inlineFindings.push({
        ...finding,
        diffPosition: position
      });
    } else {
      summaryFindings.push(finding);
    }
  }
  
  return { inlineFindings, summaryFindings };
}

module.exports = {
  parseDiffLinePositions,
  mapFindingToDiffPosition,
  splitFindings
};

// Made with Bob