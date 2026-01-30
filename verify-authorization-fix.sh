#!/bin/bash

# Authorization Header 问题验证脚本
# 用于测试 404 日志和请求日志改进

echo "=========================================="
echo "Authorization Header 问题验证测试"
echo "=========================================="
echo ""

# 检查后端服务器是否运行
echo "1. 检查后端服务器状态..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health)
if [ $? -eq 0 ]; then
    echo "✅ 后端服务器正在运行"
    echo "   响应: $HEALTH_CHECK"
else
    echo "❌ 后端服务器未运行，请先启动: cd backend && npm run start:dev"
    exit 1
fi
echo ""

# 测试 404 端点（模拟浏览器扩展请求）
echo "2. 测试 404 端点（模拟浏览器扩展）..."
echo "   请求: GET /api/agents"
RESPONSE=$(curl -s -H "User-Agent: BrowserExtension/1.0" -H "Referer: chrome-extension://abc123" http://localhost:3000/api/agents)
echo "   响应: $RESPONSE"
echo "   ⚠️  检查后端日志，应该看到 [404 NOT FOUND] 日志"
echo ""

# 测试 404 端点（模拟开发者工具）
echo "3. 测试 404 端点（模拟开发者工具）..."
echo "   请求: GET /api/modules/ffmpeg/overview"
RESPONSE=$(curl -s -H "User-Agent: PostmanRuntime/7.x" http://localhost:3000/api/modules/ffmpeg/overview)
echo "   响应: $RESPONSE"
echo "   ⚠️  检查后端日志，应该看到 [404 NOT FOUND] 日志"
echo ""

# 测试 404 端点（模拟第三方工具）
echo "4. 测试 404 端点（模拟第三方工具）..."
echo "   请求: GET /api/modules/ssh/overview"
RESPONSE=$(curl -s -H "User-Agent: SecurityScanner/2.0" http://localhost:3000/api/modules/ssh/overview)
echo "   响应: $RESPONSE"
echo "   ⚠️  检查后端日志，应该看到 [404 NOT FOUND] 日志"
echo ""

# 测试合法端点
echo "5. 测试合法端点..."
echo "   请求: GET /health"
RESPONSE=$(curl -s http://localhost:3000/health)
echo "   响应: $RESPONSE"
echo "   ✅ 检查后端日志，应该看到 [REQUEST] 日志（包含 User-Agent）"
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "📋 预期日志格式："
echo ""
echo "合法请求："
echo "[REQUEST] GET /health {"
echo "  query: {},"
echo "  headers: {"
echo "    authorization: undefined,"
echo "    'content-type': undefined,"
echo "    'user-agent': 'curl/8.x.x',"
echo "    referer: undefined"
echo "  },"
echo "  ip: '::1'"
echo "}"
echo ""
echo "404 请求："
echo "[404 NOT FOUND] {"
echo "  method: 'GET',"
echo "  url: '/api/agents',"
echo "  userAgent: 'BrowserExtension/1.0',"
echo "  referer: 'chrome-extension://abc123',"
echo "  ip: '::1'"
echo "}"
echo ""
echo "🔍 下一步："
echo "1. 观察后端日志，识别 authorization undefined 的真实来源"
echo "2. 根据 User-Agent 和 Referer 判断请求来源"
echo "3. 如果发现大量可疑请求，考虑实施 Phase 2（请求来源验证）"
