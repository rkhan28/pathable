# syntax=docker/dockerfile:1.7
# Build context is the repository root so the shared contracts are available.
FROM node:24-alpine AS deps
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
COPY apps/web/scripts ./scripts
COPY contracts /repo/contracts
COPY docs/data /repo/docs/data
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_PATHABLE_API_URL=""
ARG NEXT_PUBLIC_DEV_FIXTURES="true"
ENV NEXT_PUBLIC_PATHABLE_API_URL=$NEXT_PUBLIC_PATHABLE_API_URL NEXT_PUBLIC_DEV_FIXTURES=$NEXT_PUBLIC_DEV_FIXTURES NEXT_TELEMETRY_DISABLED=1
COPY apps/web ./
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./.next/static
COPY --from=build /repo/apps/web/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
