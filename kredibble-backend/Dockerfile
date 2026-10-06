FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --chown=node:node src ./src

# The commit this image was built from, reported by /api/v1/health (SEC-112). CI passes
# --build-arg RELEASE_SHA=<sha>. Render's own build leaves it empty, and the API then
# falls back to RENDER_GIT_COMMIT.
ARG RELEASE_SHA=""
ENV RELEASE_SHA=${RELEASE_SHA}


USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]