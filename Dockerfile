FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ─── Production Image ─────────────────────────────────────────
FROM node:20-alpine AS production

# Security: create a non-root user to run the application
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package.json first — needed so Node knows this is an ESM package ("type": "module")
COPY package*.json ./

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source (everything except what's in .dockerignore)
COPY src ./src
COPY server.js ./
COPY worker.js ./
COPY config ./config
COPY templates ./templates

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# FIXED: was 3000, must match PORT=3100 in .env and docker-compose.yml
EXPOSE 3100

CMD ["node", "server.js"]