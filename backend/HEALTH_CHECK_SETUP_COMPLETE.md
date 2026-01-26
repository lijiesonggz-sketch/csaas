# ✅ API健康检查工具 - 创建完成

## 📦 已创建的文件

### 1. **健康检查脚本**
- `test-api-health.js` - 完整版（需要数据库支持）
- `test-api-health-simple.js` - 简化版（无数据库）
- `test-api-health-direct.js` - 直接版（使用AI客户端）

### 2. **配置和文档**
- `API_HEALTH_CHECK_README.md` - 详细使用文档
- `API_HEALTH_CHECK_QUICK_GUIDE.md` - 快速诊断指南
- `check-api-quick.bat` - Windows批处理脚本

### 3. **package.json更新**
已添加以下npm脚本：
```json
"health:check": "node test-api-health.js",
"health:history": "node test-api-health.js --history"
```

## 🚀 快速开始

### Windows用户（推荐）
```bash
# 方式1：使用批处理脚本
cd backend
check-api-quick.bat

# 方式2：使用npm脚本
npm run health:check
```

### Linux/Mac用户
```bash
cd backend
node test-api-health-simple.js
```

## 📊 当前API状态（根据错误日志）

| API | 状态 | 错误信息 | 解决方案 |
|-----|------|---------|---------|
| **Claude** | 🔴 异常 | 401 令牌已过期 | 更新API密钥 |
| **智谱GLM** | 🔴 异常 | 429 余额不足 | 充值账户 |
| **通义千问** | ✅ 正常 | - | 无需操作 |

## 🔧 立即行动项

### 1. 更新Claude API密钥（5分钟）
```bash
# 1. 访问获取新密钥
https://console.anthropic.com/settings/keys

# 2. 更新配置
notepad backend\.env.development

# 3. 修改这行
ANTHROPIC_API_KEY=sk-ant-api03-你的新密钥

# 4. 重启服务
# Ctrl+C 停止，然后
npm run start:dev
```

### 2. 充值智谱GLM账户（10分钟）
```bash
# 1. 访问充值页面
https://open.bigmodel.cn/

# 2. 登录并充值（建议100元起）

# 3. 确认余额充足后重启服务
```

### 3. 验证修复（2分钟）
```bash
# 运行健康检查
cd backend
node test-api-health-simple.js

# 或者查看日志
tail -f combined.log | grep -E "(Claude|GLM|Tongyi)"
```

## 📈 预期结果

修复后，健康检查应该显示：
```
========================================
   AI API 健康检查
========================================

测试 Claude (Anthropic)...
✅ Claude (Anthropic) 正常
   响应时间: 1234ms

测试 智谱GLM...
✅ 智谱GLM 正常
   响应时间: 2345ms

测试 通义千问...
✅ 通义千问 正常
   响应时间: 1234ms

========================================
   健康检查总结
========================================

总API数: 3
正常: 3
异常: 0

✅ 总体状态: HEALTHY
```

## 💡 定期检查建议

### 方式1：Windows任务计划程序
1. 打开任务计划程序：`taskschd.msc`
2. 创建基本任务
3. 触发器：每天每小时
4. 操作：运行 `backend\test-api-health-simple.js`

### 方式2：手动定期检查
```bash
# 每天早上运行一次
cd backend
node test-api-health-simple.js
```

### 方式3：CI/CD集成
参考 `API_HEALTH_CHECK_README.md` 中的GitHub Actions配置

## 📁 文件位置

```
backend/
├── test-api-health.js                      # 完整版（需要数据库）
├── test-api-health-simple.js               # 简化版（推荐）
├── test-api-health-direct.js               # 直接版
├── check-api-quick.bat                     # Windows批处理
├── API_HEALTH_CHECK_README.md              # 详细文档
├── API_HEALTH_CHECK_QUICK_GUIDE.md         # 快速指南
└── package.json                             # 已添加health脚本
```

## ⚠️ 重要提示

1. **不要将API密钥提交到Git**
   - `.env.development` 已在 `.gitignore` 中
   - 确保不要意外提交密钥

2. **定期更新API密钥**
   - Claude: 每3-6个月
   - 智谱GLM: 按需充值
   - 通义千问: 按需充值

3. **监控API使用量**
   - 设置告警阈值
   - 避免意外超额使用

## 🔄 降级策略

如果部分API不可用，系统会自动：
```
Claude失败 → 尝试智谱GLM → 尝试通义千问 → 完成
```

**性能影响**：
- ✅ 任务仍可完成
- ⚠️ 只有单一模型结果
- ⚠️ 置信度评分可能降低

## 📞 获取帮助

如果遇到问题：
1. 查看 `API_HEALTH_CHECK_QUICK_GUIDE.md`
2. 检查 `combined.log` 日志文件
3. 运行 `test-api-health-simple.js` 诊断

## ✅ 下一步

1. ✅ 更新Claude API密钥
2. ✅ 充值智谱GLM账户
3. ✅ 重启后端服务
4. ✅ 运行健康检查验证
5. ✅ 设置定期检查任务

---

**创建时间**：2026-01-17
**状态**：✅ 完成
**版本**：1.0.0
