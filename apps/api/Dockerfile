FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# install dependencies for the full monorepo so workspace resolution works
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# build shared package
FROM deps AS build
COPY packages/shared packages/shared
RUN npm run build --workspace=packages/shared

# production image
FROM base AS runner
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/packages/shared packages/shared
COPY apps/api apps/api
COPY package.json ./

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/server.ts"]
