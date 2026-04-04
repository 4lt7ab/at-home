# Stage 1: Base runtime
FROM oven/bun:1 AS base
WORKDIR /app

# Stage 2: Production dependencies only
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 3: Build web assets (needs dev dependencies for Vite, React, TypeScript)
FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src/ src/
RUN cd src/web && bun x vite build

# Stage 4: Final runtime image
FROM base AS runtime

# Production deps from stage 2
COPY --from=deps /app/node_modules node_modules/

# Application source and package manifest
COPY package.json ./
COPY src/ src/

# Built web assets from stage 3 (overlay on top of src/web/dist/)
COPY --from=build /app/src/web/dist src/web/dist/

# Data directory for SQLite persistence, owned by non-root bun user
RUN mkdir -p /app/data && chown -R bun:bun /app/data
USER bun

# Environment defaults
ENV HOME_HOST=0.0.0.0
ENV HOME_PORT=3100
ENV SQLITE_PATH=/app/data/sqlite.db
EXPOSE 3100

CMD ["bun", "run", "src/index.ts"]
