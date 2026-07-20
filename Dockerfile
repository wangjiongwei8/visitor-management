# ============================================
# 访客管理系统 - 生产环境 Dockerfile
# ============================================

# 构建阶段
FROM node:20-alpine AS builder

# 安装 bash（build.sh 需要）
RUN apk add --no-cache bash

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml .npmrc ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 生产阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制完整 node_modules，使运行时可用 drizzle-kit 进行表结构自举（首次启动自动建表）
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 4000

CMD ["node", "server.js"]
