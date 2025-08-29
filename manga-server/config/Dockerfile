# Multi-stage build for optimized production image
FROM oven/bun:1-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Build the application
RUN bun build src/server.ts --outfile=dist/server.js --target=bun --minify

# Production image
FROM oven/bun:1-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create application user
RUN addgroup -g 1000 manga && \
    adduser -D -u 1000 -G manga manga

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist/server.js ./
COPY --from=builder /app/package.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /manga /app/logs && \
    chown -R manga:manga /app /manga

# Switch to non-root user
USER manga

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:80/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=80 \
    HOSTNAME=0.0.0.0 \
    MANGA_ROOT=/manga

# Start server with garbage collection enabled
CMD ["bun", "run", "--expose-gc", "server.js"]