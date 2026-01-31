# Epic 2 手工测试验证指南

**Epic**: 技术雷达 - ROI导向的技术决策支持
**测试日期**: 2026-01-28
**测试人员**: _________
**环境**: 本地开发环境

---

## 📋 测试前准备

### 1. 启动服务

#### 启动后端服务
```bash
cd D:\csaas\backend
npm run start:dev
```
**预期结果**:
- ✅ 后端服务启动在 `http://localhost:3000`
- ✅ 数据库连接成功
- ✅ Redis 连接成功
- ✅ 看到日志: `Application is running on: http://localhost:3000`

#### 启动前端服务
```bash
cd D:\csaas\frontend
npm run dev
```
**预期结果**:
- ✅ 前端服务启动在 `http://localhost:3001`
- ✅ 看到日志: `Ready in XXXms`

### 2. 准备测试数据

#### 创建测试用户（如果还没有）
```bash
# 使用 Postman 或 curl 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "name": "测试用户"
  }'
```

#### 登录获取 Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```
**保存返回的 access_token，后续测试需要使用**

---

## 🧪 Story 2.1: 自动收集技术信息

### 测试场景 1.1: 手动添加技术内容

**步骤**:
1. 打开 Postman 或使用 curl
2. 调用 API 添加技术内容

```bash
curl -X POST http://localhost:3000/api/radar/content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "零信任架构在金融行业的应用",
    "summary": "介绍零信任架构的实施方案和成本收益分析",
    "fullContent": "零信任架构(Zero Trust Architecture)是一种现代化的网络安全模型...",
    "url": "https://example.com/zero-trust",
    "source": "金融科技周刊",
    "publishDate": "2024-01-15",
    "tags": ["零信任", "安全架构", "金融"]
  }'
```

**预期结果**:
- ✅ 返回 201 Created
- ✅ 返回创建的内容 ID
- ✅ 内容保存到 `raw_content` 表

**验证方法**:
```sql
-- 在数据库中查询
SELECT * FROM raw_content ORDER BY created_at DESC LIMIT 1;
```

### 测试场景 1.2: 文件导入功能

**步骤**:
1. 准备一个 CSV 文件 `tech_content.csv`:
```csv
title,summary,url,source,publishDate,tags
"容器化技术最新进展","介绍Docker和Kubernetes的最新特性","https://example.com/container","技术博客","2024-01-20","容器,云原生"
"微服务架构实践","金融行业微服务架构的实施经验","https://example.com/microservice","架构周刊","2024-01-18","微服务,架构"
```

2. 使用 Postman 上传文件:
   - Method: POST
   - URL: `http://localhost:3000/api/radar/content/import`
   - Headers: `Authorization: Bearer YOUR_TOKEN`
   - Body: form-data
     - Key: `file` (type: File)
     - Value: 选择 `tech_content.csv`

**预期结果**:
- ✅ 返回 200 OK
- ✅ 返回导入统计: `{ imported: 2, failed: 0 }`
- ✅ 数据库中新增 2 条记录

**验证方法**:
```sql
SELECT COUNT(*) FROM raw_content WHERE source IN ('技术博客', '架构周刊');
```

### 测试场景 1.3: 外部 RSS 订阅（如果已配置）

**步骤**:
1. 检查是否有 RSS 订阅配置
```bash
curl -X GET http://localhost:3000/api/radar/sources \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. 手动触发 RSS 抓取
```bash
curl -X POST http://localhost:3000/api/radar/crawler/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期结果**:
- ✅ 爬虫任务启动
- ✅ 日志显示抓取进度
- ✅ 新内容保存到数据库

---

## 🧪 Story 2.2: AI 智能分析相关性

### 测试场景 2.1: 自动触发 AI 分析

**前提**: 已有 raw_content 数据（从 Story 2.1 创建）

**步骤**:
1. 等待 BullMQ 队列自动处理（约 5-10 秒）
2. 或手动触发分析:
```bash
curl -X POST http://localhost:3000/api/radar/analyze/YOUR_CONTENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期结果**:
- ✅ AI 分析完成
- ✅ 生成 `analyzed_content` 记录
- ✅ 包含以下字段:
  - `relevanceScore`: 0-1 之间的相关性评分
  - `tags`: AI 提取的标签
  - `keywords`: 关键词列表
  - `categories`: 分类
  - `targetAudience`: 目标受众
  - `aiSummary`: AI 生成的摘要

**验证方法**:
```sql
SELECT
  ac.id,
  ac.relevance_score,
  ac.tags,
  ac.keywords,
  ac.ai_summary,
  rc.title
FROM analyzed_content ac
JOIN raw_content rc ON ac.content_id = rc.id
ORDER BY ac.analyzed_at DESC
LIMIT 5;
```

### 测试场景 2.2: 相关性评分准确性

**步骤**:
1. 查看分析结果
```bash
curl -X GET http://localhost:3000/api/radar/analyzed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期结果**:
- ✅ 与金融/IT相关的内容相关性评分 > 0.7
- ✅ 不相关内容评分 < 0.5
- ✅ 标签提取准确（如：零信任、容器化、微服务）

---

## 🧪 Story 2.3: 推送系统和调度

### 测试场景 3.1: 手动创建推送

**步骤**:
1. 获取已分析的内容 ID
```bash
curl -X GET http://localhost:3000/api/radar/analyzed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. 创建推送
```bash
curl -X POST http://localhost:3000/api/radar/pushes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "analyzedContentId": "YOUR_ANALYZED_CONTENT_ID",
    "radarType": "tech",
    "scheduledFor": "2024-01-28T10:00:00Z"
  }'
```

**预期结果**:
- ✅ 返回 201 Created
- ✅ 推送记录创建成功
- ✅ 状态为 `scheduled`

### 测试场景 3.2: 推送调度执行

**步骤**:
1. 等待调度时间到达（或修改 scheduledFor 为当前时间）
2. 检查推送状态
```bash
curl -X GET http://localhost:3000/api/radar/pushes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期结果**:
- ✅ 推送状态变为 `sent`
- ✅ `sentAt` 字段有值
- ✅ 包含 `priorityLevel` (1-3)

### 测试场景 3.3: WebSocket 实时推送

**步骤**:
1. 打开浏览器开发者工具 (F12)
2. 访问 `http://localhost:3001/radar/tech`
3. 在 Console 中监听 WebSocket 事件:
```javascript
// 应该能看到 WebSocket 连接日志
// Socket.io 连接成功
```

4. 在另一个终端创建新推送（使用上面的 API）

**预期结果**:
- ✅ 前端 Console 显示: `New tech radar push received: {...}`
- ✅ 页面自动显示新推送（无需刷新）
- ✅ 浏览器通知弹出（如果已授权）

---

## 🧪 Story 2.4: ROI 分析功能

### 测试场景 4.1: 自动触发 ROI 分析

**前提**: 已有推送数据（从 Story 2.3 创建）

**步骤**:
1. 推送发送时会自动触发 ROI 分析
2. 或手动触发:
```bash
curl -X POST http://localhost:3000/api/radar/roi/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "analyzedContentId": "YOUR_ANALYZED_CONTENT_ID",
    "weaknessCategory": "数据安全"
  }'
```

**预期结果**:
- ✅ ROI 分析完成
- ✅ `analyzed_content` 表的 `roi_analysis` 字段有值
- ✅ 包含以下字段:
  - `estimatedCost`: "50-100万"
  - `expectedBenefit`: "年节省200万运维成本"
  - `roiEstimate`: "ROI 2:1"
  - `implementationPeriod`: "3-6个月"
  - `recommendedVendors`: ["阿里云", "腾讯云"]

**验证方法**:
```sql
SELECT
  id,
  roi_analysis->>'estimatedCost' as cost,
  roi_analysis->>'expectedBenefit' as benefit,
  roi_analysis->>'roiEstimate' as roi,
  roi_analysis->>'implementationPeriod' as period
FROM analyzed_content
WHERE roi_analysis IS NOT NULL
ORDER BY analyzed_at DESC
LIMIT 5;
```

### 测试场景 4.2: Redis 缓存验证

**步骤**:
1. 第一次调用 ROI 分析（记录时间）
2. 第二次调用相同内容的 ROI 分析（记录时间）

**预期结果**:
- ✅ 第一次调用耗时较长（约 2-5 秒，调用 AI）
- ✅ 第二次调用耗时很短（< 100ms，从缓存读取）
- ✅ 两次返回结果一致

**验证方法**:
```bash
# 检查 Redis 缓存
redis-cli
> KEYS radar:roi:*
> GET radar:roi:org-xxx:content-xxx:数据安全
```

---

## 🧪 Story 2.5: 前端展示

### 测试场景 5.1: 技术雷达页面访问

**步骤**:
1. 打开浏览器访问 `http://localhost:3001`
2. 登录系统（使用测试账号）
3. 导航到技术雷达页面 `/radar/tech`

**预期结果**:
- ✅ 页面标题显示: "技术雷达 - ROI导向的技术决策支持"
- ✅ 副标题显示: "基于您的薄弱项和关注领域，为您推荐最具性价比的技术方案"
- ✅ 显示 WebSocket 连接状态: "✓ 实时推送已连接"
- ✅ 显示刷新按钮

### 测试场景 5.2: 推送卡片显示

**预期结果**:
- ✅ 显示推送卡片列表（Grid 布局）
- ✅ 每个卡片包含:
  - 优先级标识: 🥇优先级1 / 🥈优先级2 / 🥉优先级3
  - 相关性标注: 🔴 95% 相关（颜色根据评分变化）
  - 标题和摘要
  - 薄弱项标签: 🎯 数据安全
  - ROI 分析摘要区域（渐变背景）
  - "查看详情" 按钮

### 测试场景 5.3: ROI 分析展示

**步骤**:
1. 查看推送卡片中的 ROI 分析区域

**预期结果**:
- ✅ ROI 区域有渐变背景（蓝紫色）
- ✅ 显示 "💰 ROI分析" 标题
- ✅ 显示以下信息:
  - 预计投入: "50-100万"
  - 预期收益: "年节省200万运维成本"
  - ROI估算: "ROI 2:1" (绿色高亮)
  - 实施周期: "3-6个月"
  - 推荐供应商: 阿里云、腾讯云、华为云（Chip 标签）

### 测试场景 5.4: 详情弹窗

**步骤**:
1. 点击任意推送卡片的 "查看详情" 按钮

**预期结果**:
- ✅ 弹窗打开（Material-UI Dialog）
- ✅ 显示完整标题
- ✅ 显示来源和发布日期
- ✅ 显示薄弱项标签
- ✅ 显示文章全文
- ✅ 显示完整 ROI 分析:
  - 预计投入成本（带说明）
  - 预期收益（带说明）
  - ROI估算（大字体，绿色背景）
  - ROI 计算公式: "ROI = (预期收益 - 投入成本) / 投入成本"
  - 实施周期（带说明）
  - 推荐供应商（带说明）
- ✅ 显示操作按钮:
  - 收藏按钮
  - 分享按钮
  - 标记为已读按钮
  - 关闭按钮
- ✅ 显示 "查看原文" 链接

### 测试场景 5.5: 标记为已读功能

**步骤**:
1. 在详情弹窗中点击 "标记为已读" 按钮

**预期结果**:
- ✅ 按钮文字变为 "标记中..."（加载状态）
- ✅ 按钮变为禁用状态
- ✅ API 调用成功后，按钮文字变为 "已读"
- ✅ 按钮保持禁用状态
- ✅ 关闭弹窗后，卡片显示 "已读" 标识

**验证方法**:
```sql
SELECT id, title, is_read, read_at
FROM radar_push
WHERE is_read = true
ORDER BY read_at DESC;
```

### 测试场景 5.6: WebSocket 实时推送

**步骤**:
1. 保持技术雷达页面打开
2. 在另一个终端创建新推送:
```bash
curl -X POST http://localhost:3000/api/radar/pushes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "analyzedContentId": "YOUR_ANALYZED_CONTENT_ID",
    "radarType": "tech",
    "scheduledFor": "2024-01-28T10:00:00Z"
  }'
```

**预期结果**:
- ✅ 页面自动显示新推送（无需刷新）
- ✅ 新推送出现在列表顶部
- ✅ 浏览器弹出通知: "技术雷达新推送"
- ✅ 通知内容显示推送标题
- ✅ Console 显示: "New tech radar push received: {...}"

### 测试场景 5.7: 错误处理

**步骤 1**: 测试 API 失败
1. 停止后端服务
2. 刷新技术雷达页面

**预期结果**:
- ✅ 显示错误提示: "加载推送失败"
- ✅ 显示友好的错误消息
- ✅ 不会白屏或崩溃

**步骤 2**: 测试空列表
1. 清空所有推送数据
2. 刷新页面

**预期结果**:
- ✅ 显示空状态提示: "暂无推送内容"
- ✅ 显示说明文字: "系统会根据您的薄弱项和关注领域自动推送相关技术方案"

**步骤 3**: 测试 WebSocket 断开
1. 停止后端服务
2. 观察页面状态

**预期结果**:
- ✅ 显示: "⚠️ 实时推送连接中断，正在重新连接..."
- ✅ 重启后端后自动重连
- ✅ 重连成功后显示: "✓ 实时推送已连接"

### 测试场景 5.8: 响应式布局

**步骤**:
1. 调整浏览器窗口大小
2. 测试不同屏幕尺寸:
   - 桌面端 (> 1200px)
   - 平板端 (768px - 1200px)
   - 手机端 (< 768px)

**预期结果**:
- ✅ 桌面端: 3 列卡片布局
- ✅ 平板端: 2 列卡片布局
- ✅ 手机端: 1 列卡片布局
- ✅ 所有元素正确对齐，无溢出
- ✅ 详情弹窗在小屏幕上全屏显示

### 测试场景 5.9: 性能测试

**步骤**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 刷新技术雷达页面
4. 记录加载时间

**预期结果**:
- ✅ 页面加载时间 < 2 秒
- ✅ API 响应时间 < 500ms
- ✅ WebSocket 连接延迟 < 1 秒
- ✅ 详情弹窗打开速度 < 500ms
- ✅ 滚动流畅，无卡顿

---

## 📊 测试结果记录表

### Story 2.1: 自动收集技术信息
| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 1.1 手动添加内容 | ☐ 通过 ☐ 失败 | |
| 1.2 文件导入 | ☐ 通过 ☐ 失败 | |
| 1.3 RSS 订阅 | ☐ 通过 ☐ 失败 ☐ 跳过 | |

### Story 2.2: AI 智能分析
| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 2.1 自动触发分析 | ☐ 通过 ☐ 失败 | |
| 2.2 相关性评分 | ☐ 通过 ☐ 失败 | |

### Story 2.3: 推送系统
| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 3.1 手动创建推送 | ☐ 通过 ☐ 失败 | |
| 3.2 推送调度 | ☐ 通过 ☐ 失败 | |
| 3.3 WebSocket 推送 | ☐ 通过 ☐ 失败 | |

### Story 2.4: ROI 分析
| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 4.1 自动触发 ROI | ☐ 通过 ☐ 失败 | |
| 4.2 Redis 缓存 | ☐ 通过 ☐ 失败 | |

### Story 2.5: 前端展示
| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 5.1 页面访问 | ☐ 通过 ☐ 失败 | |
| 5.2 推送卡片 | ☐ 通过 ☐ 失败 | |
| 5.3 ROI 展示 | ☐ 通过 ☐ 失败 | |
| 5.4 详情弹窗 | ☐ 通过 ☐ 失败 | |
| 5.5 标记已读 | ☐ 通过 ☐ 失败 | |
| 5.6 实时推送 | ☐ 通过 ☐ 失败 | |
| 5.7 错误处理 | ☐ 通过 ☐ 失败 | |
| 5.8 响应式布局 | ☐ 通过 ☐ 失败 | |
| 5.9 性能测试 | ☐ 通过 ☐ 失败 | |

---

## 🐛 问题记录

如果发现问题，请记录在此：

| 问题编号 | 测试场景 | 问题描述 | 严重程度 | 状态 |
|---------|---------|---------|---------|------|
| 1 | | | ☐ 严重 ☐ 中等 ☐ 轻微 | ☐ 待修复 ☐ 已修复 |
| 2 | | | ☐ 严重 ☐ 中等 ☐ 轻微 | ☐ 待修复 ☐ 已修复 |
| 3 | | | ☐ 严重 ☐ 中等 ☐ 轻微 | ☐ 待修复 ☐ 已修复 |

---

## ✅ 测试完成检查清单

- ☐ 所有 5 个 Stories 的测试场景已执行
- ☐ 所有严重问题已修复
- ☐ 测试结果已记录
- ☐ 截图已保存（如有需要）
- ☐ 性能指标符合要求
- ☐ 用户体验良好

---

## 📸 建议截图位置

1. 技术雷达页面全貌
2. 推送卡片详细展示（包含 ROI 分析）
3. 详情弹窗完整内容
4. WebSocket 实时推送效果
5. 浏览器通知效果
6. 响应式布局（桌面/平板/手机）

---

**测试完成签名**: _________
**测试日期**: _________
**总体评价**: ☐ 优秀 ☐ 良好 ☐ 需改进
