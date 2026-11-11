# DocuMax worker image. Playwright base image ships Chromium for PDF rendering (Phase 8).
# Build from the repo root:  docker build -f worker/Dockerfile -t documax-worker .
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY lib ./lib
COPY worker ./worker

# tsx runs TypeScript directly and resolves the @/ path alias from tsconfig.json.
CMD ["npx", "tsx", "--tsconfig", "tsconfig.json", "worker/index.ts"]
