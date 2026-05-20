# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Required so prisma generate in the builder targets the correct openssl version
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests first so layer caching works — only re-runs npm install when
# package.json or package-lock.json changes, not on every source change.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy Prisma schema before generating the client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:22-alpine AS production

# Required by Prisma engine binaries on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy the generated Prisma client and compiled output from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Non-root user for least-privilege execution
RUN addgroup -S flowboard && adduser -S flowboard -G flowboard \
    && chown -R flowboard:flowboard /app
USER flowboard

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
