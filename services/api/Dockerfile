# syntax=docker/dockerfile:1

# The API server, without the Atlas release it serves. Build it from the
# repository root, since the server depends on the workspace packages:
#
#   docker build -f services/api/Dockerfile -t uk-data-atlas-api .
#
# The release is `services/api/public`, built by `pnpm --dir services/api build`
# from the same commit, and mounted at /app/public when the container runs.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS deploy
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The pnpm version is the one package.json names.
RUN corepack enable && corepack install
COPY packages packages
COPY services/api services/api
# The server's own files and its production dependencies, and nothing else of
# the workspace.
RUN pnpm --filter @uk-data-atlas/api deploy --prod /app

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production
# The server listens on loopback unless told otherwise, which nothing outside
# the container could reach.
ENV HOST=0.0.0.0
ENV PORT=3001
WORKDIR /app
COPY --from=deploy /app ./
USER node
EXPOSE 3001
VOLUME ["/app/public"]
# Ready only once every catalogue is read, which takes a few seconds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/readyz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node is the container's first process, so SIGTERM reaches the server and it
# drains open requests before exiting.
CMD ["node", "--import", "tsx", "scripts/serve.ts"]
