@echo off
REM 查找12月29日的聚类任务日志
findstr /S /C:"2f1284ba-8b18-40a7-a787-ed05a9a14128" D:\csaas\backend\logs\*.log > dec29_task.txt

REM 查找今天的聚类任务日志
findstr /S /C:"51627820-d0d1-492c-ab05-d78371fe324f" D:\csaas\backend\logs\*.log > dec31_task.txt

echo 12月29日任务日志行数:
find /C /V "" dec29_task.txt

echo.
echo 今天任务日志行数:
find /C /V "" dec31_task.txt

echo.
echo === 12月29日任务的前100行 ===
powershell -Command "Get-Content dec29_task.txt | Select-Object -First 100"

echo.
echo === 今天任务的前100行 ===
powershell -Command "Get-Content dec31_task.txt | Select-Object -First 100"
