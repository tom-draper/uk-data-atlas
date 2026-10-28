FROM node:24-bookworm-slim AS build
RUN npm install --global pnpm@12.5.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY services/api/package.json services/api/package.json
RUN pnpm install --filter @uk-data-atlas/api... --frozen-lockfile
COPY services/api/src/ services/api/src/
COPY services/api/scripts/ services/api/scripts/
RUN pnpm --dir services/api build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 ATLAS_WORKERS=2
WORKDIR /app/services/api
COPY --from=build --chown=node:node /app/services/api/dist/ dist/
COPY --chown=node:node services/api/openapi.yaml ./
RUN mkdir -p /app/data/build /var/lib/atlas-usage && chown node:node /app/data/build /var/lib/atlas-usage
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s CMD node -e "fetch('http://127.0.0.1:3001/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node --max-old-space-size=2560 dist/build-atlas-cache.mjs && exec node dist/serve.mjs"]
