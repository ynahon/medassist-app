# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy sources
COPY tsconfig.json ./
COPY server ./server
COPY shared ./shared

# Build: force output to dist/ and keep folder structure starting at /app
# This guarantees dist/server/... exists if your entry is server/index.ts
RUN npx tsc \
  --project tsconfig.json \
  --outDir dist \
  --rootDir . \
  --noEmitOnError false

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8080

# IMPORTANT: set this to the real compiled entry file
# Most common for server/index.ts with --rootDir . is:
CMD ["node", "dist/server/index.js"]
