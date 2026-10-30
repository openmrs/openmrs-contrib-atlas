# Atlas publish service for Cloud Run. Build from the repository root:
#   docker build -f service/Dockerfile -t atlas-service .
# Node 24 runs the TypeScript sources directly (type stripping), so there is no build step.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests first, so dependency layers are cached across source changes.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY service/package.json service/
COPY web/package.json web/
COPY migration/package.json migration/
COPY apps-script/package.json apps-script/
RUN npm ci --omit=dev --workspace service --ignore-scripts && npm cache clean --force

COPY shared/src shared/src
COPY service/src service/src

USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "service/src/server.ts"]
