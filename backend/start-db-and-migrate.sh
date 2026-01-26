#!/bin/bash

echo "🔧 检查 Docker 状态..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker Desktop 未运行"
  echo "请手动启动 Docker Desktop，然后重新运行此脚本"
  echo ""
  echo "启动步骤："
  echo "1. 打开 Docker Desktop 应用程序"
  echo "2. 等待 Docker 引擎启动（任务栏图标变为绿色/静止）"
  echo "3. 运行: cd /d/csaas && docker-compose up -d"
  echo "4. 运行迁移: cd backend && npm run migration:run"
  exit 1
fi

echo "✅ Docker 正在运行"
echo ""
echo "🚀 启动数据库服务..."
cd /d/csaas
docker-compose up -d postgres redis

echo ""
echo "⏳ 等待数据库启动..."
sleep 5

echo ""
echo "🔍 检查数据库连接..."
until docker exec csaas-postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "   等待 PostgreSQL..."
  sleep 2
done

echo "✅ 数据库已就绪"
echo ""
echo "🚀 运行数据库迁移..."
cd /d/csaas/backend
npm run migration:run

echo ""
echo "🔍 运行验证脚本..."
npx ts-node validate-migration.ts

echo ""
echo "✅ 完成！"
