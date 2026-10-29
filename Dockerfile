FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/embeds.db
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY scripts/serve.mjs ./scripts/serve.mjs
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
