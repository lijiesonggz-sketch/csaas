.PHONY: help dev dev-frontend dev-backend db-up db-down db-reset install clean

# 默认目标
help:
	@echo "Csaas 开发命令"
	@echo ""
	@echo "make dev              - 启动完整开发环境（数据库+前端+后端）"
	@echo "make dev-frontend     - 仅启动前端开发服务器"
	@echo "make dev-backend      - 仅启动后端开发服务器"
	@echo "make db-up            - 启动数据库服务（PostgreSQL + Redis）"
	@echo "make db-down          - 停止数据库服务"
	@echo "make db-reset         - 重置数据库（删除数据并重新初始化）"
	@echo "make install          - 安装前后端依赖"
	@echo "make clean            - 清理node_modules和构建文件"

# 安装所有依赖
install:
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "📦 Installing backend dependencies..."
	cd backend && npm install
	@echo "✅ All dependencies installed!"

# 启动数据库
db-up:
	@echo "🐘 Starting PostgreSQL and Redis..."
	docker-compose up -d
	@echo "✅ Databases are running!"

# 停止数据库
db-down:
	@echo "🛑 Stopping databases..."
	docker-compose down
	@echo "✅ Databases stopped!"

# 重置数据库
db-reset:
	@echo "🗑️  Resetting databases..."
	docker-compose down -v
	docker-compose up -d
	@echo "✅ Databases reset complete!"

# 启动前端开发服务器
dev-frontend:
	@echo "🎨 Starting frontend dev server..."
	cd frontend && npm run dev

# 启动后端开发服务器
dev-backend:
	@echo "⚙️  Starting backend dev server..."
	cd backend && npm run start:dev

# 启动完整开发环境（需要手动在不同终端运行）
dev:
	@echo "🚀 Starting development environment..."
	@echo ""
	@echo "Please run the following commands in separate terminals:"
	@echo "  1. make dev-frontend"
	@echo "  2. make dev-backend"
	@echo ""
	@echo "Or use this command to start databases only:"
	@echo "  make db-up"

# 清理构建文件
clean:
	@echo "🧹 Cleaning build files..."
	rm -rf frontend/node_modules frontend/.next
	rm -rf backend/node_modules backend/dist
	@echo "✅ Clean complete!"
