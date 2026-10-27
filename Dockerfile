# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined at build time; pass them as build args.
ARG NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_PATHABLE_API_URL NEXT_PUBLIC_DEV_FIXTURES NEXT_PUBLIC_MAP_STYLE_LIGHT NEXT_PUBLIC_MAP_STYLE_DARK NEXT_PUBLIC_GEOCODER_URL NEXT_PUBLIC_SUPPORT_URL
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app ./
USER app
EXPOSE 3000
CMD ["npm", "start"]
