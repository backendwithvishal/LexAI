FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# FIXED: --only=production is deprecated, use --omit=dev
RUN npm ci --omit=dev

# ─── Production Image ─────────────────────────────────────────
FROM node:20-alpine

# Security: create a non-root user to run the application
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# FIXED: was 3000, must match PORT=3100 in .env and docker-compose.yml
EXPOSE 3100

CMD ["node", "server.js"]