# 合规雷达 Playbook API 文档

**版本**: 1.0.0
**最后更新**: 2026-01-30
**Epic**: Epic 4 - 合规雷达
**Story**: Story 4.2 - 合规风险分析与应对剧本生成

---

## 概述

合规雷达Playbook API提供应对剧本的创建、查询和自查清单提交功能。

### 基础路径
```
/api/radar/compliance
```

### 认证
所有API端点需要JWT认证和Organization Guard（多租户隔离）。

---

## API 端点

### 1. 获取应对剧本

获取指定推送的合规应对剧本。

**端点**: `GET /api/radar/compliance/playbooks/:pushId`

**路径参数**:
- `pushId` (string, required): 推送ID (UUID v4)

**认证**: required (JWT + Organization Guard)

**响应状态码**:
- `200 OK`: 剧本获取成功
- `202 Accepted`: 剧本正在生成中
- `404 Not Found`: 剧本不存在
- `403 Forbidden`: 跨租户访问
- `500 Internal Server Error`: 服务器错误

**响应示例** (200 OK):
```json
{
  "id": "uuid-v4",
  "pushId": "uuid-v4",
  "checklistItems": [
    {
      "id": "uuid-v4",
      "text": "检查数据备份策略是否符合监管要求",
      "category": "数据安全",
      "checked": false,
      "order": 1
    },
    {
      "id": "uuid-v4",
      "text": "验证访问控制机制是否有效",
      "category": "访问控制",
      "checked": false,
      "order": 2
    }
  ],
  "solutions": [
    {
      "name": "升级数据备份系统",
      "estimatedCost": 50000,
      "expectedBenefit": 200000,
      "roiScore": 9,
      "implementationTime": "2个月"
    }
  ],
  "reportTemplate": "关于XX监管要求的自查报告...",
  "policyReference": [
    "https://www.cbrc.gov.cn/xxxx",
    "https://www.pbc.gov.cn/xxxx"
  ],
  "createdAt": "2026-01-30T10:00:00Z",
  "generatedAt": "2026-01-30T10:05:00Z"
}
```

**响应示例** (202 Accepted):
```json
{
  "statusCode": 202,
  "message": "Playbook is being generated",
  "pushId": "uuid-v4",
  "status": "generating"
}
```

---

### 2. 提交自查清单

用户提交已完成的自查清单。

**端点**: `POST /api/radar/compliance/playbooks/:pushId/checklist`

**路径参数**:
- `pushId` (string, required): 推送ID (UUID v4)

**请求头**:
- `Authorization`: `Bearer {jwt_token}`

**请求体**:
```json
{
  "checkedItems": ["uuid-v4-1", "uuid-v4-2"],
  "uncheckedItems": ["uuid-v4-3", "uuid-v4-4"]
}
```

**验证规则**:
- `checkedItems`: 非空数组，至少1项
- `uncheckedItems`: 数组
- 数据完整性: `checkedItems.length + uncheckedItems.length === playbook.checklistItems.length`

**认证**: required (JWT + Organization Guard)

**响应状态码**:
- `201 Created`: 提交成功
- `400 Bad Request`: 数据验证失败（数量不匹配、全部未勾选）
- `404 Not Found`: 剧本不存在
- `403 Forbidden`: 跨租户访问
- `409 Conflict`: 重复提交（返回现有提交）
- `500 Internal Server Error`: 服务器错误

**响应示例** (201 Created):
```json
{
  "id": "uuid-v4",
  "pushId": "uuid-v4",
  "userId": "uuid-v4",
  "checkedItems": ["uuid-v4-1", "uuid-v4-2"],
  "uncheckedItems": ["uuid-v4-3", "uuid-v4-4"],
  "submittedAt": "2026-01-30T11:00:00Z",
  "updatedAt": null
}
```

**响应示例** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": "Invalid submission: expected 4 items, got 3",
  "error": "Bad Request"
}
```

**幂等性**:
- 重复提交时更新现有记录（updatedAt字段更新）
- 返回更新后的提交记录

---

## WebSocket 事件

### radar:push:new

合规雷达推送通知事件，包含剧本状态信息。

**事件数据结构**:
```json
{
  "pushId": "uuid-v4",
  "radarType": "compliance",
  "title": "XX监管处罚通报",
  "summary": "XX银行因XX问题被处罚...",
  "relevanceScore": 0.95,
  "priorityLevel": "high",
  "sentAt": "2026-01-30T10:00:00Z",
  "hasPlaybook": true,
  "playbookStatus": "ready",
  "playbookApiUrl": "/api/radar/compliance/playbooks/{pushId}",
  "complianceRiskCategory": "数据安全"
}
```

**字段说明**:
- `hasPlaybook`: 是否有可用剧本
- `playbookStatus`: `ready`(可用) | `generating`(生成中) | `failed`(生成失败)
- `playbookApiUrl`: 获取剧本的API端点
- `complianceRiskCategory`: 风险类别（从checklistItems[0].category提取）

---

## 错误处理

### 标准错误响应格式

```json
{
  "statusCode": 400,
  "message": "错误描述",
  "error": "Bad Request",
  "timestamp": "2026-01-30T10:00:00Z",
  "path": "/api/radar/compliance/playbooks/xxx"
}
```

### 常见错误场景

| 场景 | 状态码 | 说明 |
|------|--------|------|
| 剧本正在生成 | 202 | 用户访问太早，剧本仍在生成 |
| 剧本不存在 | 404 | pushId不存在或剧本未生成 |
| 跨租户访问 | 403 | 用户尝试访问其他组织的剧本 |
| 数据不完整 | 400 | checklist提交数量不匹配 |
| 全部未勾选 | 400 | 至少需要勾选1项 |
| AI生成失败 | 500 | 剧本生成失败，状态标记为failed |

---

## 数据模型

### CompliancePlaybook

```typescript
{
  id: string;                          // UUID v4
  pushId: string;                      // 推送ID
  checklistItems: Array<{
    id: string;                        // UUID v4
    text: string;                      // 检查项文本
    category: string;                  // 类别（如"数据安全"）
    checked: boolean;                  // 是否已勾选
    order: number;                     // 显示顺序
  }>;
  solutions: Array<{
    name: string;                      // 整改方案名称
    estimatedCost: number;             // 预计成本（元）
    expectedBenefit: number;           // 预期收益（避免罚款，元）
    roiScore: number;                  // ROI评分（0-10）
    implementationTime: string;        // 实施周期
  }>;
  reportTemplate: string;              // 汇报模板文本
  policyReference: string[];           // 政策参考链接
  createdAt: Date;                     // 记录创建时间
  generatedAt: Date;                   // AI生成时间
}
```

### ComplianceChecklistSubmission

```typescript
{
  id: string;                          // UUID v4
  pushId: string;                      // 推送ID
  userId: string;                      // 用户ID
  checkedItems: string[];              // 已勾选项ID列表
  uncheckedItems: string[];            // 未勾选项ID列表
  submittedAt: Date;                   // 首次提交时间
  updatedAt: Date | null;              // 最后更新时间
}
```

### RadarPush (扩展字段)

```typescript
{
  // ... 原有字段 ...

  // 合规雷达特定字段
  checklistCompletedAt: Date | null;   // 自查清单完成时间
  playbookStatus: 'ready' | 'generating' | 'failed';  // 剧本状态
}
```

---

## 性能要求

### 响应时间 (P95)
- `GET /playbooks/:pushId`: < 200ms
- `POST /playbooks/:pushId/checklist`: < 300ms

### 可用性
- API成功率: ≥ 98%
- 剧本生成成功率: ≥ 95%
- 缓存命中率: ≥ 80%

### 并发
- 支持50个并发用户（Growth阶段）

---

## 安全考虑

### 多租户隔离 (AR12)

**Layer 1 (API层)**:
- `@UseGuards(OrganizationGuard)` 验证JWT和租户权限

**Layer 2 (Service层)**:
- 验证push.organizationId匹配用户organizationId

**Layer 3 (数据库层)**:
- 外键约束: `compliance_playbooks.push_id → radar_pushes.id`
- PostgreSQL RLS (Row Level Security) 策略

**Layer 4 (审计层)**:
- 记录所有playbook查看事件 (userId, pushId, timestamp)
- 记录所有checklist提交事件 (userId, checkedItems, timestamp)
- 日志保留1年，不可篡改

### 数据验证
- 所有输入使用class-validator装饰器验证
- 数据完整性约束（checklist item数量）
- SQL注入防护（TypeORM参数化查询）

---

## 测试

### 单元测试
- `compliance-playbook.service.spec.ts`: Service层逻辑
- `compliance-playbook.controller.spec.ts`: Controller层端点
- `submit-checklist.dto.spec.ts`: DTO验证

### 集成测试
- `compliance-playbook.integration.spec.ts`: 端到端流程

### E2E测试
- `compliance-playbook.e2e.spec.ts`: 完整用户场景
- `compliance-radar.full-workflow.e2e.spec.ts`: 从爬取到推送全流程

---

## 依赖服务

### 内部服务
- `AiAnalysisService`: 生成剧本内容
- `RadarPushService`: 推送管理
- `RedisService`: 缓存剧本（7天TTL）

### 外部服务
- **通义千问 API**: AI剧本生成
- **Redis**: 缓存存储

---

## 限制和约束

### 推送频率限制
- 每个组织最多3条/天
- 第4条降级到次日9:00推送

### 剧本缓存
- Redis缓存TTL: 7天
- 缓存键: `radar:compliance:playbook:{rawContentId}`

### AI成本控制
- 单个剧本生成成本: < ¥5
- 单客户月均成本: < ¥150

---

## 版本历史

### v1.0.0 (2026-01-30)
- 初始版本
- 实现剧本获取API
- 实现自查清单提交API
- WebSocket事件支持

---

## 相关文档

- [Story 4.2 完整需求](../../_bmad-output/sprint-artifacts/4-2-compliance-risk-analysis-and-playbook-generation.md)
- [数据库迁移脚本](../src/database/migrations/1738210000000-CreateCompliancePlaybookTables.ts)
- [代码审查报告](../../STORY_4.2_CODE_REVIEW_REPORT.md)

---

**维护者**: Development Team
**联系方式**: 通过项目Issue跟踪
