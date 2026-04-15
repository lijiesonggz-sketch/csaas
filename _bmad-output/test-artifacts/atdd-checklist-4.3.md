---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-04-15'
workflowType: testarch-atdd
storyId: '4.3'
storyTitle: Regulation Obligation 管理页面
inputDocuments:
  - _bmad/bmm/config.yaml
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/tea-index.csv
  - _bmad-output/implementation-artifacts/4-3-regulation-obligation-management-page.md
  - frontend/playwright.config.ts
  - frontend/app/admin/failure-modes/page.test.tsx
  - frontend/lib/api/failure-modes.test.ts
  - backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts
  - backend/src/modules/knowledge-graph/services/obligation.service.spec.ts
  - frontend/e2e/compliance-cases-admin.spec.ts
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/component-tdd.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/selector-resilience.md
  - _bmad/tea/testarch/knowledge/timing-debugging.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/overview.md
  - _bmad/tea/testarch/knowledge/api-request.md
  - _bmad/tea/testarch/knowledge/auth-session.md
  - _bmad/tea/testarch/knowledge/playwright-cli.md
---

# Step 1: Preflight & Context Loading

## Stack Detection

- `detected_stack`: `fullstack`
- Frontend indicators:
  - `frontend/package.json` 包含 `next` / `react`
  - `frontend/playwright.config.ts` 存在
  - `frontend/e2e/*.spec.ts` 与 `frontend/app/**/*.test.tsx` 已存在
- Backend indicators:
  - `backend/package.json` 存在，测试框架为 Jest
  - `backend/src/**/*.spec.ts` 大量存在，NestJS + TypeORM 服务 / 路由测试模式已建立

## Prerequisites

- Story 文档已存在且 AC 明确：
  - `_bmad-output/implementation-artifacts/4-3-regulation-obligation-management-page.md`
- 前端 E2E 测试框架已配置：
  - `frontend/playwright.config.ts`
- 后端测试框架已配置：
  - `backend/package.json` 中 `jest` 配置
- 当前仓库已有可复用的 admin page 单测、API client 单测、Nest route/service spec、Playwright admin 页面 smoke 模式

## Existing Test Patterns

### Frontend component/page tests

- `frontend/app/admin/failure-modes/page.test.tsx`
  - 使用 `@testing-library/react`
  - 统一 mock `next/navigation`、`next-auth/react`、`sonner`
  - 对 `Dialog` / `Select` 做轻量 mock，降低 Radix/shadcn 噪音
  - 页面行为覆盖：列表加载、创建、编辑、映射增删、分页按钮

### Frontend API client tests

- `frontend/lib/api/failure-modes.test.ts`
  - 统一 mock `apiFetch`
  - 精确断言 querystring、HTTP method、payload
  - 包含 code suggestion 纯函数测试

### Backend route tests

- `backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts`
  - 用 Nest TestingModule 启动最小 app
  - override `JwtAuthGuard` / `TenantGuard` / `RolesGuard`
  - 保留 `ValidationPipe` + `TransformInterceptor`
  - 精确断言权限、审计日志、路由顺序和 DTO 校验

### Backend service tests

- `backend/src/modules/knowledge-graph/services/obligation.service.spec.ts`
  - 用 mocked repositories 做 service-level RED/GREEN
  - describe 与用例已带 AC/Priority 风格标签，可直接扩展 4.3

### Frontend E2E smoke tests

- `frontend/e2e/compliance-cases-admin.spec.ts`
  - 通过 `page.route()` mock `/api/auth/session` 与业务端点
  - 直接 `page.goto('/admin/...')`
  - 适合作为 4.3 admin 页面 smoke/interaction E2E 基线

## Loaded Knowledge Fragments

- Core:
  - `data-factories.md`
  - `component-tdd.md`
  - `test-quality.md`
  - `test-healing-patterns.md`
- Fullstack/UI relevant:
  - `selector-resilience.md`
  - `timing-debugging.md`
  - `test-levels-framework.md`
  - `test-priorities-matrix.md`
  - `overview.md`
  - `api-request.md`
  - `auth-session.md`
  - `playwright-cli.md`

## ATDD Notes for Story 4.3

- 这是 `P1` 的 admin 管理页故事，但包含两类高风险点，按 `P0` 处理 RED coverage：
  - obligation-control-map 增删 contract
  - admin-only page 的关键 CRUD / 映射交互
- 适合的测试层级组合：
  - Backend route/service tests：覆盖 control map contract、权限、审计、归属校验
  - Frontend page/component tests：覆盖列表 + 详情 + 新建 + clause detail dialog + control map 管理
  - Frontend E2E smoke：覆盖 admin 会话、列表打开、详情交互主路径
- 选择器策略：
  - 新测试优先 `getByRole()` / `getByLabelText()` / 现有可访问文本
  - 不为测试修改生产代码加一次性 `data-testid`
- 等待策略：
  - page tests 以 mocked promise / `waitFor` 为主
  - E2E 以 `page.route()` + 响应驱动，不使用硬等待

# Step 2: Generation Mode Selection

## Chosen Mode

- Mode: `AI generation`
- Reason:
  - Story 4.3 的 acceptance criteria 明确
  - 交互模式属于标准 admin CRUD / 列表详情 / 映射管理
  - 当前仓库已有高相似度参考：
    - `frontend/app/admin/failure-modes/page.tsx`
    - `frontend/app/admin/failure-modes/page.test.tsx`
    - `backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts`
    - `backend/src/modules/knowledge-graph/services/obligation.service.spec.ts`
  - 不需要先通过录制探索未知交互才能编写 RED 测试

## Recording Decision

- Recording mode: skipped
- Why skipped:
  - 当前故事不存在 drag/drop、复杂 wizard、富状态图形交互
  - 4.2 的已交付页面已足够作为 4.3 的 UI 结构与测试参考

# Step 3: Test Strategy

## Acceptance Criteria to Scenario Mapping

### AC1: Obligation 列表页

- Scenario `4.3-COMP-001` `[P1][AC1]`
  - 管理员进入 `/admin/obligations`
  - 页面加载 obligation 列表
  - 支持 `obligationType` / `status` / `applicableSector` / `keyword` 过滤
  - 默认选中第一条 obligation 并显示详情

- Scenario `4.3-E2E-001` `[P1][AC1]`
  - 管理员打开页面
  - 看到列表和详情面板主结构

### AC2: CRUD 操作

- Scenario `4.3-API-001` `[P1][AC2]`
  - `frontend/lib/api/obligations.ts` 能正确发起 list/get/create/update 请求
  - `suggestObligationCode` 能基于 clause 信息与现有 codes 生成稳定建议值

- Scenario `4.3-COMP-002` `[P1][AC2]`
  - 页面可通过 clause 搜索弹窗新建 obligation
  - 页面可在详情面板保存 `obligationText` / `obligationType` / `applicableSector` / `status`

### AC3: clause 关联展示

- Scenario `4.3-COMP-003` `[P1][AC3]`
  - 详情面板展示 clause 摘要信息
  - 点击 clause 卡片打开条文详情 dialog / drawer
  - dialog 展示 `articleNo` / `sectionPath` / `clauseText`

### AC4: control point 映射管理

- Scenario `4.3-INT-001` `[P0][AC4]`
  - backend 新增 `POST /obligations/:id/control-maps` 成功创建映射
  - duplicate mapping 冲突被拒绝

- Scenario `4.3-INT-002` `[P0][AC4]`
  - backend 新增 `DELETE /obligations/:id/control-maps/:mapId` 成功删除映射
  - `mapId` 不属于当前 obligation 时拒绝删除

- Scenario `4.3-COMP-004` `[P1][AC4]`
  - 页面可搜索 control points
  - 页面可添加 `FULL/PARTIAL` 映射
  - 页面可删除既有映射

## Selected Test Levels

- **Backend Integration / API**
  - `4.3-INT-001`
  - `4.3-INT-002`
  - 原因：这是本故事新增的后端 contract delta，涉及 route、service、权限、审计和归属校验

- **Frontend API client**
  - `4.3-API-001`
  - 原因：需要验证 querystring、payload 和 suggestion 纯函数，不必用浏览器放大成本

- **Frontend Component / Page**
  - `4.3-COMP-001`
  - `4.3-COMP-002`
  - `4.3-COMP-003`
  - `4.3-COMP-004`
  - 原因：页面主体行为、弹窗、表单和局部映射交互最适合 RTL page tests

- **Frontend E2E**
  - `4.3-E2E-001`
  - 原因：保留一条 admin 页面级 smoke，验证 session + route mock + 页面壳结构主路径

## Duplicate Coverage Guard

- 不重复新增 Story 3.2 已经稳定覆盖的 obligation backend CRUD 路由测试：
  - `GET /obligations`
  - `GET /obligations/:id`
  - `POST /obligations`
  - `PATCH /obligations/:id`
  - `GET /obligations/by-clause/:clauseId`
  - `GET /obligations/:id/control-points`
- 4.3 的 backend RED 只针对本故事新增的 `control-maps` 管理 contract
- 4.3 的 frontend 测试负责覆盖“管理页如何消费这些 contract”，不重复验证 3.2 的 service 业务细节

## Priority Assignment

- `P0`
  - `4.3-INT-001`
  - `4.3-INT-002`
  - 理由：错误的 obligation-control-map 管理会直接破坏法规义务与控制点的权威映射关系，属于数据完整性风险

- `P1`
  - `4.3-API-001`
  - `4.3-COMP-001`
  - `4.3-COMP-002`
  - `4.3-COMP-003`
  - `4.3-COMP-004`
  - `4.3-E2E-001`
  - 理由：这是管理员高频使用的管理页面主路径，但不涉及支付/安全级别的 P0 风险

## Red Phase Requirements

- 所有新增测试必须先在以下缺口上失败：
  - backend 尚不存在 `obligations/:id/control-maps` create/delete 端点
  - frontend 尚不存在 `frontend/lib/api/obligations.ts`
  - frontend 尚不存在 `frontend/app/admin/obligations/page.tsx`
  - Sidebar 尚不存在 `Obligation 管理` 入口
- RED phase 成功标准：
  - 至少一个 backend route / service spec 因缺少 control-map 管理能力失败
  - 至少一个 frontend API / page spec 因缺少 obligations client / page 失败
  - E2E smoke 因缺少页面路由或页面结构失败

# Step 4 - Aggregate

## Generated RED PHASE Artifacts

- API / backend RED tests：
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-api-red.spec.ts`
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-backend-red.spec.ts`
  - 共 `7` 条 `test.skip()` 测试
- E2E RED tests：
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-e2e-red.spec.ts`
  - 共 `2` 条 `test.skip()` 测试
- Shared fixtures：
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-fixtures.ts`
- Repo-local tmp summary：
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-api-tests-20260415T030301.json`
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-e2e-tests-20260415T030301.json`
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-summary-20260415T030301.json`

## TDD Red Phase Compliance

- 所有测试使用 `test.skip()`：`PASS`
- 所有断言直接绑定 Story 4.3 的预期行为：`PASS`
- 未覆盖故事外的覆盖率看板、法规来源管理页、条文独立管理页：`PASS`
- temp 工件落在 `_bmad-output/test-artifacts/tmp/`，没有写到随机系统目录：`PASS`
- 本次执行模式：`SEQUENTIAL (API -> E2E)`

# Step 5 - Validate and Complete

## Validation Result

- prerequisites 满足：`PASS`
- checklist 与 Story 4.3 AC 对齐：`PASS`
- RED 工件覆盖：
  - obligation 列表过滤 / 默认详情展示
  - typed client list/get/create/update/control-map helpers
  - obligation code suggestion
  - clause 搜索与 clause detail dialog
  - obligation_control_map create/delete guardrails
  - admin 页面可达性与主路径 smoke

## Artifact Summary

- 新增 RED 工件：
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-fixtures.ts`
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-api-red.spec.ts`
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-backend-red.spec.ts`
  - `D:\csaas\_bmad-output\test-artifacts\atdd-story-kg2-4-3-e2e-red.spec.ts`
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-api-tests-20260415T030301.json`
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-e2e-tests-20260415T030301.json`
  - `D:\csaas\_bmad-output\test-artifacts\tmp\tea-atdd-summary-20260415T030301.json`
  - `D:\csaas\_bmad-output\test-artifacts\atdd-checklist-4.3.md`

## Key Risks / Assumptions

- `GET /api/admin/knowledge-graph/regulation-clauses` 当前只返回 clause 基础字段，不含 source relation；create dialog 只能依赖 `clauseCode` / `articleNo` / `clauseSummary` 做选择
- `Obligation 管理` 页面需要在本页内提供 clause detail dialog，因为当前仓库没有独立条文详情页
- obligation-control-map 的归属校验是本轮 backend guardrail 的核心；如果删除时不校验所属 obligation，会直接造成法规义务与控制点关系错删
- 旧版 `_bmad-output/test-artifacts/atdd-story-4-3-*` 属于 legacy report story，本轮新工件统一使用 `kg2-4-3` 前缀避免覆盖

## Next Recommended Workflow

1. 进入 `bmad-dev-story 4-3`
2. 先补 backend `obligations/:id/control-maps` create/delete contract 与测试
3. 再补 frontend typed client、admin 页面、Sidebar 入口和页面测试
4. 最后把 admin 页面 smoke/E2E 与定向回归跑绿
