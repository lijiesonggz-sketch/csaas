# 标准解读生成失败 - 诊断指南

## 问题：后台看不到任务为什么失败

### 原因说明
当前后端运行在**开发模式**下，日志只输出到**控制台**，不会写入日志文件。

所以要查看失败原因，需要：

---

## 方法 1：查看后端控制台（推荐）

### 步骤：
1. **找到运行后端的终端窗口**
   - 应该有一个窗口显示类似：
     ```
     🚀 Backend server running on http://localhost:3000
     ```

2. **在终端中查找错误日志**
   - 向上滚动查找包含 `[ERROR]` 或 `error:` 的行
   - 特别注意包含 `standard_interpretation` 的日志

3. **重新触发错误**
   - 在浏览器中刷新页面
   - 点击"生成标准解读"按钮
   - 立即切换到后端终端查看新的日志输出

4. **记录完整的错误堆栈**
   - 复制所有包含 `ERROR` 的日志行
   - 特别是包含 `All three AI models failed` 的消息

---

## 方法 2：查看浏览器控制台

### 步骤：
1. **打开浏览器开发者工具**
   - 按 `F12` 或右键 → "检查"
   - 切换到 **Console** 标签

2. **清除旧日志**
   - 点击 🚫 图标清除控制台

3. **重新触发**
   - 点击"生成标准解读"
   - 观察控制台输出

4. **查找 WebSocket 错误**
   - 查找包含 `❌ Task failed:` 的消息
   - 复制完整的错误对象

---

## 方法 3：使用数据库直接查询（需要MySQL客户端）

### 如果你安装了 MySQL 客户端：

```bash
mysql -u root -p csaas
```

然后执行：

```sql
-- 查看最新的失败任务
SELECT id, type, status, error_message, created_at, generation_stage
FROM ai_task
WHERE project_id = 'f504ab5a-7347-4148-bffe-cc55d97752e6'
  AND status = 'FAILED'
ORDER BY created_at DESC
LIMIT 1;

-- 查看该任务的AI事件
SELECT model, error_message, created_at
FROM ai_generation_event
WHERE task_id = '(上面的任务ID)'
ORDER BY created_at;
```

---

## 常见的失败原因

### 1. All three AI models failed（三个AI模型都失败）
**原因**：
- OpenAI API 密钥无效或额度不足
- Claude API 密钥配置错误
- 通义千问 API 配置错误

**解决**：检查 `backend/.env.development` 中的 API 密钥

### 2. Timeout（超时）
**原因**：
- 标准文档内容过大
- AI 响应时间过长

**解决**：增加 `maxTokens` 或分段处理

### 3. Parse error（解析错误）
**原因**：
- AI 返回的不是有效 JSON
- JSON 格式不符合预期

**解决**：修改 prompt 要求更严格的 JSON 格式

### 4. Network error（网络错误）
**原因**：
- 无法连接到 AI API
- 代理配置问题

**解决**：检查网络连接和代理设置

---

## 快速诊断命令

如果你想让我帮你诊断，请提供：

1. **后端控制台的完整错误日志**（包含 [ERROR] 的所有行）
2. **浏览器控制台的 `❌ Task failed:` 消息**
3. **或者数据库中 `ai_task.error_message` 字段的内容**

将这些信息复制粘贴给我，我就能准确分析问题！

---

## 临时解决方案：启用详细日志

如果需要查看完整的日志，可以修改 `backend/.env.development`：

```bash
# 切换到生产模式以启用文件日志
NODE_ENV=production
```

然后重启后端，日志会写入：
- `backend/logs/error.log` - 错误日志
- `backend/logs/combined.log` - 所有日志
