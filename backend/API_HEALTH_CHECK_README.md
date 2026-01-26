# AI API 健康检查工具

## 📋 简介

这是一个用于检查所有AI API（Claude、智谱GLM、通义千问）可用性的健康检查工具。

## ✨ 功能特性

- ✅ **自动测试所有API**：一键测试3个AI API的可用性
- 📊 **详细报告**：显示响应时间、成功率、错误信息
- 💾 **历史记录**：保存检查结果到数据库，支持历史查询
- 🔧 **修复建议**：针对不同错误提供具体的修复建议
- 📈 **统计分析**：查看过去N天的API健康统计
- 🎨 **彩色输出**：使用颜色高亮显示状态和结果

## 🚀 使用方法

### 快速开始

#### 1. 运行健康检查

```bash
# 方法1：使用npm脚本
npm run health:check

# 方法2：直接运行
node test-api-health.js
```

**输出示例**：
```
========================================
   AI API 健康检查
========================================

检查时间: 2026-01-17T01:45:00.000Z

测试 Claude (Anthropic)...
❌ Claude (Anthropic) 失败
   错误: 401 {"error":{"message":"令牌已过期或验证不正确","type":"401"}}

测试 智谱GLM...
❌ 智谱GLM 失败
   错误: 429 余额不足或无可用资源包,请充值。

测试 通义千问...
✅ 通义千问 正常
   响应时间: 1234ms
   响应预览: 通义千问API正常

========================================
   健康检查总结
========================================

总API数: 3
正常: 1
异常: 2

⚠️  总体状态: DEGRADED

💾 健康检查结果已保存到数据库

========================================
   修复建议
========================================

🔧 Claude (Anthropic):
   问题: API密钥过期或无效
   解决: 更新API密钥后重启服务

🔧 智谱GLM:
   问题: 账户余额不足
   解决: 充值账户

📄 详细报告已保存到: backend/api-health-report-1234567890.json
```

#### 2. 查看历史记录

```bash
# 查看过去7天的统计
npm run health:history

# 查看过去30天的统计
node test-api-health.js --history 30
```

**输出示例**：
```
========================================
   过去7天的健康检查统计
========================================

Claude (Anthropic):
  总检查次数: 168
  成功次数: 120
  成功率: 71.4%
  平均响应时间: 1234ms
  最后检查: 2026-01-17 01:45:00

智谱GLM:
  总检查次数: 168
  成功次数: 150
  成功率: 89.3%
  平均响应时间: 2345ms
  最后检查: 2026-01-17 01:45:00

通义千问:
  总检查次数: 168
  成功次数: 168
  成功率: 100.0%
  平均响应时间: 1234ms
  最后检查: 2026-01-17 01:45:00
```

## 📊 输出文件

健康检查会生成以下文件：

### 1. JSON报告
- 文件名：`api-health-report-{timestamp}.json`
- 位置：`backend/` 目录
- 内容：详细的健康检查结果

**JSON格式**：
```json
{
  "timestamp": "2026-01-17T01:45:00.000Z",
  "apis": {
    "Claude (Anthropic)": {
      "status": "unhealthy",
      "responseTime": 5234,
      "responsePreview": null,
      "responseLength": 0,
      "error": "401 {...}"
    },
    "智谱GLM": {
      "status": "unhealthy",
      "responseTime": 1234,
      "responsePreview": null,
      "responseLength": 0,
      "error": "429 余额不足"
    },
    "通义千问": {
      "status": "healthy",
      "responseTime": 1234,
      "responsePreview": "通义千问API正常",
      "responseLength": 9,
      "error": null
    }
  },
  "summary": {
    "total": 3,
    "healthy": 1,
    "unhealthy": 2,
    "overall": "degraded"
  }
}
```

### 2. 数据库记录
- 表名：`api_health_checks`
- 位置：`backend/data/csaas.db`

**表结构**：
```sql
CREATE TABLE api_health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  api_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'healthy' or 'unhealthy'
  response_time INTEGER,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## 🔧 常见错误及解决方案

### 1. Claude (Anthropic) 401错误

**错误信息**：
```
令牌已过期或验证不正确
```

**解决方案**：
1. 访问 https://console.anthropic.com/settings/keys
2. 创建新的API密钥
3. 更新 `backend/.env.development`：
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-你的新密钥
   ```
4. 重启后端服务

### 2. 智谱GLM 429错误

**错误信息**：
```
余额不足或无可用资源包,请充值
```

**解决方案**：
1. 访问 https://open.bigmodel.cn/
2. 登录并充值账户（建议至少100元）
3. 如果余额充足但仍报错，检查API密钥是否有效

### 3. 网络超时错误

**错误信息**：
```
timeout / ETIMEDOUT
```

**解决方案**：
1. 检查网络连接
2. 如果使用代理，检查代理配置
3. 尝试增加超时时间
4. 检查防火墙设置

## 🔄 定时检查（可选）

### 使用Windows任务计划程序

#### 1. 创建批处理脚本

创建 `backend/run-health-check.bat`：
```batch
@echo off
cd /d D:\csaas\backend
node test-api-health.js
```

#### 2. 打开任务计划程序

```bash
# Win+R 输入
taskschd.msc
```

#### 3. 创建基本任务

- 名称：`CSaaS API Health Check`
- 触发器：每天（建议每30分钟或每小时）
- 操作：启动程序
  - 程序：`D:\csaas\backend\run-health-check.bat`

### 使用cron（Linux/Mac）

```bash
# 编辑crontab
crontab -e

# 添加定时任务（每30分钟检查一次）
*/30 * * * * cd /path/to/csaas/backend && node test-api-health.js >> health-check.log 2>&1
```

## 📈 集成到CI/CD

### GitHub Actions示例

```yaml
name: API Health Check

on:
  schedule:
    - cron: '*/30 * * * *'  # 每30分钟
  workflow_dispatch:       # 手动触发

jobs:
  health-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Build backend
        working-directory: ./backend
        run: npm run build

      - name: Run health check
        working-directory: ./backend
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TONGYI_API_KEY: ${{ secrets.TONGYI_API_KEY }}
        run: node test-api-health.js

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: health-check-report
          path: backend/api-health-report-*.json
```

## 🎯 最佳实践

1. **定期检查**：建议每30分钟或每小时检查一次
2. **设置告警**：当所有API都不可用时发送通知
3. **监控趋势**：关注成功率和响应时间的变化
4. **备选方案**：至少保持2个API可用，确保服务连续性
5. **日志分析**：定期查看历史记录，发现潜在问题

## 📞 故障排查

### 问题1：脚本无法运行

**检查**：
```bash
# 确认后端已编译
npm run build

# 确认依赖已安装
npm install

# 手动测试
node test-api-health.js
```

### 问题2：数据库写入失败

**检查**：
```bash
# 确认数据库目录存在
ls backend/data

# 确认数据库文件存在
ls backend/data/csaas.db
```

### 问题3：所有API都失败

**检查**：
1. 网络连接是否正常
2. API密钥是否配置正确
3. 账户余额是否充足
4. 查看详细日志

## 📚 相关文档

- [Claude API文档](https://docs.anthropic.com/)
- [智谱GLM文档](https://open.bigmodel.cn/dev/api)
- [通义千问文档](https://help.aliyun.com/zh/dashscope/)

## 🔄 更新日志

### v1.0.0 (2026-01-17)
- ✅ 初始版本
- ✅ 支持3个API的健康检查
- ✅ 历史记录查询
- ✅ 彩色输出和修复建议

---

**作者**：Claude Code
**最后更新**：2026-01-17
**版本**：1.0.0
