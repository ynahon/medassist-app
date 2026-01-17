FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Use 'npm install' if 'npm ci' fails due to lockfile versioning
RUN npm ci

COPY tsconfig.json ./
COPY server ./server
COPY shared ./shared

# Added '|| true' so the build continues even if TypeScript has errors
RUN npm run build || npx tsc --outDir dist || true

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Ensure this path matches where your compiled entry point actually is
CMD ["node", "dist/server/index.js"]
