@echo off
echo ========================================
echo   AI API 快速健康检查
echo ========================================
echo.

echo 检查时间: %date% %time%
echo.

echo [1/3] 测试 Claude API...
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation ^
  -H "Content-Type: application/json" ^
  -d "{\"taskId\":\"test-claude\",\"standardDocument\":{\"id\":\"test\",\"name\":\"Test\",\"content\":\"测试内容\"}}" ^
  2>nul | findstr /C:"success" >nul
if %errorlevel% equ 0 (
  echo ✅ Claude API 正常
) else (
  echo ❌ Claude API 失败
)
echo.

echo [2/3] 测试 智谱GLM API...
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation ^
  -H "Content-Type: application/json" ^
  -d "{\"taskId\":\"test-glm\",\"standardDocument\":{\"id\":\"test\",\"name\":\"Test\",\"content\":\"测试内容\"}}" ^
  2>nul | findstr /C:"success" >nul
if %errorlevel% equ 0 (
  echo ✅ 智谱GLM API 正常
) else (
  echo ❌ 智谱GLM API 失败
)
echo.

echo [3/3] 测试 通义千问API...
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation ^
  -H "Content-Type: application/json" ^
  -d "{\"taskId\":\"test-tongyi\",\"standardDocument\":{\"id\":\"test\",\"name\":\"Test\",\"content\":\"测试内容\"}}" ^
  2>nul | findstr /C:"success" >nul
if %errorlevel% equ 0 (
  echo ✅ 通义千问 API 正常
) else (
  echo ❌ 通义千问 API 失败
)
echo.

echo ========================================
echo   检查完成
echo ========================================
pause
