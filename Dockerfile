FROM node:20-alpine AS base

# ── Dependencies ──────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set fetch-retry-maxtimeout 120000 && npm config set fetch-retry-mintimeout 20000
RUN npm ci --omit=dev

# ── Build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set fetch-retry-maxtimeout 120000 && npm config set fetch-retry-mintimeout 20000
RUN npm ci --verbose
COPY . .

# Dummy env vars for build — pages are force-dynamic so these are
# never used at runtime, but Next.js page-data collection imports
# env.ts which runs Zod validation on import.
ENV IMMICH_API_URL="http://localhost:2283"
ENV IMMICH_API_KEY="build-placeholder"
ENV AUTH_SECRET="build-placeholder"

RUN npm run build

# ── Runtime ───────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# su-exec for dropping privileges in entrypoint
RUN apk add --no-cache su-exec

COPY --from=builder /app/public ./public
COPY --from=builder /app/content ./content
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

# Content dir must be writable for admin saves (ownership fixed at runtime)
RUN chown -R nextjs:nodejs /app/content

EXPOSE 7211

ENV PORT=7211
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7211/api/health || exit 1

# Run as root initially so entrypoint can fix bind-mount permissions,
# then drops to nextjs user via su-exec
CMD ["./docker-entrypoint.sh"]
