# =============================================================================
# Field Office PWA — production image
#
# Multi-stage so the shipped layer contains the built app and nothing else: no
# source, no dev dependencies, no build toolchain. Runs as a non-root user
# because a container that does not need root should not have it.
# =============================================================================

# --- dependencies ------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until the dependency set changes.
COPY package.json package-lock.json ./
RUN npm ci


# --- build -------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry is off in the build as well as the runtime: a government service
# should not phone home from either.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# --- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# public/ carries the DMV logo, the manifest, and the REG 343 fill template
# that the counter fetches to produce a completed PDF. Without it the download
# fails at the moment the product is meant to pay off.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# `output: "standalone"` produces server.js plus only the packages it imports.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# App Runner and ECS both poll this; it reports liveness and nothing else.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# HOSTNAME is set in the command rather than with ENV, and this is not a style
# choice. Container runtimes — App Runner and ECS among them — set HOSTNAME to
# the container's own hostname, which overrides anything ENV declared. Next's
# standalone server reads HOSTNAME to decide what to bind to, so it ends up
# listening on a single internal interface. The app starts, reports "Ready", and
# then every health check fails because nothing outside the container can reach
# it. Setting it here wins, because it is applied at exec time.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
