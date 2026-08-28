# syntax=docker/dockerfile:1

# Multi-stage build for the World-Wide-Lab server.
#
# The image builds the server from source, so it can be built from a clean
# checkout of the repository without any local setup:
#   docker build -t world-wide-lab/server packages/server/
#
# Only the server's production dependencies and its compiled output end up in
# the final image, all build tooling stays behind in the intermediate stages.

# Node version used for building and running the server, kept in sync with .nvmrc
ARG NODE_IMAGE=node:18.20.4-bookworm-slim

# ---------------------------------------------------------------------------
# Base: shared settings for all stages
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base

WORKDIR /usr/src/app

# Silence npm noise that is irrelevant (and slow) inside a container build
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# The server is installed on its own, without the other workspaces of the
# monorepo. This keeps the image free of dependencies that are only relevant to
# the other packages.
COPY package.json ./

# The optional @world-wide-lab/deploy dependency lives in another workspace and
# is only needed for the automated cloud deployments from the admin UI. It is
# dropped here, since it pulls in a very large dependency tree and is not
# available outside of the monorepo anyway.
RUN npm pkg delete "optionalDependencies.@world-wide-lab/deploy"

# ---------------------------------------------------------------------------
# Toolchain: compilers for native modules (e.g. sqlite3) in case no pre-built
# binary is available for the target platform. Only used to install
# dependencies, never shipped in the final image.
# ---------------------------------------------------------------------------
FROM base AS toolchain

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Dependencies: production-only modules for the final image
# ---------------------------------------------------------------------------
FROM toolchain AS prod-deps

# Note: Optional dependencies are kept, some packages (e.g. rollup, which
# AdminJS uses to bundle its frontend) ship their platform specific binaries as
# optional dependencies and fail to start without them.
# TODO: Use a lockfile here (will require a switch away from npm as package manager)
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --omit=dev

# ---------------------------------------------------------------------------
# Build: compile TypeScript into dist/
# ---------------------------------------------------------------------------
FROM toolchain AS build

# Browsers for the end-to-end tests are not needed to compile the server
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install

COPY tsconfig.json tsconfig-build.json ./
COPY src ./src

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime: the actual image that is shipped
# ---------------------------------------------------------------------------
FROM base AS runtime

# Set meta information
LABEL org.opencontainers.image.title="World-Wide-Lab Server"
LABEL org.opencontainers.image.source="https://github.com/world-wide-lab/world-wide-lab"
LABEL org.opencontainers.image.description="Container image of the World-Wide-Lab server"
LABEL org.opencontainers.image.licenses="MIT"

# dumb-init runs as PID 1 so that the server shuts down cleanly on e.g.
# "docker stop" and does not accumulate zombie processes
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY static ./static
COPY certs ./certs

# Expose the app's port
ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
