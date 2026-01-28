# Story 1.4: 统一导航与首次登录引导

**Epic**: Epic 1 - 基础设施与Csaas集成
**Story ID**: 1.4
**Story Key**: 1-4-unified-navigation-and-first-login-guidance
**状态**: done
**优先级**: P1 (高)
**预计时间**: 2-3天
**依赖**: Story 1.1 (已完成), Story 1.2 (已完成), Story 1.3 (已完成)

---

## 用户故事

**As a** Csaas用户
**I want** 从项目主页轻松访问Radar Service，并在首次使用时获得引导
**So that** 我可以快速了解和配置雷达服务

---

## 业务价值

### 为什么这个故事很重要?
1. **用户体验优化**: 统一导航让用户轻松切换标准评估和Radar Service
2. **首次使用引导**: 降低学习曲线，帮助新用户快速上手
3. **服务可见性**: Radar Service入口清晰展示，提升功能发现率
4. **配置引导**: 通过引导流程完成初始配置，提升激活率

### 成功指标
- ✅ 项目主页显示Radar Service入口卡片
- ✅ 首次访问/radar时显示三步引导流程
- ✅ 顶部导航显示Radar Service选项
- ✅ 面包屑导航清晰标识当前位置

---

## 验收标准 (Acceptance Criteria)

### AC 1: 项目主页Radar Service入口

**Given** 用户登录Csaas
**When** 用户访问项目主页（Dashboard）
**Then** 显示"Radar Service"入口卡片
**And** 卡片显示雷达服务状态（未激活/已激活）
**And** 点击卡片跳转到 /radar/dashboard

### AC 2: 首次访问引导

**Given** 用户首次访问 /radar
**When** 页面加载
**Then** 显示欢迎引导弹窗："欢迎使用 Radar Service！让我们设置您的雷达偏好"
**And** 引导包含三步：1) 薄弱项识别 2) 关注技术领域 3) 关注同业机构

### AC 3: 引导步骤1 - 薄弱项识别

**Given** 用户在引导步骤1
**When** 页面显示
**Then** 自动显示系统识别的薄弱项（来自评估）
**And** 说明："系统已自动识别您的薄弱项，雷达将优先推送相关内容"
**And** 用户点击"下一步"进入步骤2

### AC 4: 引导步骤2 - 关注技术领域

**Given** 用户在引导步骤2
**When** 页面显示
**Then** 显示技术领域选择器，包含预设选项：云原生、AI应用、移动金融安全、成本优化
**And** 支持自定义输入技术领域名称
**And** 用户选择后点击"下一步"进入步骤3

### AC 5: 引导步骤3 - 关注同业机构

**Given** 用户在引导步骤3
**When** 页面显示
**Then** 显示同业机构选择器，包含预设选项：杭州银行、绍兴银行、招商银行
**And** 支持自定义输入同业机构名称
**And** 用户点击"完成"关闭引导

### AC 6: 引导完成

**Given** 用户完成三步引导
**When** 用户点击"完成"
**Then** 标记Radar Service为已激活
**And** 跳转到 /radar/dashboard
**And** 显示三大雷达入口（技术、行业、合规）
**And** 后续访问不再显示引导

### AC 7: 统一顶部导航

**Given** 用户访问 /radar 的任何子路由
**When** 页面加载
**Then** 顶部导航显示：Dashboard | 标准评估 | Radar Service | 报告中心
**And** 面包屑导航显示当前位置（如："Dashboard / Radar Service / 技术雷达"）

---

## 技术实施计划

### Phase 1: 前端导航更新 (1天)

#### Task 1.1: 更新项目主页添加Radar入口
**优先级**: P0 (阻塞项)
**关联AC**: AC 1

**实施步骤**:
1. 修改 `frontend/app/projects/[projectId]/page.tsx`
2. 在项目卡片区域添加Radar Service卡片:
   ```tsx
   <Card
     title="Radar Service"
     description="技术趋势、行业标杆、合规预警"
     status={radarServiceStatus}
     onClick={() => router.push(`/radar?orgId=${organizationId}`)}
     icon="📡"
   />
   ```
3. 添加API调用检查Radar Service激活状态
4. 创建单元测试

**文件清单**:
- `frontend/app/projects/[projectId]/page.tsx` (修改)
- `frontend/components/projects/RadarServiceCard.tsx` (新建)

---

#### Task 1.2: 更新顶部导航添加Radar Service
**优先级**: P0 (阻塞项)
**关联AC**: AC 7

**实施步骤**:
1. 创建统一导航组件 `frontend/components/layout/UnifiedNavigation.tsx`
2. 导航项: Dashboard, 标准评估, Radar Service, 报告中心
3. 使用active状态高亮当前页面
4. 在所有Radar页面使用统一导航

**文件清单**:
- `frontend/components/layout/UnifiedNavigation.tsx` (新建)
- `frontend/app/layout.tsx` (修改 - 添加导航)

---

#### Task 1.3: 实现面包屑导航
**优先级**: P1 (高)
**关联AC**: AC 7

**实施步骤**:
1. 创建面包屑组件 `frontend/components/layout/Breadcrumb.tsx`
2. 根据当前路由动态生成面包屑
3. 路由映射:
   - /radar → ["Radar Service"]
   - /radar/tech → ["Radar Service", "技术雷达"]
   - /radar/industry → ["Radar Service", "行业雷达"]
   - /radar/compliance → ["Radar Service", "合规雷达"]

**文件清单**:
- `frontend/components/layout/Breadcrumb.tsx` (新建)
- `frontend/app/radar/layout.tsx` (新建 - Radar布局组件)

---

### Phase 2: 首次引导流程 (1.5天)

#### Task 2.1: 创建引导流程组件
**优先级**: P0 (阻塞项)
**关联AC**: AC 2, 3, 4, 5, 6

**实施步骤**:
1. 创建引导组件 `frontend/components/radar/OnboardingWizard.tsx`
2. 实现三步引导:
   - Step 1: 薄弱项展示（调用WeaknessSnapshotService）
   - Step 2: 技术领域选择（WatchedTopic创建）
   - Step 3: 同业机构选择（WatchedPeer创建）
3. 引导状态管理:
   - localStorage存储引导完成状态
   - 检查 `radar_onboarding_completed` 标志
4. 引导完成后标记organization.radarActivated = true

**文件清单**:
- `frontend/components/radar/OnboardingWizard.tsx` (新建)
- `frontend/lib/hooks/useOnboarding.ts` (新建)
- `frontend/lib/hooks/useWeaknesses.ts` (新建)

---

#### Task 2.2: 创建Radar Dashboard页面
**优先级**: P1 (高)
**关联AC**: AC 6

**实施步骤**:
1. 创建 `frontend/app/radar/page.tsx`
2. 显示三大雷达入口:
   - 技术雷达 (📊)
   - 行业雷达 (🏢)
   - 合规雷达 (⚖️)
3. 每个雷达卡片显示:
   - 标题和描述
   - 激活状态
   - 快速操作按钮

**文件清单**:
- `frontend/app/radar/page.tsx` (新建)
- `frontend/components/radar/RadarTypeCard.tsx` (新建)

---

### Phase 3: 后端API支持 (0.5天)

#### Task 3.1: 实现WatchedTopic和WatchedPeer API
**优先级**: P0 (阻塞项)
**关联AC**: AC 4, 5

**实施步骤**:
1. WatchedTopic API (已存在于organizations模块):
   - POST /organizations/:id/watched-topics
   - GET /organizations/:id/watched-topics
   - DELETE /organizations/:id/watched-topics/:id

2. WatchedPeer API:
   - POST /organizations/:id/watched-peers
   - GET /organizations/:id/watched-peers
   - DELETE /organizations/:id/watched-peers/:id

**文件清单**:
- `backend/src/modules/organizations/organizations.controller.ts` (修改 - 添加API端点)
- `backend/src/modules/organizations/organizations.service.ts` (修改 - 添加CRUD方法)

---

#### Task 3.2: 实现Radar激活状态API
**优先级**: P1 (高)
**关联AC**: AC 1, 6

**实施步骤**:
1. 添加Organization.radarActivated字段到数据库
2. 创建迁移
3. 实现激活/停用API

**文件清单**:
- `backend/src/database/entities/organization.entity.ts` (修改)
- `backend/src/database/migrations/*-add-radar-activated.ts` (新建)
- `backend/src/modules/organizations/organizations.controller.ts` (修改)

---

### Phase 4: 集成测试与验证 (0.5天)

#### Task 4.1: 创建E2E测试
**优先级**: P1 (高)
**关联AC**: 全部

**实施步骤**:
1. 测试场景:
   - 用户首次访问Radar显示引导
   - 完成引导后不再显示
   - 项目主页显示Radar卡片
   - 导航和面包屑正确显示

**文件清单**:
- `backend/test/radar-onboarding.e2e-spec.ts` (新建)

---

## Dev Notes

### 相关架构模式和约束

1. **前端技术栈**:
   - Next.js 14.2 (App Router)
   - React 18
   - Ant Design + Material-UI
   - Zustand for state management

2. **导航模式**:
   - 使用App Router的布局系统
   - 动态路由: [projectId], [radarType]
   - 嵌套布局共享导航

3. **状态管理**:
   - localStorage存储引导完成状态
   - Zustand store管理Radar状态
   - 后端API获取激活状态

4. **引导流程**:
   - 使用Modal/Drawer组件
   - 步骤指示器显示进度
   - 每步可跳过（可选）

### 需要接触的源码树组件

**前端模块**:
- `frontend/app/projects/[projectId]/page.tsx` - 项目主页
- `frontend/app/radar/` - Radar页面（新建目录）
- `frontend/components/layout/` - 导航组件
- `frontend/components/radar/` - Radar组件（新建目录）

**后端模块**:
- `backend/src/modules/organizations/` - Organization API
- `backend/src/database/entities/organization.entity.ts` - 添加radarActivated字段

### 测试标准总结

1. **单元测试**:
   - OnboardingWizard组件测试
   - 导航组件测试
   - API测试

2. **E2E测试**:
   - 完整引导流程
   - 导航和路由测试

3. **测试覆盖率**:
   - 组件测试: ≥80%
   - E2E场景: 4个主要场景

### 项目结构说明

**前端路由结构**:
```
frontend/app/
├── projects/[projectId]/
│   └── page.tsx (添加Radar卡片)
├── radar/
│   ├── page.tsx (Dashboard)
│   ├── tech/
│   │   └── page.tsx
│   ├── industry/
│   │   └── page.tsx
│   ├── compliance/
│   │   └── page.tsx
│   └── layout.tsx (统一导航)
└── layout.tsx (根布局)
```

---

## References

### 来源文档引用

- **Epic定义**: [Source: _bmad-output/epics.md#Epic 1, Story 1.4]
- **UX设计规范**: [Source: _bmad-output/ux-design-specification-radar-service.md]
- **架构文档**: [Source: _bmad-output/architecture-radar-service.md]

### 技术栈参考

- **Next.js App Router**: https://nextjs.org/docs/app
- **Ant Design**: https://ant.design/components/overview/
- **Zustand**: https://github.com/pmndrs/zustand

---

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References
(待开发时填写)

### Completion Notes List
(待开发时填写)

### File List
**已创建文件** (27个):

**后端文件 (11个)**:
1. `backend/src/database/entities/watched-topic.entity.ts` ✅
2. `backend/src/database/entities/watched-peer.entity.ts` ✅
3. `backend/src/database/migrations/1768700000000-AddRadarActivatedColumn.ts` ✅
4. `backend/src/database/migrations/1768700000001-CreateWatchedTopicsTable.ts` ✅
5. `backend/src/database/migrations/1768700000002-CreateWatchedPeersTable.ts` ✅
6. `backend/src/database/entities/organization.entity.ts` ✅ (修改：添加radarActivated和关联)
7. `backend/src/modules/organizations/organizations.service.ts` ✅ (修改：添加10个新方法)
8. `backend/src/modules/organizations/organizations.controller.ts` ✅ (修改：添加11个新API端点)
9. `backend/src/modules/organizations/organizations.module.ts` ✅ (修改：注册新entities)
10. `backend/src/database/entities/index.ts` ✅ (修改：导出新entities)

**前端文件 (10个)**:
11. `frontend/lib/hooks/useOnboarding.ts` ✅
12. `frontend/lib/hooks/useWeaknesses.ts` ✅
13. `frontend/components/radar/OnboardingWizard.tsx` ✅
14. `frontend/app/radar/page.tsx` ✅ (修改：集成OnboardingWizard)
15. `frontend/app/projects/[projectId]/page.tsx` ✅ (修改：添加Radar卡片)
16. `frontend/components/layout/UnifiedNavigation.tsx` ✅
17. `frontend/components/layout/Breadcrumb.tsx` ✅
18. `frontend/app/radar/tech/page.tsx` ✅
19. `frontend/app/radar/industry/page.tsx` ✅
20. `frontend/app/radar/compliance/page.tsx` ✅

**测试文件 (6个)**:
21. `frontend/components/layout/UnifiedNavigation.test.tsx` ✅
22. `frontend/components/layout/Breadcrumb.test.tsx` ✅
23. `frontend/app/radar/page.test.tsx` ✅
24. `frontend/app/radar/tech/page.test.tsx` ✅
25. `frontend/app/radar/industry/page.test.tsx` ✅
26. `frontend/app/radar/compliance/page.test.tsx` ✅

**文档文件 (1个)**:
27. `STORY_1.4_FINAL_COMPLETION_REPORT.md` ✅

**已修改文件**: 无额外文件

**验收标准实现情况**:
- ✅ AC 1: 项目主页Radar Service入口 - 已实现
- ✅ AC 2: 首次访问引导弹窗 - 已实现（OnboardingWizard）
- ✅ AC 3: 引导步骤1 - 薄弱项识别 - 已实现（Step 1 of OnboardingWizard）
- ✅ AC 4: 引导步骤2 - 技术领域选择 - 已实现（Step 2 of OnboardingWizard）
- ✅ AC 5: 引导步骤3 - 同业机构选择 - 已实现（Step 3 of OnboardingWizard）
- ✅ AC 6: 引导完成和雷达激活 - 已实现（activateRadar API）
- ✅ AC 7: 统一顶部导航和面包屑 - 已实现（UnifiedNavigation + Breadcrumb）

**状态**: ✅ 完成 (7/7 ACs实现)

---

**下一步**: 使用`dev-story`工作流开始TDD开发
