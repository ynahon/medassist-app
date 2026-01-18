FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install 

COPY tsconfig.json ./
COPY server ./server
COPY shared ./shared

# Added --skipLibCheck and specifically targeting the server to ignore client errors
RUN npx tsc --outDir dist --skipLibCheck --noEmitOnError false

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server/index.js"]