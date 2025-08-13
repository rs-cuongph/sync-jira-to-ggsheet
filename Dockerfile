# -------- Build stage --------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# -------- Runtime stage --------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Chỉ cài deps production
COPY package*.json ./
RUN npm ci --omit=dev

# Copy mã đã build
COPY --from=builder /app/dist ./dist

# copy file env (tuỳ chọn: bind-mount lúc chạy)
# COPY .env ./.env

# Cấu hình timezone (tuỳ môi trường)
# RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime

CMD ["node", "dist/cron.js"]
    