# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 配置 npm 使用淘宝镜像并增加超时时间
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5

# 跳过 Puppeteer 下载 Chrome（容器内单独安装 chromium）
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 安装依赖（只执行一次，生产阶段直接复制）
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装 chromium 供 Puppeteer 使用
RUN apk add --no-cache chromium curl
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 从构建阶段复制编译后的代码和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "dist/src/main"]
