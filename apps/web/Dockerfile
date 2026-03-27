FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --no-frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG API_BASE_URL=http://api:8000
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV API_BASE_URL=${API_BASE_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/ ./
COPY apps/web/ ./apps/web/
RUN pnpm --filter @hireflow/schemas build && pnpm --filter @hireflow/config build && pnpm --filter @hireflow/web build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@hireflow/web", "start"]
