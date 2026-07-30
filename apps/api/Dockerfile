# ============================================================
# Dockerfile for @starter/api — Turborepo Multi-Stage Build
# ============================================================
#
# ARCHITECTURE: Multi-Stage Build
# Think of this like building a house:
#   Stage 1 (base):   Lay the foundation (OS + pnpm)
#   Stage 2 (pruner): Only pack the rooms you need (turbo prune)
#   Stage 3 (builder): Assemble the house in a clean room (install + compile)
#   Stage 4 (runner): Hand the keys to the tenant (minimal final image)
#
# The result: only Stage 4 ships to Render. It has NO dev tools,
# NO test files, NO source maps, NO frontend code — just the
# compiled dist/ and the exact production node_modules needed.
# ============================================================

# ── Stage 1: base ─────────────────────────────────────────
# Use the official lightweight Node 22 image on Alpine Linux.
# Alpine is a tiny ~5MB Linux distro vs. ~100MB for Ubuntu.
# "slim" = no compilers or build tools pre-installed.
FROM node:22-alpine AS base

# Enable corepack so we can use pnpm (Node's built-in package manager switcher)
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

# ── Stage 2: pruner ───────────────────────────────────────
# This is the "turbo prune" magic.
# Instead of copying your ENTIRE monorepo (frontend + backend + all packages),
# turbo prune surgically extracts ONLY the files needed by @starter/api.
# It creates a self-contained /out folder with:
#   - The api source code
#   - Only the packages it depends on (e.g. @starter/db)
#   - A trimmed pnpm-lock.yaml with only the relevant dependencies
FROM base AS pruner

WORKDIR /app

# Install turbo globally in this stage to run the prune command
RUN pnpm add -g turbo@^2

# Copy the full monorepo into this temporary stage
COPY . .

# Run turbo prune — the "surgical extraction"
# --scope: which app to isolate
# --docker: outputs files in a Docker-optimized format (lock files separate from source)
RUN turbo prune @starter/api --docker

# ── Stage 3: builder ──────────────────────────────────────
# Now we build from the pruned, minimal workspace.
# This stage is like a clean-room assembly — no contamination from other apps.
FROM base AS builder

WORKDIR /app

# COPY 1: Just the lockfile and package manifests first.
# Docker's build cache is LAYER-BASED. If only your source code changes
# but package.json hasn't changed, Docker reuses the cached node_modules
# layer from a previous build — skipping a full pnpm install.
# This is the most critical performance optimization in any Dockerfile.
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install ONLY the production dependencies (no test frameworks, no dev tools)
RUN pnpm install --frozen-lockfile --prod=false

# COPY 2: Now copy the actual source code
COPY --from=pruner /app/out/full/ .

# Run the TypeScript compiler via turbo (this calls tsc in apps/api)
# This creates apps/api/dist/
RUN pnpm turbo run build --filter=@starter/api

# ── Stage 4: runner (The Final Shipping Container) ────────
# This is the ONLY stage that gets deployed to Render.
# We start from a FRESH Alpine image — no compilers, no turbo, no dev tools.
# We only copy in what we absolutely need to run the server.
FROM base AS runner

WORKDIR /app

# Create a non-root user for security.
# Running as root inside a container is a major security risk.
# If an attacker exploits your app, they'd only have permissions of "nodejs",
# not root access to the entire server.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy in ONLY what's needed to run:
# 1. The compiled JavaScript output (dist/)
# 2. The pruned node_modules (production packages only)
# 3. The package.json (needed by Node to know the entry point)
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Switch to the non-root user
USER nodejs

# Tell Docker which port your Hono server listens on.
# This is metadata only — the actual port binding happens in your app code.
EXPOSE 3001

# The command that runs when Render starts the container.
# We run the compiled JS directly with Node for maximum performance.
CMD ["node", "dist/index.js"]
