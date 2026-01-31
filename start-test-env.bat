@echo off
REM Epic 2 手工测试快速启动脚本 (Windows)
REM 用途：一键启动所有必需的服务进行手工测试

echo 🚀 Epic 2 手工测试环境启动中...
echo.

echo 📋 检查必需服务...

REM 检查 PostgreSQL
echo   PostgreSQL:
pg_isready -h localhost -p 5432 >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ 运行中
) else (
    echo   ❌ 未运行 - 请先启动 PostgreSQL
    pause
    exit /b 1
)

REM 检查 Redis
echo   Redis:
redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ 运行中
) else (
    echo   ❌ 未运行 - 请先启动 Redis
    pause
    exit /b 1
)

echo.
echo ✅ 所有必需服务已就绪
echo.

REM 启动后端服务
echo 🔧 启动后端服务...
cd /d D:\csaas\backend
start "Csaas Backend" cmd /k "npm run start:dev"
echo   后端服务启动中: http://localhost:3000
echo   等待 10 秒让后端完全启动...
timeout /t 10 /nobreak >nul

REM 启动前端服务
echo.
echo 🎨 启动前端服务...
cd /d D:\csaas\frontend
start "Csaas Frontend" cmd /k "npm run dev"
echo   前端服务启动中: http://localhost:3001
echo   等待 5 秒让前端完全启动...
timeout /t 5 /nobreak >nul

echo.
echo ✅ 所有服务已启动！
echo.
echo 📖 测试指南: D:\csaas\EPIC2_MANUAL_TEST_GUIDE.md
echo.
echo 🌐 访问地址:
echo   - 前端: http://localhost:3001
echo   - 后端 API: http://localhost:3000
echo   - API 文档: http://localhost:3000/api
echo.
echo 🧪 开始测试:
echo   1. 打开浏览器访问 http://localhost:3001
echo   2. 登录系统
echo   3. 导航到 /radar/tech
echo   4. 按照测试指南进行测试
echo.
echo 💡 提示: 两个命令窗口已打开（后端和前端）
echo    关闭这些窗口将停止服务
echo.

REM 自动打开浏览器
echo 🌐 正在打开浏览器...
timeout /t 3 /nobreak >nul
start http://localhost:3001

echo.
pause
