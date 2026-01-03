@echo off
chcp 65001 >nul
echo === 成熟度分析测试 ===
echo.

set SURVEY_ID=7be10994-9734-47e0-b267-c379dd5ac561
set BASE_URL=http://localhost:3000

echo 1. 提交问卷 (使用简化的测试数据)...
curl -X POST "%BASE_URL%/survey/%SURVEY_ID%/submit" ^
  -H "Content-Type: application/json" ^
  -d "{\"answers\":{\"test-q1\":{\"answer\":\"test-opt1\",\"score\":3},\"test-q2\":{\"answer\":\"test-opt2\",\"score\":4}},\"totalScore\":100,\"maxScore\":550,\"notes\":\"测试提交\"}" ^
  -s | python -m json.tool

echo.
echo 2. 调用成熟度分析API...
curl -X POST "%BASE_URL%/survey/%SURVEY_ID%/analyze" ^
  -H "Content-Type: application/json" ^
  -s

echo.
echo === 测试完成 ===
