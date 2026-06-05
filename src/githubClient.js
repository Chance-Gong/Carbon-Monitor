/**
 * GitHub Client Module
 * Wraps all GitHub API operations for PR review automation
 */

/**
 * Create a GitHub client for PR review operations
 * @param {Object} octokit - Initialized Octokit instance
 * @returns {Object} GitHub client with review operations
 */
function createGitHubClient(octokit) {
  return {
    /**
     * Fetch open PRs that don't have the review label
     * @param {Object} options - { owner, repo, daysBack, label }
     * @returns {Promise<Array>} Array of PR objects
     */
    async fetchReviewablePRs({ owner, repo, daysBack, label }) {
      try {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);

        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          sort: 'created',
          direction: 'desc',
          per_page: 100
        });

        // Filter out draft PRs and PRs that already have the review label
        return prs.filter(pr => {
          if (pr.draft) return false;
          if (new Date(pr.created_at) < since) return false;
          if (pr.labels.some(l => l.name === label)) return false;
          return true;
        });
      } catch (error) {
        console.error('Error fetching reviewable PRs:', error.message);
        throw error;
      }
    },

    /**
     * Fetch unified diff for a PR
     * @param {Object} options - { owner, repo, pullNumber }
     * @returns {Promise<string>} Unified diff text
     */
    async fetchPRDiff({ owner, repo, pullNumber }) {
      try {
        const { data: diff } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: pullNumber,
          mediaType: {
            format: 'diff'
          }
        });
        return diff;
      } catch (error) {
        console.error('Error fetching PR diff:', error.message);
        throw error;
      }
    },

    /**
     * Fetch list of changed files in PR
     * @param {Object} options - { owner, repo, pullNumber }
     * @returns {Promise<Array>} Array of file objects with additions/deletions
     */
    async fetchPRFiles({ owner, repo, pullNumber }) {
      try {
        const { data: files } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100
        });
        return files;
      } catch (error) {
        console.error('Error fetching PR files:', error.message);
        throw error;
      }
    },

    /**
     * Post inline review comments on specific lines
     * @param {Object} options - { owner, repo, pullNumber, commitId, comments }
     * @returns {Promise<Object>} Review object
     */
    async postReviewComments({ owner, repo, pullNumber, commitId, comments }) {
      try {
        if (!comments || comments.length === 0) {
          return null;
        }

        // Filter out comments that don't have required fields
        const validComments = comments.filter(c => c.path && c.position && c.body);

        if (validComments.length === 0) {
          return null;
        }

        // Post as a review with inline comments
        // Use start_line + line for multi-line support (works for single lines too)
        const { data: review } = await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: pullNumber,
          commit_id: commitId,
          event: 'COMMENT',
          comments: validComments.map(c => ({
            path: c.path,
            body: c.body,
            start_line: c.position,  // Start of comment range
            line: c.position,        // End of comment range (same for single line)
            start_side: 'RIGHT',     // Side for start_line
            side: 'RIGHT'            // Side for line
          }))
        });

        return review;
      } catch (error) {
        console.error('❌ Error posting review:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('Error posting review comments:', error.message);
        // Don't throw - inline comments are optional
        // Return null so caller knows it failed
        return null;
      }
    },

    /**
     * Post a summary comment on a PR
     * @param {Object} options - { owner, repo, pullNumber, body }
     * @returns {Promise<Object>} Comment object
     */
    async postSummaryComment({ owner, repo, pullNumber, body }) {
      try {
        const { data: comment } = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pullNumber,
          body
        });
        return comment;
      } catch (error) {
        console.error('Error posting summary comment:', error.message);
        throw error;
      }
    },

    /**
     * Add the review label to a PR
     * @param {Object} options - { owner, repo, pullNumber, label }
     * @returns {Promise<Array>} Updated labels
     */
    async addReviewedLabel({ owner, repo, pullNumber, label }) {
      try {
        const { data: labels } = await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: pullNumber,
          labels: [label]
        });
        return labels;
      } catch (error) {
        console.error('Error adding reviewed label:', error.message);
        throw error;
      }
    }
  };
}

module.exports = { createGitHubClient };

// Made with Bob
