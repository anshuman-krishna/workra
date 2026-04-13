FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=apps/web --workspace=packages/shared --include-workspace-root

# build shared, then next
FROM deps AS build
COPY packages/shared packages/shared
RUN npm run build --workspace=packages/shared

COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/web

# production image
FROM base AS runner
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
COPY --from=build /app/apps/web/public apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
