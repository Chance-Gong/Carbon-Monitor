FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache git bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY docs/ ./docs/

# Create temp directory for review bundles
RUN mkdir -p /tmp/pr-reviews && chmod 777 /tmp/pr-reviews

# Set environment variables
ENV NODE_ENV=production
ENV TMPDIR=/tmp/pr-reviews

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /tmp/pr-reviews

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the agent
CMD ["node", "src/index.js"]

# Made with Bob
