# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Install dependencies first (layer-cached unless package files change)
COPY package*.json ./
RUN npm ci --include=dev

# Copy Prisma schema and generate client before compiling TS
COPY prisma ./prisma
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy Prisma schema (needed for runtime client resolution)
COPY prisma ./prisma

# Run as non-root user for container security
RUN addgroup -S worker && adduser -S worker -G worker
USER worker

CMD ["node", "dist/index.js"]
