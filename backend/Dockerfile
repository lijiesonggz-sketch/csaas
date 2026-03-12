# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 配置 npm 使用淘宝镜像并增加超时时间
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 600000

# 跳过 Puppeteer 下载 Chrome（容器内单独安装 chromium）
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装 chromium 供 Puppeteer 使用
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 复制 package 文件
COPY package*.json ./

# 配置 npm 使用淘宝镜像并增加超时时间
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 600000

# 只安装生产依赖
RUN npm install --omit=dev --legacy-peer-deps

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "dist/main"]
