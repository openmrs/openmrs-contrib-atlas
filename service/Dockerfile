# The Atlas: the service, the map site it serves, and nothing else. Build from the repository root,
# one image per environment (specs/deployment; infra/README.md):
#   docker build -f service/Dockerfile --build-arg ATLAS_ENVIRONMENT=staging \
#     --build-arg VITE_SITE_URL=https://atlas-stg.openmrs.org \
#     --build-arg VITE_KEYCLOAK_ISSUER=https://id-stg.openmrs.org/realms/openmrs \
#     --build-arg VITE_KEYCLOAK_CLIENT_ID=atlas -t openmrsinfra/atlas:staging .
# Node 24 runs the service's TypeScript sources directly (type stripping), so only the map site
# is built.

FROM node:24-slim AS site
WORKDIR /build
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY service/package.json service/
COPY web/package.json web/
COPY migration/package.json migration/
COPY apps-script/package.json apps-script/
RUN npm ci --ignore-scripts
COPY shared shared
# The web typecheck reads one of the service's type declarations.
COPY service/src service/src
COPY web web
ARG ATLAS_ENVIRONMENT
ARG VITE_SITE_URL
ARG VITE_KEYCLOAK_ISSUER
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_GA_ID
# Only the production image is built with Google Analytics, whatever is passed in.
RUN if [ "$ATLAS_ENVIRONMENT" != production ]; then export VITE_GA_ID=""; fi && \
    VITE_DATA_BASE_URL=/data npm run build -w web

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
# Fonts and the logo for social cards.
COPY service/assets service/assets
COPY --from=site /build/web/dist web/dist

# The data folder: published files, history, cards and logos. Mount a named volume here; a new
# volume takes this folder's owner, so the service can write to it.
RUN mkdir /atlas_data && chown node:node /atlas_data
VOLUME /atlas_data

# Which environment this image is for decides its email safety rules (service/README.md).
ARG ATLAS_ENVIRONMENT
ARG ATLAS_COMMIT
ENV ATLAS_ENVIRONMENT=${ATLAS_ENVIRONMENT} ATLAS_COMMIT=${ATLAS_COMMIT} DATA_DIR=/atlas_data

USER node
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# --trace-warnings: a warning in the logs says where it came from (openspec speed-up-edits).
CMD ["node", "--trace-warnings", "service/src/server.ts"]
