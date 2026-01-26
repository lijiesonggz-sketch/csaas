# API健康检查 - 快速指南

## 🎯 问题诊断

根据错误日志，当前API状态：
- ❌ **Claude API**: 401 令牌过期或验证不正确
- ❌ **智谱GLM**: 429 余额不足或无可用资源包
- ✅ **通义千问**: 正常工作

## 🚀 解决方案

### 方案1：手动测试API（最简单）

#### 1. 测试Claude API
```bash
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-claude-'$(date +%s)'",
    "standardDocument": {
      "id": "test",
      "name": "Test",
      "content": "这是测试内容，请回复：测试成功"
    }
  }'
```

**期望结果**：
- 成功：`{"success": true, ...}`
- 失败：`{"success": false, "error": "401 {...}"}`

#### 2. 测试智谱GLM
```bash
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-glm-'$(date +%s)'",
    "standardDocument": {
      "id": "test",
      "name": "Test",
      "content": "这是测试内容"
    }
  }'
```

**期望结果**：
- 成功：`{"success": true, ...}`
- 失败：`{"success": false, "error": "429 余额不足..."}`

#### 3. 测试通义千问
```bash
curl -X POST http://localhost:3000/api/ai-generation/standard-interpretation \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-tongyi-'$(date +%s)'",
    "standardDocument": {
      "id": "test",
      "name": "Test",
      "content": "这是测试内容"
    }
  }'
```

### 方案2：检查后端日志（推荐）

#### 实时监控API状态
```bash
# 查看最近100行日志
cd backend
tail -f combined.log | grep -E "(Anthropic|OpenAI|Tongyi|API)"
```

#### 搜索错误
```bash
# 搜索Claude错误
grep "Anthropic.*401" combined.log

# 搜索智谱GLM错误
grep "OpenAI.*429" combined.log

# 搜索通义千问状态
grep "TongyiClient.*isAvailable" combined.log
```

### 方案3：更新API密钥（必须）

#### 步骤1：更新Claude API密钥

1. 访问：https://console.anthropic.com/settings/keys
2. 创建新密钥
3. 编辑配置文件：
   ```bash
   notepad backend\.env.development
   ```
4. 更新这行：
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-你的新密钥
   ```

#### 步骤2：充值智谱GLM

1. 访问：https://open.bigmodel.cn/
2. 登录账户
3. 充值（建议至少100元）

#### 步骤3：重启服务

```bash
# 在后端终端按 Ctrl+C 停止服务
# 然后重新启动
cd backend
npm run start:dev
```

### 方案4：使用Postman或类似工具

#### 导入以下配置到Postman

**请求1：测试标准解读**
```
POST http://localhost:3000/api/ai-generation/standard-interpretation
Content-Type: application/json

{
  "taskId": "test-{{timestamp}}",
  "standardDocument": {
    "id": "test-doc",
    "name": "测试标准",
    "content": "这是一个测试标准文档，用于验证API是否正常工作。"
  },
  "interpretationMode": "basic"
}
```

**期望响应**：
```json
{
  "success": true,
  "data": {
    "taskId": "test-xxx",
    "selectedResult": {...}
  }
}
```

## 📊 验证修复

修复后，运行以下命令验证：

```bash
# 1. 确认服务运行
curl http://localhost:3000/api/health

# 2. 运行测试任务
node test-api.js

# 3. 检查日志
tail -f backend/combined.log
```

## 🔍 故障排查清单

- [ ] Claude API密钥是否更新到最新？
- [ ] 智谱GLM账户余额是否充足？
- [ ] 环境变量是否正确配置？
- [ ] 后端服务是否重启？
- [ ] 网络连接是否正常？
- [ ] 防火墙是否允许API访问？

## 💡 临时方案

如果暂时无法修复其他API，系统会自动：
- ✅ 检测到Claude失败 → 尝试智谱GLM
- ✅ 检测到智谱GLM失败 → 尝试通义千问
- ✅ 使用通义千问完成任务

**影响**：
- 只有单一模型结果（没有三模型对比）
- 可能影响结果质量和置信度评分

## 📞 需要帮助？

如果按照上述步骤仍然无法解决问题，请提供：
1. 完整的错误日志
2. `.env.development` 文件内容（隐藏敏感信息）
3. 后端版本信息

---

**更新时间**：2026-01-17
**状态**：🔴 需要修复Claude和智谱GLM API
