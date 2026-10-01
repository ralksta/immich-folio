FROM node:22-alpine AS base

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

# The standalone trace copies content/ along: proxy.ts and instrumentation.ts
# read it through runtime paths, which the tracer resolves to the whole
# directory. .dockerignore already keeps a checkout's content out of this
# stage; dropping the traced copy makes sure the runner below gets content/
# from nowhere but the templates it copies by name.
RUN rm -rf .next/standalone/content

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

# content/ ships with the templates only. The site's own files come from the
# volume mounted at /app/content; with an empty volume the app shows the setup
# screen and the wizard writes into it. Copying the templates by name rather
# than the whole directory keeps a checkout's real content (credentials,
# contact messages, proofing links, backups) out of the image even if a build
# context ever includes it — .dockerignore is the first line of that.
RUN mkdir -p content/journal
COPY --from=builder /app/content/*.example ./content/
COPY --from=builder /app/content/journal/*.example ./content/journal/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

# `npm run doctor` — the config doctor for the terminal (#521). It is the tool
# for the case where the app will not start, so it has to be in the runtime
# image rather than only in a checkout. Node 22.18+ strips the types itself,
# so this is the whole of it: the entry point, every module it imports at
# runtime, and js-yaml, which the standalone bundle inlines rather than leaving
# on disk. The standalone build copies package.json verbatim, so the script
# entry is already there. scripts/__tests__/doctor-image.test.ts walks the
# import graph and fails when a module of it is missing from this list.
COPY --from=builder /app/scripts/doctor.mjs ./scripts/doctor.mjs
COPY --from=builder /app/scripts/doctor.mts ./scripts/doctor.mts
COPY --from=builder /app/lib/admin/doctor.ts ./lib/admin/doctor.ts
COPY --from=builder /app/lib/config/settingValues.ts ./lib/config/settingValues.ts
COPY --from=builder /app/lib/config/schema.ts ./lib/config/schema.ts
COPY --from=builder /app/lib/config/theme.ts ./lib/config/theme.ts
COPY --from=builder /app/lib/config/presets.ts ./lib/config/presets.ts
COPY --from=builder /app/lib/siteUrl.ts ./lib/siteUrl.ts
COPY --from=deps /app/node_modules/js-yaml ./node_modules/js-yaml

# Content dir must be writable for admin saves (ownership fixed at runtime)
RUN chown -R nextjs:nodejs /app/content

EXPOSE 7211

ENV PORT=7211
ENV HOSTNAME="0.0.0.0"

# 127.0.0.1 statt localhost: der Server bindet auf 0.0.0.0 (siehe HOSTNAME oben),
# lauscht also nur auf IPv4. In Alpine loest 'localhost' zuerst nach ::1 auf, und
# wget bleibt bei diesem ersten Ergebnis — der Check schlaegt dauerhaft mit
# "Connection refused" fehl und der Container gilt als unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7211/api/health || exit 1

# Run as root initially so entrypoint can fix bind-mount permissions,
# then drops to nextjs user via su-exec
CMD ["./docker-entrypoint.sh"]
