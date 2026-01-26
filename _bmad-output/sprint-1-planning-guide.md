# Sprint 1 Planning Guide
## Epic 1: 基础设施与Csaas集成

**Sprint周期**: 建议2周（10个工作日）
**Sprint目标**: 建立Radar Service的基础设施，实现与Csaas平台的深度集成
**团队规模**: 建议2-3人（1后端 + 1前端 + 可选1全栈）

---

## 📋 Sprint Overview

### Sprint Goal（Sprint目标）

**作为Radar Service团队，我们要在2周内完成与Csaas平台的基础设施集成，使金融机构用户能够从Csaas无缝访问Radar Service，系统自动识别评估薄弱项，为三大雷达功能奠定基础。**

### Success Criteria（成功标准）

✅ 用户可以从Csaas项目主页访问Radar Service入口
✅ 系统自动为每个用户创建Organization并关联Project
✅ Csaas用户使用相同凭证访问Radar Service（无需重新登录）
✅ 评估完成后5分钟内，薄弱项自动同步到Radar Service
✅ 首次访问Radar Service时显示三步引导流程

---

## 📦 Stories in Sprint 1

### Story 1.1: 系统自动创建组织并将项目关联

**优先级**: P0（最高，必须完成）
**估算**: 3-4天
**依赖**: 无

**User Story**:
```
As a 系统管理员,
I want 系统自动为每个用户创建组织（Organization），并将项目关联到组织,
So that Radar Service 可以在组织级别提供服务，而不是项目级别。
```

**Acceptance Criteria**:
```gherkin
Given 用户首次创建项目
When 项目创建成功
Then 系统自动创建一个 Organization 实体，Organization.name 默认为"用户的组织"
And Project.organizationId 关联到新创建的 Organization
And 创建 OrganizationMember 记录，将用户设为该组织的 admin

Given 用户已有组织
When 用户创建新项目
Then 新项目自动关联到用户的现有组织
And 不创建新的 Organization

Given 评估完成
When 系统识别到薄弱项
Then 创建 WeaknessSnapshot 实体，关联到 organizationId 和 projectId
And WeaknessSnapshot 包含 category（如"数据安全"）、level（如 2）、description

Given 组织有多个项目的薄弱项
When 系统聚合薄弱项
Then 按 category 分组，取最低 level（最薄弱）
And 记录薄弱项来源的 projectIds
```

**技术任务拆解**:

**后端任务**（估计2-3天）:
- [ ] **Task 1.1.1**: 设计数据库Schema（4小时）
  - 创建`Organization`实体：id, name, createdAt, updatedAt
  - 创建`OrganizationMember`实体：id, organizationId, userId, role, createdAt
  - 创建`WeaknessSnapshot`实体：id, organizationId, projectId, category, level, description, createdAt
  - 为`Project`表添加`organizationId`外键字段
  - 编写TypeORM migration脚本

- [ ] **Task 1.1.2**: 实现Organization自动创建逻辑（6小时）
  - 修改Project Service的create方法，添加Organization创建逻辑
  - 实现Organization聚合查询：查询用户所属的所有Organization
  - 实现Project创建时的自动关联逻辑
  - 单元测试：测试Organization创建和Project关联

- [ ] **Task 1.1.3**: 实现WeaknessSnapshot创建和聚合（6小时）
  - 实现WeaknessSnapshot Service的创建方法
  - 实现薄弱项聚合逻辑：按category分组，取最低level
  - 实现薄弱项来源记录（projectIds数组）
  - 单元测试：测试薄弱项创建和聚合

- [ ] **Task 1.1.4**: API端点开发（4小时）
  - `GET /organizations` - 获取用户所属组织列表
  - `GET /organizations/:id/weaknesses` - 获取组织薄弱项（支持projectId筛选）
  - `GET /organizations/:id/projects` - 获取组织下的项目列表
  - 集成测试：测试所有API端点

**前端任务**（估计1天，可选延后）:
- [ ] **Task 1.1.5**: 组织状态展示（4小时）
  - 在Project页面显示Organization信息
  - 显示薄弱项聚合结果（如果有）
  - UI组件开发

**Definition of Done**:
- ✅ 数据库Schema设计完成并通过Review
- ✅ Organization自动创建逻辑实现并测试通过
- ✅ WeaknessSnapshot创建和聚合逻辑实现并测试通过
- ✅ API端点实现并通过集成测试
- ✅ 代码已提交并Code Review通过

---

### Story 1.2: Csaas认证与权限集成

**优先级**: P0（最高，必须完成）
**估算**: 2-3天
**依赖**: 无（可与Story 1.1并行开发）

**User Story**:
```
As a Csaas 用户,
I want 使用相同的登录凭证访问 Radar Service,
So that 我不需要重新登录或管理多个账号。
```

**Acceptance Criteria**:
```gherkin
Given 用户已登录 Csaas
When 用户访问 /radar 路由
Then 系统复用 Csaas 的 JWT token 验证用户身份
And 不需要重新登录

Given 用户访问 Radar Service API
When API 请求包含有效的 JWT token
Then OrganizationGuard 自动从 token 中提取 userId
And 查询用户所属的 organizationId
And 将 organizationId 注入到请求上下文中

Given 用户访问其他组织的数据
When API 请求的 organizationId 与用户所属组织不匹配
Then 返回 403 Forbidden 错误
And 记录审计日志

Given Csaas WebSocket Gateway 已存在
When Radar Service 需要推送通知
Then 复用现有的 Socket.io Gateway
And 使用 'radar:push:new' 事件名称
```

**技术任务拆解**:

**后端任务**（估计1.5-2天）:
- [ ] **Task 1.2.1**: 实现OrganizationGuard（4小时）
  - 创建`OrganizationGuard`类，继承NestJS的AuthGuard
  - 实现JWT token解析和userId提取
  - 实现organizationId查询逻辑
  - 将organizationId注入到Request对象
  - 单元测试：测试Guard的认证和授权逻辑

- [ ] **Task 1.2.2**: 实现权限校验中间件（4小时）
  - 实现跨组织访问检查：organizationId匹配验证
  - 实现403 Forbidden错误处理
  - 实现审计日志记录（访问其他组织数据的尝试）
  - 单元测试：测试权限校验逻辑

- [ ] **Task 1.2.3**: WebSocket集成（4小时）
  - 研究Csaas现有WebSocket Gateway实现
  - 在Radar Service中复用Socket.io Gateway
  - 定义'radar:push:new'事件结构
  - 集成测试：测试WebSocket推送

- [ ] **Task 1.2.4**: 前端路由和认证集成（4小时）
  - 配置Next.js路由支持`/radar/*`路径
  - 实现前端JWT token传递（axios interceptor）
  - 实现organizationId上下文管理（Zustand store）
  - 端到端测试：测试从Csaas访问Radar Service

**前端任务**（估计0.5天）:
- [ ] **Task 1.2.5**: radarStore实现（4小时）
  - 创建Zustand store: `useRadarStore`
  - 状态：organizationId, user, isAuthenticated
  - Actions: setOrganization, setUser, logout
  - 与Csaas auth集成

**Definition of Done**:
- ✅ OrganizationGuard实现并测试通过
- ✅ 权限校验中间件实现并测试通过
- ✅ WebSocket集成完成并测试通过
- ✅ 前端路由和认证集成完成
- ✅ 端到端测试通过：用户从Csaas访问Radar Service无需重新登录

---

### Story 1.3: 评估完成后自动识别薄弱项

**优先级**: P0（最高，必须完成）
**估算**: 3-4天
**依赖**: Story 1.1（需要Organization和WeaknessSnapshot实体）

**User Story**:
```
As a 金融机构 IT 总监,
I want 系统在评估完成后自动识别我的薄弱项,
So that Radar Service 可以基于薄弱项推送相关内容。
```

**Acceptance Criteria**:
```gherkin
Given 用户完成 Csaas 成熟度评估
When 评估结果保存成功
Then 系统通过 WebSocket 发送 'assessment:completed' 事件
And 事件包含 projectId 和评估结果

Given Radar Service 接收到 'assessment:completed' 事件
When 事件处理开始
Then 解析评估结果，提取所有成熟度等级 < 3 的领域作为薄弱项
And 为每个薄弱项创建 WeaknessSnapshot 记录
And 整个过程在 5 分钟内完成

Given 组织有多个项目
When 用户访问 Radar Service
Then 系统聚合所有项目的薄弱项
And 按 category 分组，显示最低 level
And 标注薄弱项来源的项目名称

Given 用户选择筛选特定项目
When 用户在 UI 中选择项目筛选器
Then 仅显示选中项目的薄弱项
And 推送内容基于筛选后的薄弱项
```

**技术任务拆解**:

**后端任务**（估计2.5-3天）:
- [ ] **Task 1.3.1**: WebSocket事件监听（6小时）
  - 创建`AssessmentGateway`，监听Csaas的'assessment:completed'事件
  - 实现事件处理逻辑：解析评估结果
  - 实现薄弱项提取逻辑：识别所有level < 3的领域
  - 性能测试：验证5分钟内完成

- [ ] **Task 1.3.2**: WeaknessSnapshot批量创建（6小时）
  - 实现批量创建WeaknessSnapshot的逻辑
  - 实现category聚合：相同category取最低level
  - 实现projectIds记录：记录薄弱项来源的项目
  - 集成测试：测试评估完成后的自动识别

- [ ] **Task 1.3.3**: API端点开发（4小时）
  - `GET /organizations/:id/weaknesses` - 获取组织薄弱项（支持projectId筛选）
  - `GET /organizations/:id/weaknesses/aggregated` - 获取聚合后的薄弱项
  - 查询优化：添加索引提升性能
  - 单元测试：测试API端点

**前端任务**（估计0.5-1天，可与Story 1.4合并）:
- [ ] **Task 1.3.4**: 薄弱项展示UI（8小时）
  - 创建薄弱项展示组件：显示聚合后的薄弱项
  - 实现项目筛选器：支持选择特定项目
  - 实时更新：通过WebSocket监听薄弱项变化
  - UI/UX：使用卡片或列表展示，标注level

**Definition of Done**:
- ✅ WebSocket事件监听实现并测试通过
- ✅ 薄弱项自动识别逻辑实现并测试通过
- ✅ 5分钟内完成薄弱项同步（性能达标）
- ✅ API端点实现并测试通过
- ✅ 前端薄弱项展示实现
- ✅ 端到端测试：评估完成后5分钟内薄弱项出现在Radar Service

---

### Story 1.4: 统一导航与首次登录引导

**优先级**: P1（高，建议完成）
**估算**: 3-4天
**依赖**: Story 1.1, 1.2, 1.3（需要Organization、认证、薄弱项数据）

**User Story**:
```
As a Csaas 用户,
I want 从项目主页轻松访问 Radar Service，并在首次使用时获得引导,
So that 我可以快速了解和配置雷达服务。
```

**Acceptance Criteria**:
```gherkin
Given 用户登录 Csaas
When 用户访问项目主页（Dashboard）
Then 显示"Radar Service"入口卡片
And 卡片显示雷达服务状态（未激活/已激活）
And 点击卡片跳转到 /radar/dashboard

Given 用户首次访问 /radar
When 页面加载
Then 显示欢迎引导弹窗："欢迎使用 Radar Service！让我们设置您的雷达偏好"
And 引导包含三步：1) 薄弱项识别 2) 关注技术领域 3) 关注同业机构

Given 用户在引导步骤 1
When 页面显示
Then 自动显示系统识别的薄弱项（来自评估）
And 说明："系统已自动识别您的薄弱项，雷达将优先推送相关内容"
And 用户点击"下一步"进入步骤 2

Given 用户完成三步引导
When 用户点击"完成"
Then 标记 Radar Service 为已激活
And 跳转到 /radar/dashboard
And 显示三大雷达入口（技术、行业、合规）

Given 用户访问 /radar 的任何子路由
When 页面加载
Then 顶部导航显示：Dashboard | 标准评估 | Radar Service | 报告中心
And 面包屑导航显示当前位置（如："Dashboard / Radar Service / 技术雷达"）
```

**技术任务拆解**:

**后端任务**（估计0.5天）:
- [ ] **Task 1.4.1**: 用户首访状态管理（4小时）
  - 在User实体中添加`radarOnboarded`字段（boolean）
  - 创建API端点：`POST /users/radar-onboarding-complete`标记引导完成
  - 创建API端点：`GET /users/radar-status`获取Radar Service状态
  - 单元测试：测试onboarding状态管理

**前端任务**（估计2.5-3天）:
- [ ] **Task 1.4.2**: Csaas项目主页集成（6小时）
  - 修改Csaas项目主页，添加Radar Service入口卡片
  - 显示Radar Service状态（未激活/已激活/薄弱项数量）
  - 实现跳转到/radar/dashboard的逻辑
  - UI/UX：与现有卡片样式保持一致

- [ ] **Task 1.4.3**: 首次引导流程实现（8小时）
  - 创建Onboarding向导组件（3步）
  - 步骤1：薄弱项识别展示（使用Story 1.3的数据）
  - 步骤2：关注技术领域配置（仅UI，配置保存到Epic 5）
  - 步骤3：关注同业机构配置（仅UI，配置保存到Epic 5）
  - 实现"跳过"和"完成"按钮

- [ ] **Task 1.4.4**: 顶部导航和面包屑（6小时）
  - 创建统一顶部导航组件（Dashboard | 标准评估 | Radar Service | 报告中心）
  - 实现面包屑导航组件（动态生成）
  - 集成到所有/radar/*页面
  - 响应式设计：支持桌面和平板

**Definition of Done**:
- ✅ Csaas项目主页显示Radar Service入口
- ✅ 首次访问/radar时显示引导流程
- ✅ 三步引导流程实现（薄弱项展示 + 技术领域配置 + 同业机构配置）
- ✅ 顶部导航和面包屑导航实现
- ✅ 用户onboarding状态管理实现
- ✅ 端到端测试：从Csaas项目主页→Radar Service引导→Dashboard

---

## 🗓️ Sprint Timeline（建议时间表）

### Week 1

| Day | Story | 任务 | 责任人 |
|-----|-------|------|--------|
| **Day 1** | Story 1.1 | Task 1.1.1: 设计数据库Schema + Review | 后端 |
| **Day 2** | Story 1.1 | Task 1.1.2: 实现Organization自动创建逻辑 | 后端 |
| **Day 2-3** | Story 1.2 | Task 1.2.1: 实现OrganizationGuard（并行开发） | 后端 |
| **Day 3** | Story 1.1 | Task 1.1.3: 实现WeaknessSnapshot创建和聚合 | 后端 |
| **Day 4** | Story 1.1 | Task 1.1.4: API端点开发 + 单元测试 | 后端 |
| **Day 4-5** | Story 1.2 | Task 1.2.2-1.2.4: 权限校验 + WebSocket集成 | 后端 |
| **Day 5** | Story 1.1 + 1.2 | 集成测试 + Bug修复 | 后端 |

### Week 2

| Day | Story | 任务 | 责任人 |
|-----|-------|------|--------|
| **Day 6** | Story 1.3 | Task 1.3.1: WebSocket事件监听 | 后端 |
| **Day 6-7** | Story 1.4 | Task 1.4.2: Csaas项目主页集成（前端先行） | 前端 |
| **Day 7** | Story 1.3 | Task 1.3.2: WeaknessSnapshot批量创建 + 性能测试 | 后端 |
| **Day 8** | Story 1.3 | Task 1.3.3-1.3.4: API端点 + 前端薄弱项展示 | 后端+前端 |
| **Day 9** | Story 1.4 | Task 1.4.3-1.4.4: 首次引导流程 + 导航组件 | 前端 |
| **Day 10** | **全部** | 端到端测试 + Bug修复 + Demo准备 | 全团队 |

---

## ⚠️ Risks and Dependencies（风险和依赖）

### 风险识别

| 风险 | 严重性 | 缓解措施 |
|------|-------|---------|
| **Csaas现有WebSocket不支持'radar:push:new'事件** | 🟠 中 | 提前验证Csaas WebSocket Gateway，必要时扩展其功能 |
| **数据库migration影响现有Project表** | 🟠 中 | 使用backwards-compatible migration，添加nullable的organizationId字段 |
| **5分钟内完成薄弱项同步性能不达标** | 🟡 低 | 提前性能测试，优化WebSocket处理逻辑，必要时使用队列 |
| **Csaas项目主页UI修改受限制** | 🟡 低 | 与Csaas团队Review UI设计，使用组件化方式集成 |

### 外部依赖

- **Csaas团队协作**:
  - 需要Csaas团队Review数据库Schema修改
  - 需要Csaas团队支持WebSocket事件（'assessment:completed'）
  - 需要Csaas团队Review项目主页UI修改

---

## 📊 Success Metrics（成功指标）

### 技术指标
- ✅ 所有4个Stories的Acceptance Criteria 100%满足
- ✅ 单元测试覆盖率 ≥ 80%
- ✅ 集成测试通过率 = 100%
- ✅ 代码Review通过，无Critical问题

### 性能指标
- ✅ 薄弱项同步时间 ≤ 5分钟（从评估完成到数据可用）
- ✅ API响应时间 P95 ≤ 500ms（Organization和Weakness查询）
- ✅ WebSocket事件处理延迟 ≤ 10秒

### 业务指标
- ✅ 用户可以从Csaas访问Radar Service（无需重新登录）
- ✅ 评估完成后薄弱项自动出现
- ✅ 首次访问引导流程完整

---

## 🎯 Sprint Review准备

### Demo Checklist

**Story 1.1 Demo**:
- [ ] 创建新Project，验证Organization自动创建
- [ ] 再次创建Project，验证自动关联现有Organization
- [ ] 查看WeaknessSnapshot数据（如果有评估）

**Story 1.2 Demo**:
- [ ] 从Csaas登录后，访问/radar/dashboard（无需重新登录）
- [ ] 尝试访问其他organization的数据（预期403错误）

**Story 1.3 Demo**:
- [ ] 完成一个Csaas评估（或手动触发事件）
- [ ] 5分钟内在Radar Service中看到薄弱项
- [ ] 切换项目筛选器，验证薄弱项过滤

**Story 1.4 Demo**:
- [ ] 首次访问/radar，显示三步引导
- [ ] Csaas项目主页显示Radar Service入口卡片
- [ ] 顶部导航和面包屑导航正常工作

---

## 📝 Notes（备注）

### 关键决策记录
1. **Organization自动创建时机**: 在用户首次创建Project时自动创建
2. **薄弱项聚合策略**: 按category分组，取最低level
3. **WebSocket事件名称**: 'assessment:completed'（需要与Csaas团队确认）
4. **onboarding状态存储**: 在User表中添加radarOnboarded字段

### 技术债务记录
- [ ] Story 1.1.5: 组织状态展示前端功能（如果Sprint 1时间不够，可延后到Sprint 2）
- [ ] Story 1.3的批量WeaknessSnapshot创建未来可以考虑使用异步队列优化

---

## 🚀 Next Sprint Preview（Sprint 2预告）

**Sprint 2目标**: 完成Epic 1的剩余工作，开始Epic 2（技术雷达）

**可能包含的Stories**:
- Story 1.x: 如果Sprint 1有未完成的任务
- Story 2.1: 自动采集技术信息并支持外部导入
- Story 2.2: 使用AI智能分析推送内容的相关性

---

**Sprint 1 Planning完成时间**: 2026-01-25
**计划责任人**: 产品经理 + 技术负责人
**下次Review**: Sprint Review（2周后）

---

**祝Sprint 1成功！** 🎉
