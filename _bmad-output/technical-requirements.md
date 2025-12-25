# 技术需求与架构决策

> **关联文档**: [产品需求文档 (PRD)](./prd.md)
> **版本**: v1.0
> **最后更新**: 2025-12-23

本文档定义 Csaas 平台的技术实现细节,包括 SaaS B2B 特定需求和关键架构决策。

---

## 目录

1. [多租户架构](#1-多租户架构)
2. [权限与角色模型](#2-权限与角色模型-rbac)
3. [订阅与定价模型](#3-订阅与定价模型)
4. [第三方集成](#4-第三方集成)
5. [合规与数据保护](#5-合规与数据保护)
6. [架构决策记录 (ADR)](#架构决策记录adr)
7. [关键架构修改汇总](#关键架构修改汇总)

---

## SaaS B2B 技术需求

### 1. 多租户架构

#### DEMO 阶段：单租户模式
- **实现方式**：单一客户部署，所有数据属于同一组织
- **目标**：快速验证核心功能，无需复杂的租户隔离
- **技术栈**：PostgreSQL 单数据库，无租户ID字段

#### Growth 阶段：共享数据库 + 租户ID隔离

**租户层级结构：**
```
平台（系统级）
  └─ 咨询公司（租户级，tenant_id）
      └─ 咨询师（子账号，user_id + tenant_id）
          └─ 项目（project_id + tenant_id）
```

**数据隔离策略：4层防御架构**

1. **第一层：API Gateway 层**
   - 从JWT token提取 `tenant_id`
   - 注入到请求上下文 `req.context.tenantId`
   - 拒绝无租户ID的请求

2. **第二层：应用层（ORM中间件）**
   - 所有数据库查询自动注入 `WHERE tenant_id = ?`
   - 防止开发者忘记添加租户过滤条件
   - TypeScript/Prisma 示例见下文

3. **第三层：数据库连接层**
   - 使用 PostgreSQL 的 `SET app.tenant_id = ?`
   - 为每个连接设置会话变量

4. **第四层：数据库行级安全（RLS）**
   - PostgreSQL Row-Level Security 作为终极防御
   - 即使应用层被绕过，数据库层仍隔离
   - RLS 策略示例见 [ADR #3](#adr-3-数据隔离实施细节---4层防御架构)

**核心表设计：**
```sql
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50), -- 'free' | 'professional' | 'enterprise'
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'suspended' | 'deleted'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'platform_admin' | 'main_consultant' | 'enterprise_pm' | 'respondent'
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(user_id),
  title VARCHAR(500) NOT NULL,
  standard_id UUID NOT NULL, -- ISO 27001, ITIL 4, etc.
  status VARCHAR(50) DEFAULT 'draft', -- 'draft' | 'in_progress' | 'completed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id, created_at);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

---

### 2. 权限与角色模型（RBAC）

#### 四个核心角色

| 角色 | 权限范围 | 典型操作 |
|------|---------|---------|
| **平台管理员** | 跨租户全局视图 | 审核专家优化版、监控AI质量、配置标准库 |
| **主咨询师** | 本人创建的项目 | 创建项目、审核AI生成内容、查看自己的项目报告 |
| **企业项目经理** | 被授权的项目 | 查看聚类结果、下载报告、无法看到个人问卷答案 |
| **被调研者** | 仅填写问卷 | 填写问卷、查看自己的答案 |

#### 权限矩阵

| 资源 | 平台管理员 | 主咨询师 | 企业PM | 被调研者 |
|------|-----------|---------|--------|---------|
| 查看所有租户项目 | ✅ | ❌ | ❌ | ❌ |
| 查看其他咨询师项目 | ✅ | ❌ | ❌ | ❌ |
| 创建新项目 | ✅ | ✅ | ❌ | ❌ |
| 审核AI生成内容 | ✅ | ✅（仅自己项目） | ❌ | ❌ |
| 查看聚类结果 | ✅ | ✅（仅自己项目） | ✅（被授权项目） | ❌ |
| 查看个人问卷答案 | ✅ | ✅（仅自己项目） | ❌ | ✅（仅自己答案） |
| 下载差距分析报告 | ✅ | ✅（仅自己项目） | ✅（被授权项目） | ❌ |
| 授权专家优化版使用 | ✅ | ❌ | ❌ | ❌ |
| 配置AI模型参数 | ✅ | ❌ | ❌ | ❌ |

#### 关键隔离规则

1. **主咨询师之间隔离**
   - 李咨询师无法查看王咨询师的项目
   - 即使在同一租户（咨询公司）内
   - 实现方式：`WHERE owner_user_id = current_user_id`

2. **企业PM访问控制**
   - 只能查看被明确授权的项目
   - 无法看到问卷中的个人姓名和答案明细
   - 只能看到聚类后的匿名化结果

3. **专家优化版权限**
   - 咨询师可查看所有专家优化版
   - 但"使用"需要平台管理员授权
   - 防止未经验证的优化版扩散

---

### 3. 订阅与定价模型

#### DEMO 阶段：跳过订阅功能
- **原因**：聚焦核心功能验证，避免复杂的支付和订阅管理
- **用户管理**：手动创建测试账号
- **限制**：无需硬性限制项目数或AI调用次数

#### Growth 阶段：订阅分层（规划）

| 套餐 | 月费 | 项目数 | 咨询师数 | 核心差异 |
|------|------|--------|---------|---------|
| **免费试用** | ¥0 | 1个 | 1人 | 体验完整流程，无专家优化版 |
| **专业版** | ¥2,999 | 10个 | 3人 | 访问专家优化版，优先AI调用 |
| **企业版** | ¥9,999 | 无限 | 无限 | 专属客服，定制标准库，SLA保障 |

**计费触发点：**
- 按月订阅（非按使用量）
- 超出项目数后无法创建新项目（提示升级）
- 不限制AI调用次数（质量优先，成本可控）

---

### 4. 第三方集成

#### DEMO 阶段：最小化集成

**必须集成：**
1. **大模型API**
   - GPT-4（OpenAI）
   - Claude 3.5 Sonnet（Anthropic）
   - GLM-4（智谱AI）或其他国产模型
   - 集成方式：REST API，异步调用

2. **邮件服务**
   - 用途：发送问卷链接、通知主咨询师审核
   - 服务商：SendGrid / 阿里云邮件推送
   - 模板：问卷邮请邮件、报告生成通知

**暂不集成（留到 Growth 阶段）：**
- ❌ 企业SSO（如SAML、OAuth）
- ❌ 项目管理工具（如Jira、Monday）
- ❌ 文档存储（如S3、OSS）- DEMO用本地文件系统
- ❌ 数据分析（如Metabase、Looker）

#### Growth 阶段：企业级集成（规划）

**身份认证：**
- 支持企业SSO（SAML 2.0）
- Azure AD、Okta集成

**数据导出：**
- Excel批量导出（聚类结果、评分矩阵）
- API接口供第三方系统调用

**Webhook：**
- 项目状态变更通知
- AI审核完成事件

---

### 5. 合规与数据保护

#### DEMO 阶段：基础安全

**必须实现：**
1. **HTTPS 加密**
   - 所有API通信使用TLS 1.3
   - 前后端通信加密

2. **访问日志**
   - 记录所有数据访问操作
   - 格式：`{user_id, action, resource_id, timestamp, ip_address}`
   - 用途：审计、异常检测

3. **密码安全**
   - bcrypt哈希存储（cost factor = 12）
   - 强制密码复杂度（至少8位，含大小写+数字）

**暂不实现（留到 Growth 阶段）：**
- ❌ SOC 2认证
- ❌ 数据加密存储（Database Encryption at Rest）
- ❌ GDPR完整合规（如被遗忘权自动化）
- ❌ 渗透测试

#### Growth 阶段：企业级合规（规划）

**数据主权：**
- 支持选择数据中心地域（中国大陆 vs 海外）
- 敏感数据不出境

**数据保留策略：**
- 项目删除后数据保留30天（可恢复）
- 30天后永久删除
- 审计日志保留1年

**安全认证：**
- 通过等保三级认证
- 可选：ISO 27001认证（企业版客户要求）

---

## 架构决策记录（ADR）

为确保技术方案的可靠性和可维护性，我们在SaaS B2B技术需求定义阶段进行了架构评审，以下是关键架构决策：

### ADR #1: 多租户架构选择 - 共享数据库 vs 独立数据库

**决策时间**：PRD创建阶段（2025-12-23）

**背景**：
系统需要支持多个咨询公司（租户）同时使用，需要在数据隔离、成本、复杂度之间权衡。

**评审参与者**：
- 张架构师（云原生专家）：主张混合模式
- 王架构师（安全专家）：强调数据隔离
- 李架构师（成本优化）：支持共享数据库
- 赵架构师（AI系统）：关注事件溯源

**方案对比**：

| 维度 | 独立数据库（DB-per-Tenant） | 共享数据库（Shared DB + Tenant ID） |
|------|---------------------------|-----------------------------------|
| **数据隔离** | 物理隔离，天然安全 ✅ | 逻辑隔离，需多层防御 ⚠️ |
| **成本** | 10租户≈$800/月（RDS实例费） ❌ | 10租户≈$150/月（单实例） ✅ |
| **复杂度** | 需要动态路由，备份复杂 ❌ | 统一管理，简单 ✅ |
| **扩展性** | 租户多时管理困难 ❌ | 水平扩展方便 ✅ |
| **事件溯源** | 跨库查询困难 ❌ | 全局事件流 ✅ |

**决策结果**：✅ **采用共享数据库 + 租户ID隔离 + 4层防御架构**

**理由**：
1. **成本优势明显**：DEMO和早期阶段租户数有限（<50），共享DB成本仅为独立DB的20%
2. **技术可靠性充分**：4层防御（API Gateway → 应用层 → 连接层 → RLS）提供足够隔离
3. **扩展性更好**：未来可按需切换到混合模式（高价值客户用独立DB）
4. **符合阶段目标**：DEMO聚焦功能验证，不应在基础设施上过度投入

**风险缓解**：
- 必须实现PostgreSQL Row-Level Security（RLS）作为终极防线
- 编写自动化测试验证租户隔离（尝试跨租户访问必须失败）
- 在ORM中间件层强制tenant_id过滤，防止开发者遗漏

**实施要点**：
```sql
-- 启用行级安全
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 创建租户隔离函数
CREATE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT current_setting('app.tenant_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- 创建隔离策略
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_tenant_id());
```

---

### ADR #2: 三模型并行调用架构 - 同步 vs 异步 vs 渐进式

**决策时间**：PRD创建阶段（2025-12-23）

**背景**：
核心创新是"三模型独立验证"，需要同时调用GPT-4、Claude、国产模型，每次调用耗时15-25秒，如何优化用户体验？

**方案对比**：

| 方案 | 用户等待时间 | 实现复杂度 | 失败处理 |
|------|------------|-----------|---------|
| **同步串行** | 45-75秒 ❌ | 简单 ✅ | 简单（直接报错） |
| **完全异步** | 0秒（后台运行） ✅ | 复杂（需队列+通知） ❌ | 复杂（需状态机） |
| **渐进式返回** | 15-25秒（首个结果）⚡ | 中等 ⚠️ | 优雅降级 ✅ |

**赵架构师提议**：渐进式结果返回
```
用户点击"生成聚类"
  ↓
立即返回 loading 状态 + WebSocket连接
  ↓
GPT-4先返回（18秒） → 立即显示结果1 + "2个模型生成中..."
  ↓
Claude返回（23秒） → 更新显示"2/3完成，计算相似度..."
  ↓
国产模型返回（30秒） → 完整相似度分析，最终结果
```

**决策结果**：✅ **采用渐进式返回 + 超时降级策略**

**理由**：
1. **用户体验最佳**：15-25秒看到首个结果，显著优于45秒完全等待
2. **容错性强**：单个模型超时不影响整体流程
3. **实现可行**：WebSocket成熟技术栈，复杂度可控

**超时与降级策略**：

| 场景 | 超时设定 | 降级策略 | 用户提示 |
|------|---------|---------|---------|
| **单模型超时** | 60秒 | 继续等待其他2个模型 | "GPT-4响应较慢，已使用Claude和国产模型结果" |
| **2个模型成功** | 总计120秒 | 采用双模型结果，提高阈值到90% | "三模型验证降级为双模型（置信度要求提高）" |
| **仅1个模型成功** | - | 标记为"初稿"，要求人工审核 | "AI生成结果不足，请仔细审核" |
| **全部失败** | - | 提示用户稍后重试 | "AI服务暂时不可用，请5分钟后重试" |

**实施技术栈**：
- **消息队列**：Redis + Bull（Node.js任务队列）
- **实时通信**：Socket.io（WebSocket）
- **状态管理**：PostgreSQL事件表（见下文事件溯源）

**示例流程代码**：
```typescript
async function generateClustering(projectId: string, socket: Socket) {
  const jobId = uuidv4();

  // 并行触发3个模型调用
  const jobs = [
    aiQueue.add('gpt4', { projectId, jobId }),
    aiQueue.add('claude', { projectId, jobId }),
    aiQueue.add('glm4', { projectId, jobId })
  ];

  // 监听每个模型返回
  jobs.forEach((job, index) => {
    job.finished().then(result => {
      socket.emit('model_result', {
        model: ['gpt4', 'claude', 'glm4'][index],
        result: result,
        progress: `${index + 1}/3`
      });

      // 每次有新结果，尝试计算相似度
      attemptSimilarityCalculation(projectId);
    }).catch(err => {
      socket.emit('model_timeout', {
        model: ['gpt4', 'claude', 'glm4'][index],
        fallback: 'degraded_mode'
      });
    });
  });

  // 120秒总超时
  setTimeout(() => {
    checkFinalStatus(projectId, socket);
  }, 120000);
}
```

---

### ADR #3: 数据隔离实施细节 - 4层防御架构

**决策时间**：PRD创建阶段（2025-12-23）

**背景**：
采用共享数据库后，必须确保租户数据绝对隔离，防止数据泄露（如租户A的咨询师看到租户B的项目）。

**王架构师（安全专家）强调**：
> "共享数据库不是不安全，关键是要有纵深防御（Defense in Depth）。单靠一层ORM过滤是不够的，必须在每一层都加防御。"

**4层防御架构**：

```
┌─────────────────────────────────────────────────────────┐
│ 第1层：API Gateway（JWT验证 + tenantId提取）             │
│  - 从JWT token提取 tenantId                              │
│  - 注入到 req.context.tenantId                           │
│  - 无tenantId请求直接拒绝（401 Unauthorized）             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第2层：应用层（ORM中间件自动注入）                        │
│  - Prisma/TypeORM中间件拦截所有查询                       │
│  - 自动添加 WHERE tenant_id = ?                          │
│  - 防止开发者遗漏租户过滤                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第3层：数据库连接层（会话变量）                           │
│  - 每个连接执行 SET app.tenant_id = ?                    │
│  - 为RLS策略提供上下文                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第4层：数据库行级安全（PostgreSQL RLS）                   │
│  - 即使前3层被绕过，数据库层仍隔离                         │
│  - CREATE POLICY tenant_isolation                         │
│  - 物理层的最后防线                                       │
└─────────────────────────────────────────────────────────┘
```

**决策结果**：✅ **实施完整4层防御，任何一层失效不导致数据泄露**

**第2层实施：ORM中间件（TypeScript + Prisma）**

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// 租户隔离中间件
export const tenantMiddleware: Prisma.Middleware = async (params, next) => {
  const tenantId = getCurrentTenantId(); // 从请求上下文获取

  if (!tenantId) {
    throw new Error('Tenant ID not found in request context');
  }

  // 拦截所有需要租户隔离的模型
  const modelsNeedIsolation = ['Project', 'AIArtifact', 'Questionnaire', 'ClusteringResult'];

  if (modelsNeedIsolation.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      // 自动注入租户过滤
      params.args.where = {
        ...params.args.where,
        tenantId: tenantId,
      };
    } else if (params.action === 'create' || params.action === 'update') {
      // 强制设置租户ID
      params.args.data = {
        ...params.args.data,
        tenantId: tenantId,
      };
    } else if (params.action === 'delete' || params.action === 'deleteMany') {
      // 只能删除自己租户的数据
      params.args.where = {
        ...params.args.where,
        tenantId: tenantId,
      };
    }
  }

  return next(params);
};

prisma.$use(tenantMiddleware);

// 获取当前租户ID（从AsyncLocalStorage或请求上下文）
function getCurrentTenantId(): string {
  // 实现方式：使用 Node.js AsyncLocalStorage 存储请求级别的上下文
  const store = requestContext.getStore();
  return store?.tenantId;
}
```

**第4层实施：PostgreSQL RLS**

```sql
-- 为所有多租户表启用RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE clustering_results ENABLE ROW LEVEL SECURITY;

-- 创建租户隔离策略（SELECT）
CREATE POLICY tenant_isolation_select ON projects
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- 创建租户隔离策略（INSERT）
CREATE POLICY tenant_isolation_insert ON projects
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- 创建租户隔离策略（UPDATE）
CREATE POLICY tenant_isolation_update ON projects
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- 创建租户隔离策略（DELETE）
CREATE POLICY tenant_isolation_delete ON projects
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- 为其他表创建相同策略（可用DO循环批量创建）
```

**风险缓解：自动化测试**

```typescript
describe('Tenant Isolation Security Tests', () => {
  it('应该阻止跨租户数据访问', async () => {
    // 创建两个租户的项目
    const tenant1Project = await createProject({ tenantId: 'tenant-1' });
    const tenant2Project = await createProject({ tenantId: 'tenant-2' });

    // 模拟租户1的请求上下文
    setCurrentTenant('tenant-1');

    // 尝试查询所有项目
    const projects = await prisma.project.findMany();

    // 断言：只能看到租户1的项目
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(tenant1Project.id);

    // 尝试直接通过ID访问租户2的项目（绕过ORM）
    const crossTenantAccess = await prisma.$queryRaw`
      SELECT * FROM projects WHERE project_id = ${tenant2Project.id}
    `;

    // 断言：RLS策略阻止访问
    expect(crossTenantAccess).toHaveLength(0);
  });

  it('应该阻止通过UPDATE修改其他租户数据', async () => {
    const tenant2Project = await createProject({ tenantId: 'tenant-2' });

    setCurrentTenant('tenant-1');

    // 尝试更新租户2的项目
    await expect(
      prisma.project.update({
        where: { id: tenant2Project.id },
        data: { title: 'Hacked!' }
      })
    ).rejects.toThrow(); // ORM中间件应阻止
  });
});
```

---

### ADR #4: AI生成过程的事件溯源架构

**决策时间**：PRD创建阶段（2025-12-23）

**背景**：
三模型独立验证需要记录每个模型的完整生成过程，用于：
1. 质量审计（为什么三模型达成共识？）
2. 问题排查（为什么这次生成失败？）
3. 成本追踪（每个项目消耗多少tokens？）
4. 模型性能对比（GPT-4 vs Claude，谁更准确？）

**赵架构师（AI系统专家）提议**：
> "不要只存最终结果，要存整个事件流。这样我们可以回放任何一次AI调用的完整过程。"

**决策结果**：✅ **采用事件溯源（Event Sourcing）模式存储AI生成过程**

**事件表设计**：

```sql
CREATE TABLE ai_generation_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(project_id),
  tenant_id UUID NOT NULL, -- 用于租户隔离

  -- 事件基本信息
  event_type VARCHAR(50) NOT NULL,
    -- 'model_invoked' | 'result_generated' | 'similarity_calculated'
    -- | 'consensus_reached' | 'degraded_to_draft' | 'human_reviewed'

  -- 模型信息
  model_name VARCHAR(50),  -- 'gpt-4' | 'claude-3.5-sonnet' | 'glm-4'
  model_version VARCHAR(50), -- 'gpt-4-0125-preview'

  -- 输入输出
  input_hash VARCHAR(64), -- SHA256(input_text)，用于去重和对比
  input_summary TEXT, -- 输入摘要（前500字符）
  output JSONB, -- 完整JSON结果

  -- 性能指标
  metadata JSONB,
    -- {
    --   "confidence": 0.95,
    --   "tokens_used": 1200,
    --   "latency_ms": 18500,
    --   "similarity_scores": {"gpt4_vs_claude": 0.87, ...},
    --   "error": "timeout after 60s"
    -- }

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_events_project ON ai_generation_events(project_id, created_at);
CREATE INDEX idx_events_tenant ON ai_generation_events(tenant_id, created_at);
CREATE INDEX idx_events_type ON ai_generation_events(event_type, created_at);
```

**事件流示例**：

用户触发"生成聚类"操作 → 系统记录以下事件序列：

```json
[
  {
    "event_type": "model_invoked",
    "model_name": "gpt-4",
    "input_hash": "a3f2...",
    "metadata": {"stage": "clustering", "retry_count": 0},
    "created_at": "2025-12-23T10:00:00Z"
  },
  {
    "event_type": "result_generated",
    "model_name": "gpt-4",
    "output": {"clusters": [...]},
    "metadata": {"tokens_used": 1200, "latency_ms": 18500},
    "created_at": "2025-12-23T10:00:18Z"
  },
  {
    "event_type": "model_invoked",
    "model_name": "claude-3.5-sonnet",
    "input_hash": "a3f2...",
    "created_at": "2025-12-23T10:00:00Z"
  },
  {
    "event_type": "result_generated",
    "model_name": "claude-3.5-sonnet",
    "output": {"clusters": [...]},
    "metadata": {"tokens_used": 1100, "latency_ms": 23000},
    "created_at": "2025-12-23T10:00:23Z"
  },
  {
    "event_type": "similarity_calculated",
    "metadata": {
      "pair": "gpt4_vs_claude",
      "structural_similarity": 0.92,
      "semantic_similarity": 0.85,
      "overall_similarity": 0.88
    },
    "created_at": "2025-12-23T10:00:25Z"
  },
  {
    "event_type": "consensus_reached",
    "metadata": {
      "average_similarity": 0.87,
      "threshold": 0.80,
      "decision": "adopt_gpt4_result",
      "reason": "highest_votes"
    },
    "created_at": "2025-12-23T10:00:30Z"
  },
  {
    "event_type": "human_reviewed",
    "metadata": {
      "reviewer_id": "user-123",
      "action": "approved",
      "modifications": "adjusted 2 clusters"
    },
    "created_at": "2025-12-23T10:15:00Z"
  }
]
```

**核心优势**：

1. **完整可追溯**：任何时候都能回放某个项目的AI生成历史
2. **质量审计**：平台管理员可分析"为什么三模型都错了"
3. **成本透明**：精确统计每个项目/租户的API消耗
4. **性能优化**：对比不同模型的latency和质量，动态调整

**查询示例**：

```sql
-- 查询某个项目的AI调用总成本
SELECT
  SUM((metadata->>'tokens_used')::INT) as total_tokens,
  COUNT(*) FILTER (WHERE event_type = 'model_invoked') as total_calls
FROM ai_generation_events
WHERE project_id = 'project-uuid-123'
  AND event_type = 'result_generated';

-- 对比三个模型的平均响应时间
SELECT
  model_name,
  AVG((metadata->>'latency_ms')::INT) as avg_latency_ms,
  COUNT(*) as call_count
FROM ai_generation_events
WHERE event_type = 'result_generated'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY model_name
ORDER BY avg_latency_ms;

-- 查询降级到初稿的失败案例
SELECT
  project_id,
  metadata->>'reason' as failure_reason,
  created_at
FROM ai_generation_events
WHERE event_type = 'degraded_to_draft'
ORDER BY created_at DESC
LIMIT 20;
```

**DEMO阶段简化**：
- 可先不实现完整事件溯源
- 至少记录：`model_name`, `tokens_used`, `latency_ms`, `output`
- Growth阶段再扩展为完整事件流

---

## 关键架构修改汇总

基于以上ADR，需要在技术实施中确保：

### 1. 事件溯源表（必须实现）

```sql
CREATE TABLE ai_generation_events (
  event_id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(50),
  model_name VARCHAR(50),
  model_version VARCHAR(50),
  input_hash VARCHAR(64),
  output JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. ORM中间件强制租户隔离（安全关键）

```typescript
export const tenantMiddleware: Prisma.Middleware = async (params, next) => {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant ID required');

  if (['Project', 'AIArtifact'].includes(params.model)) {
    params.args.where = { ...params.args.where, tenantId };
  }
  return next(params);
};
```

### 3. AI调用超时与降级策略（用户体验关键）

**超时配置**：
- 单模型超时：60秒
- 总调用超时：120秒
- 最少成功模型：2个

**降级逻辑**：
```typescript
if (successfulModels.length >= 2) {
  return {
    status: 'degraded',
    threshold: 0.90, // 双模型时提高阈值
    warning: '三模型验证降级为双模型'
  };
} else if (successfulModels.length === 1) {
  return {
    status: 'draft',
    requireHumanReview: true,
    warning: 'AI生成结果不足，请仔细审核'
  };
}
```

---

## 附录：技术栈推荐

**后端**：
- 框架：Node.js + NestJS / Fastify
- ORM：Prisma
- 数据库：PostgreSQL 14+
- 缓存：Redis
- 队列：Bull (Redis-based)

**前端**：
- 框架：React 18+ / Vue 3+
- 状态管理：Zustand / Pinia
- 实时通信：Socket.io Client
- UI组件：Ant Design / Element Plus

**部署**：
- 容器化：Docker + Docker Compose
- DEMO环境：单服务器 (2vCPU, 4GB RAM)
- Growth环境：Kubernetes + 云RDS

**监控**：
- 日志：Winston + Loki
- 指标：Prometheus + Grafana
- 错误追踪：Sentry

---

*本文档将随项目演进持续更新。*
