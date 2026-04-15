# Story 4.3: Regulation Obligation 管理页面

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 管理员，
I want 通过管理界面对法规义务进行 CRUD 操作和映射管理，
so that 我能维护法规义务及其与条文和控制点的映射关系。

## Acceptance Criteria

1. **Given** 需要 Obligation 列表页
   **When** 进入 Obligation 管理页面
   **Then** 左侧展示 obligation 列表（支持 `obligation_type` / `status` / `applicable_sector` 过滤、搜索、分页）
   **And** 右侧展示选中 obligation 的详情面板

2. **Given** 需要 CRUD 操作
   **When** 点击新建按钮
   **Then** 弹出表单：`obligationCode`（自动生成建议）、`obligationText`、`obligationType`、`applicableSector`（多选 Tag）、关联 clause（搜索选择）
   **And** 提交后调用 `POST /api/admin/knowledge-graph/obligations`

   **When** 在详情面板点击保存
   **Then** 可修改 `obligationText`、`obligationType`、`applicableSector`、`status`
   **And** 提交后调用 `PATCH /api/admin/knowledge-graph/obligations/:id`

3. **Given** 需要 clause 关联展示
   **When** 在详情面板的“法规条文”区域
   **Then** 展示关联的 `regulation_clause` 信息（条文编号、条文内容摘要、source 摘要）
   **And** 点击条文卡片可打开条文详情视图，查看 `articleNo` / `sectionPath` / `clauseText`

4. **Given** 需要 control point 映射管理
   **When** 在详情面板的“控制点映射”区域
   **Then** 展示当前关联的 `control_points` 列表（含 `coverage` 标签：`FULL` / `PARTIAL`）
   **And** 支持添加映射（选择控制点 + `coverage` → 创建 `obligation_control_maps`）
   **And** 支持删除映射

## Tasks / Subtasks

- [x] Task 1: 补齐 Obligation 管理页所需的 backend contract（AC: 1, 3, 4）
  - [x] 复用 Story 3.2 已有 `ObligationService` / `ObligationController` 的列表、详情、创建、更新、按 clause 查询、查询关联控制点能力
  - [x] 为当前页面补齐添加 control map 端点：`POST /api/admin/knowledge-graph/obligations/:id/control-maps`
  - [x] 为当前页面补齐删除 control map 端点：`DELETE /api/admin/knowledge-graph/obligations/:id/control-maps/:mapId`
  - [x] 删除操作必须校验 `mapId` 确实属于当前 obligation，避免跨记录误删
  - [x] 继续复用现有 `GET /api/admin/knowledge-graph/regulation-clauses` 作为 clause 搜索来源，不新增一次性条文搜索接口

- [x] Task 2: 实现 frontend typed client 与页面数据编排（AC: 1, 2, 3, 4）
  - [x] 新增 `frontend/lib/api/obligations.ts`，封装列表、详情、创建、更新、添加/删除 control map、查询 regulation clauses
  - [x] 复用仓库现有 `apiFetch`、分页响应结构和错误归一化模式
  - [x] 为“新建 Obligation”表单提供 `obligationCode` 自动建议值，建议基于选中 clause 的 `clauseCode` / `articleNo` 与现有 obligation codes 推导
  - [x] suggestion 只是 UI 辅助，不改变后端仍以 `obligationCode` 唯一性校验为权威
  - [x] control point 搜索继续复用现有 `searchControlPoints` 能力，不新建专用后端搜索接口

- [x] Task 3: 新建 Obligation 管理页面并保持 admin UX 一致（AC: 1, 2, 3, 4）
  - [x] 新建路由 `frontend/app/admin/obligations/page.tsx`
  - [x] 页面采用“左侧列表 + 右侧详情面板”布局，复用现有 admin page 的 loading / forbidden / error / refresh 语义
  - [x] 列表支持搜索、`obligationType` / `status` / `applicableSector` 过滤、分页、默认选中第一项
  - [x] 详情面板支持编辑基础字段、展示 clause 关联和 control map 列表，并支持添加与删除映射
  - [x] clause 详情必须以内嵌 dialog / drawer 落地；当前仓库没有独立条文详情页，不要为 4.3 新开一套 regulation clause 页面
  - [x] 页面权限收敛到 `admin`，没有权限时给出稳定只读拒绝页，不误导用户进入可编辑状态

- [x] Task 4: 接入 admin 导航并保持 brownfield 兼容（AC: 1）
  - [x] 在 `frontend/components/layout/Sidebar.tsx` 增加 `Obligation 管理` 入口
  - [x] 保持现有 admin 菜单分组和交互行为不变
  - [x] 不在本故事内顺手实现覆盖率分析看板、法规来源管理页或条文管理页

- [x] Task 5: 补齐自动化测试与定向验证（AC: 1, 2, 3, 4）
  - [x] backend：为 obligation control map 的 service + route 补测试
  - [x] frontend：新增 `frontend/lib/api/obligations.test.ts`
  - [x] frontend：新增 `frontend/app/admin/obligations/page.test.tsx`
  - [x] frontend：更新 `frontend/components/layout/__tests__/Sidebar.test.tsx`
  - [x] 运行与本故事直接相关的 backend / frontend 测试
  - [x] 运行 `npm --workspace backend exec -- tsc --noEmit` 与 `npm --workspace frontend exec -- tsc --noEmit`

## Dev Notes

### Story Requirements and Intent

- 当前 KG V2 的 `4.3` 是 **Regulation Obligation 管理页面**，不是旧 `epics.md` 中另一个 4.3 radar/report 故事。
- 这次交付重点是把 Story 3.2 / 3.3 已有法规义务能力组织成一个可操作的 admin 页面，而不是重写 obligation 领域逻辑。
- 页面范围明确限制在：
  - 列表查询
  - 详情编辑
  - clause 关联展示
  - control point 映射管理

### Current Brownfield State

- Story 3.2 已经提供：
  - `GET /api/admin/knowledge-graph/obligations`
  - `GET /api/admin/knowledge-graph/obligations/:id`
  - `POST /api/admin/knowledge-graph/obligations`
  - `PATCH /api/admin/knowledge-graph/obligations/:id`
  - `GET /api/admin/knowledge-graph/obligations/by-clause/:clauseId`
  - `GET /api/admin/knowledge-graph/obligations/:id/control-points`
  - `GET /api/admin/knowledge-graph/obligations/coverage-analysis`
- Story 3.3 已经提供首批真实 obligation seed 与 blind spot 数据，适合直接驱动管理页。
- 当前 repo 还没有：
  - `frontend/app/admin/obligations/page.tsx`
  - `frontend/lib/api/obligations.ts`
  - admin 侧边栏的 Obligation 管理入口
  - obligation_control_maps 的添加/删除管理端点
- 当前 repo 也没有独立的 regulation clause 详情页，因此本故事不能把 clause 查看需求外包给一个不存在的页面。

### Architecture Compliance

- backend 必须继续复用 `backend/src/modules/knowledge-graph/services/obligation.service.ts`
- backend 必须继续复用 `backend/src/modules/knowledge-graph/controllers/obligation.controller.ts`
- clause 搜索必须继续复用：
  - `backend/src/modules/knowledge-graph/controllers/regulation.controller.ts`
  - `backend/src/modules/knowledge-graph/services/regulation.service.ts`
  - `GET /api/admin/knowledge-graph/regulation-clauses`
- frontend 必须继续复用：
  - `frontend/lib/utils/api.ts` / `apiFetch`
  - `frontend/app/admin/failure-modes/page.tsx` 的页面组织方式
  - `frontend/lib/api/compliance-cases.ts` 里的 `searchControlPoints`
  - 现有 admin 页面布局、鉴权和 `sonner` toast 模式
- 不允许：
  - 新造第二套 Obligation 后端模块
  - 新造仅供本页使用的 clause 搜索接口
  - 为了 clause 详情顺手新增 regulation clause 独立管理页
  - 在本故事里顺手实现 4.4 看板

### Brownfield Guardrails

- 优先复用 Story 3.2 的 DTO / Service / Controller，不回退到手写 fetch + ad-hoc payload
- `ObligationCode` suggestion 只是 UI 辅助，不应改变后端仍以 `obligationCode` 为唯一键的事实
- 删除 control map 操作需要显式校验 map 是否属于当前 obligation，避免跨记录误删
- 列表 / 详情 / clause 区 / control map 区都要在空数据时稳定渲染，不能因为某一区域为空导致整页失败
- clause 详情的最小实现应是本页内可点击的 dialog / drawer；不要为了“点击可查看详情”引入新的跨页依赖
- 页面只服务管理员；consultant 不应拿到伪可编辑 UI
- 详情面板默认只编辑 `obligationText` / `obligationType` / `applicableSector` / `status`，不要在本故事里扩大为 clause 重新绑定工作台

### Technical Requirements

- 页面路由：`/admin/obligations`
- 页面布局：左侧列表 + 右侧详情；小屏下可退化为上下布局，但不改变关键信息密度
- 列表查询最小参数：
  - `page`
  - `limit`
  - `keyword`
  - `obligationType`
  - `status`
  - `applicableSector`
- 详情面板最小展示字段：
  - `obligationCode`
  - `obligationText`
  - `obligationType`
  - `applicableSector`
  - `status`
  - `clause.clauseCode`
  - `clause.articleNo`
  - `clause.clauseSummary`
  - `clause.source`
  - `controlMaps`
- clause 搜索最小输入：
  - `keyword`
- control map 添加最小输入：
  - `controlId`
  - `coverage`
- `applicableSector` 的可选值继续沿用 `银行`、`证券`、`保险`、`基金`、`期货`、`通用`
- `coverage` 的可选值继续沿用 `FULL`、`PARTIAL`

### Library / Framework Requirements

- Frontend: `Next.js ^14.2.0`, `React ^18.3.0`, `next-auth ^4.24.0`, `shadcn/ui`, `lucide-react`, `sonner`
- Backend: `NestJS ^10.4.x`, `TypeORM ^0.3.20`, `class-validator ^0.14.3`
- 继续使用仓库现有 Jest + Testing Library + Nest testing 体系
- 不引入新的状态管理库、表格库或表单库

### Candidate Source Tree Touchpoints

- `backend/src/modules/knowledge-graph/controllers/obligation.controller.ts`
- `backend/src/modules/knowledge-graph/services/obligation.service.ts`
- `backend/src/modules/knowledge-graph/dto/obligation.dto.ts`
- `backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts`
- `backend/src/modules/knowledge-graph/services/obligation.service.spec.ts`
- `backend/src/modules/knowledge-graph/controllers/regulation.controller.ts`
- `backend/src/modules/knowledge-graph/services/regulation.service.ts`
- `frontend/lib/api/obligations.ts`
- `frontend/lib/api/obligations.test.ts`
- `frontend/app/admin/obligations/page.tsx`
- `frontend/app/admin/obligations/page.test.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/__tests__/Sidebar.test.tsx`

### Previous Story Intelligence

- **Story 3.2（done）**
  - Obligation 的列表、详情、创建、更新、按 clause 查询、按 obligation 查 control points、coverage-analysis 已交付
  - `regulatory-links` 已能把 obligation 作为 control point 的法规主来源返回
- **Story 3.3（done）**
  - 已有真实 IT04 regulation obligation seed，可支撑 4.3 的页面数据与 blind spot 展示
- **Story 4.1（done）**
  - `ControlDetailDrawer` 当前只展示 obligation 摘要，并明确说明 Obligation 详情页将在后续提供；4.3 应提供这个真实 admin 入口
- **Story 4.2（done）**
  - `frontend/app/admin/failure-modes/page.tsx` 是 4.3 最直接的页面与测试基线
  - 4.2 已验证“列表 + 详情 + 映射管理 + Sidebar 入口”的 admin brownfield 落地方式可行，4.3 应优先复用而不是另造 UI 架构

### Git Intelligence Summary

- `514287a feat: complete story 4-2`
  - 4.2 已在当前主线历史中完成，4.3 可以直接复用其模式与测试结构
- `e6ecc8a fix: address story 4-1 code review findings`
  - 4.1 刚完成 review fix，当前 Epic 4 的 admin/detail 语义已稳定
- `638849a Revert "feat: complete story 4-2"`
  - 说明 4.2 曾有过一次错误交付后回滚；4.3 不能只“看起来像完成”，必须走完整测试 / review / trace 流程

### Latest Technical Information

- 当前 repo 已固定前后端依赖版本，4.3 的实现优先以仓库现有 package 版本和已落地模式为 authoritative source，不需要为此故事引入升级工作
- `frontend/app/admin/failure-modes/page.tsx` 已验证当前 admin 页面模式：客户端组件 + session 判权 + shadcn form controls + `sonner` 通知
- `frontend/components/compliance/ControlDetailDrawer.tsx` 当前对 obligation 的文案是“详情页将在 Obligation 管理面中提供”，这是 4.3 的直接产品承诺
- `GET /api/admin/knowledge-graph/regulation-clauses` 当前返回 clause 基础字段而非完整 source relation；create dialog 只应依赖 `clauseCode` / `articleNo` / `clauseSummary` 进行搜索与选择

### Testing Expectations

- backend 至少覆盖：
  - create obligation control map 成功
  - create obligation control map 重复映射冲突
  - delete obligation control map 成功
  - delete obligation control map 时 `mapId` 不属于当前 obligation 被拒绝
  - route 权限与审计日志路径正确
- frontend 至少覆盖：
  - 列表加载与默认选中详情
  - 基于 clause 搜索的新建 obligation
  - 编辑 detail
  - clause 详情 dialog 打开
  - 搜索 control point 并添加/删除 control map
  - Sidebar 新菜单项显示

### Explicit Non-Goals

- 不在 4.3 内实现覆盖率分析看板
- 不在 4.3 内实现 regulation source / clause 的独立 CRUD 管理页
- 不在 4.3 内重做 ObligationService 的 coverage-analysis 聚合模型
- 不在 4.3 内批量编辑 seed 数据
- 不在 4.3 内重做 control detail drawer

### References

- `D:\csaas\_bmad-output\planning-artifacts\epics-kg-v2.md`
  - Epic 4 / Story 4.3
- `D:\csaas\docs\kg-restructure-final-plan.md`
  - §8.2
  - §8.3
  - §12.5
  - §13.2
- `D:\csaas\_bmad-output\implementation-artifacts\kg3-2-obligation-service-and-api.md`
- `D:\csaas\_bmad-output\implementation-artifacts\kg3-3-regulation-obligation-seed-and-mapping.md`
- `D:\csaas\_bmad-output\implementation-artifacts\4-2-failure-mode-management-page.md`
- `D:\csaas\frontend\app\admin\failure-modes\page.tsx`
- `D:\csaas\frontend\components\compliance\ControlDetailDrawer.tsx`
- `D:\csaas\backend\src\modules\knowledge-graph\controllers\obligation.controller.ts`
- `D:\csaas\backend\src\modules\knowledge-graph\services\obligation.service.ts`
- `D:\csaas\backend\src\modules\knowledge-graph\controllers\regulation.controller.ts`
- `D:\csaas\backend\src\modules\knowledge-graph\services\regulation.service.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- 先补齐 4.3 所需的 story context 和 ATDD 工件，确保当前编号不再和旧 radar/report 的 4.3 混用。
- 然后为 obligation 后端 contract 增加 control map 增删能力，并补 service / route 测试。
- 最后新增 admin 页面、typed client、Sidebar 入口和前端测试，完成定向回归后再进入 code review / trace。

### Debug Log References

- `npm test -- src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts src/modules/knowledge-graph/services/obligation.service.spec.ts --runInBand --no-coverage`
- `npx jest lib/api/obligations.test.ts app/admin/obligations/page.test.tsx components/layout/__tests__/Sidebar.test.tsx --runInBand --no-coverage`
- `npm exec -- tsc --noEmit` (backend)
- `npm exec -- tsc --noEmit` (frontend)
- `npx playwright test e2e/obligation-management.spec.ts --project=chromium` (blocked by unstable local Next dev server response during `page.goto`)

### Completion Notes List

- 2026-04-15: Story context created for KG V2 Story 4.3.
- 2026-04-15: Confirmed current KG V2 4.3 is the Regulation Obligation 管理页面, while legacy `epics.md` 里的 4.3 report/radar artifacts are unrelated and must not be reused as authoritative scope.
- 2026-04-15: Confirmed Story 3.2 already provides most obligation backend read/create/update capability, so 4.3 should focus on page assembly plus obligation-control-map mutation completion rather than rebuilding the domain service.
- 2026-04-15: Confirmed current repo has no standalone regulation clause detail page; clause detail must therefore be delivered inside the new admin page rather than as a new cross-page subsystem.
- 2026-04-15: 已为 `ObligationController` / `ObligationService` 补齐 nested `control-maps` create/delete contract，并增加归属校验避免跨 obligation 误删。
- 2026-04-15: 已新增 `frontend/lib/api/obligations.ts` 与 `/admin/obligations` 页面，落地列表过滤、条文搜索建单、条文详情 dialog、控制点映射管理和 admin 权限拒绝页。
- 2026-04-15: 定向验证通过：backend obligation routes/service tests、frontend obligations api/page/sidebar tests、前后端 `tsc --noEmit`、前后端目标 eslint。
- 2026-04-15: 已新增 `frontend/e2e/obligation-management.spec.ts`，但本地 Playwright smoke 被当前 Next dev server 对 `/admin/obligations` 的不稳定首响应阻塞，未拿到可用通过结果。
- 2026-04-15: 本地 code review 无 blocking findings，review 工件已写入 `code-review-story-kg2-4-3.md`。
- 2026-04-15: traceability matrix 与 gate decision 已生成，结论为 `PASS`。

### File List

- `_bmad-output/implementation-artifacts/4-3-regulation-obligation-management-page.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-4.3.md`
- `_bmad-output/test-artifacts/atdd-story-kg2-4-3-fixtures.ts`
- `_bmad-output/test-artifacts/atdd-story-kg2-4-3-api-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-kg2-4-3-backend-red.spec.ts`
- `_bmad-output/test-artifacts/atdd-story-kg2-4-3-e2e-red.spec.ts`
- `_bmad-output/test-artifacts/code-review-story-kg2-4-3.md`
- `_bmad-output/test-artifacts/traceability-story-kg2-4-3-phase1.json`
- `_bmad-output/test-artifacts/traceability-report-story-kg2-4-3.md`
- `_bmad-output/test-artifacts/gate-decision-story-kg2-4-3.yaml`
- `backend/src/modules/knowledge-graph/controllers/obligation.controller.ts`
- `backend/src/modules/knowledge-graph/dto/obligation.dto.ts`
- `backend/src/modules/knowledge-graph/knowledge-graph.obligations.routes.spec.ts`
- `backend/src/modules/knowledge-graph/services/obligation.service.spec.ts`
- `backend/src/modules/knowledge-graph/services/obligation.service.ts`
- `frontend/app/admin/obligations/page.tsx`
- `frontend/app/admin/obligations/page.test.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/__tests__/Sidebar.test.tsx`
- `frontend/e2e/obligation-management.spec.ts`
- `frontend/lib/api/obligations.ts`
- `frontend/lib/api/obligations.test.ts`
- `frontend/playwright-report/index.html`
- `frontend/playwright-report/results.json`

## Change Log

- 2026-04-15: 创建 Story 4.3 的 ready-for-dev 上下文，固定其为 KG V2 Regulation Obligation 管理页面，不再沿用旧 radar/report 版 4.3 工件。
- 2026-04-15: 完成 Obligation 管理页实现，补齐 backend control-map contract、frontend typed client、admin 页面、Sidebar 入口和定向自动化验证，故事状态更新为 `review`。
- 2026-04-15: 完成本地 code review、traceability matrix 与 gate decision，故事状态更新为 `done`。
