# DocuMax worker image. Playwright base image ships Chromium for PDF rendering (Phase 8).
# Build from the repo root:  docker build -f worker/Dockerfile -t documax-worker .
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json tsconfig.worker.json ./
COPY lib ./lib
COPY content ./content
COPY pdf ./pdf
COPY worker ./worker

# tsx runs TypeScript directly; tsconfig.worker.json = tsconfig.json + a JSX transform for pdf/ templates.
CMD ["npx", "tsx", "--tsconfig", "tsconfig.worker.json", "worker/index.ts"]
