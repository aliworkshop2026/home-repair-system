# ============================================================
# 家用设备上门检修预约系统 —— 云端部署镜像
# 适配平台：Render / Railway / Koyeb / Fly.io 等（均免备案）
# Node.js 24 内置 node:sqlite，云端无需安装任何数据库软件
# ============================================================
FROM node:24-slim

WORKDIR /app

# 先拷贝依赖清单并安装，充分利用镜像构建缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 拷贝全部项目源码
COPY . .

# 数据库文件目录：云平台把持久化硬盘挂载到 /data 即可永久保存数据
# （未挂载硬盘时数据存容器内，重新部署会自动重建并初始化演示数据）
ENV NODE_ENV=production
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

# 云平台通过 PORT 环境变量指定端口；未指定时默认 3000
EXPOSE 3000

# 平台健康检查直接访问 /api/health
CMD ["node", "server.js"]
