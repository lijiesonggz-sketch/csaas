#!/bin/bash

# Epic 2 手工测试快速启动脚本
# 用途：一键启动所有必需的服务进行手工测试

echo "🚀 Epic 2 手工测试环境启动中..."
echo ""

# 检查必需的服务
echo "📋 检查必需服务..."

# 检查 PostgreSQL
echo -n "  PostgreSQL: "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ 运行中"
else
    echo "❌ 未运行 - 请先启动 PostgreSQL"
    exit 1
fi

# 检查 Redis
echo -n "  Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ 运行中"
else
    echo "❌ 未运行 - 请先启动 Redis"
    exit 1
fi

echo ""
echo "✅ 所有必需服务已就绪"
echo ""

# 启动后端服务
echo "🔧 启动后端服务..."
cd D:/csaas/backend
start cmd /k "npm run start:dev"
echo "  后端服务启动中: http://localhost:3000"
echo "  等待 10 秒让后端完全启动..."
sleep 10

# 启动前端服务
echo ""
echo "🎨 启动前端服务..."
cd D:/csaas/frontend
start cmd /k "npm run dev"
echo "  前端服务启动中: http://localhost:3001"
echo "  等待 5 秒让前端完全启动..."
sleep 5

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📖 测试指南: D:/csaas/EPIC2_MANUAL_TEST_GUIDE.md"
echo ""
echo "🌐 访问地址:"
echo "  - 前端: http://localhost:3001"
echo "  - 后端 API: http://localhost:3000"
echo "  - API 文档: http://localhost:3000/api"
echo ""
echo "🧪 开始测试:"
echo "  1. 打开浏览器访问 http://localhost:3001"
echo "  2. 登录系统"
echo "  3. 导航到 /radar/tech"
echo "  4. 按照测试指南进行测试"
echo ""
echo "按 Ctrl+C 停止此脚本（服务将继续运行）"
echo ""

# 保持脚本运行
read -p "按 Enter 键退出..."
