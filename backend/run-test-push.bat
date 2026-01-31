@echo off
REM 使用Docker运行SQL脚本
REM 使用方法: run-test-push.bat

docker exec -i csaas-postgres psql -U csaas_user -d csaas_dev < create-test-push.sql

echo.
echo ✅ 测试数据插入完成!
echo 💡 现在可以运行: npx ts-node trigger-push.ts
pause
