# Story 11.4: 推送详情接入 KG 控制点上下文

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Radar 推送历史用户，
I want 在查看某条推送详情时直接打开关联控制点的 explain drawer，
so that 我可以从“这条消息为什么重要”直接跳到“它关联了哪个控制点、该看哪些条款和整改项”。

## Source References

- Parent PRD `V1-F06`
- Epic 11 `KG 关联推送与历史闭环`
- Blocked-by / upstream:
  - Epic 7.1 `unified control context exposure`
  - Epic 7.2 `radar page control detail drawer`
- Existing artifacts:
  - `backend/src/modules/compliance-intelligence/services/radar-relevance-enhanced.service.ts`
  - `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `frontend/app/radar/history/components/PushDetailModal.tsx`
  - `frontend/components/compliance/ControlDetailDrawer.tsx`
  - `frontend/lib/api/radar.ts`

## Minimum Viable Scope

- Radar push detail API 返回真实的 `matchedControls/controlId`
- 上下文来源以 push detail 为准，不在历史列表首屏做全量 control matching
- 历史弹窗在打开时拉 detail payload
- 当存在关联控制点时，弹窗内暴露“查看控制点详情”入口
- 点击后使用 `ControlDetailDrawer` 打开 explain

## Acceptance Criteria

1. **Given** 某条推送存在可识别的关联控制点
   **When** 调用 `GET /api/radar/pushes/:id`
   **Then** 返回 payload 包含真实的 `matchedControls`
   **And** `controlId` 与 `matchedControls` 保持一致

2. **Given** 用户在 `/radar/history` 打开推送详情弹窗
   **When** detail payload 含有 `matchedControls`
   **Then** 弹窗显示控制点入口
   **And** 用户可以选择并打开 `ControlDetailDrawer`

3. **Given** 某条推送没有匹配到控制点
   **When** 打开详情弹窗
   **Then** 弹窗不显示控制点入口
   **And** 其他详情与反馈功能保持正常

4. **Given** radar relevance 计算异常或内容不存在
   **When** 获取 push detail
   **Then** API 回退为显式空 control context
   **And** 不影响推送详情主内容的展示

## Tasks / Subtasks

- [x] Task 1: 补 detail API 的 control context 解析（AC: 1, 4）
  - [x] 复用 `RadarRelevanceEnhancedService`
  - [x] detail route 失败时回退空上下文
- [x] Task 2: 接 history detail 弹窗与 drawer（AC: 2, 3）
  - [x] 打开弹窗时拉 detail payload
  - [x] 有 matchedControls 时显示入口并打开 drawer
- [x] Task 3: 补自动化测试（AC: 1, 2, 3, 4）
  - [x] controller/detail route spec
  - [x] history modal component test

## Dev Notes

### Story Requirements and Intent

- 11.4 不应该把历史列表首屏变成“20 次 radar relevance 计算”，应把昂贵的 control matching 延迟到 detail 级别。
- 这里的目标不是重写 control matching，而是把 `RadarRelevanceEnhancedService` 的结果映射到 push detail contract。
- 前端入口要建立在已有 `ControlDetailDrawer` 之上，不再新造一套 explain UI。

### Brownfield Guardrails

- 不改动历史列表接口的分页/筛选 contract
- 不破坏 tech / industry / compliance 现有 detail modal 行为
- detail route 失败时必须退回空上下文，而不是整体报错

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: `GET /api/radar/pushes/:id` 已接 `RadarRelevanceEnhancedService`，返回真实 matched controls。
- 2026-03-31: detail route 现在按 `tenantId + organizationId` 双重过滤，避免跨组织读取 push detail。
- 2026-03-31: history `PushDetailModal` 打开时会按需拉 detail payload，并在有 matched controls 时打开 `ControlDetailDrawer`。
- 2026-03-31: radar relevance 失败时 detail route 显式回退为空上下文，不影响详情主内容展示。
- 2026-03-31: backend / frontend 定向测试与双端 build 均通过；code review / traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/11-4-push-detail-control-context-integration.md`
- `_bmad-output/implementation-artifacts/11-4-push-detail-control-context-integration-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-11-4.md`
- `_bmad-output/test-artifacts/code-review-story-11-4.md`
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
- `backend/src/modules/radar/radar.module.ts`
- `frontend/app/radar/history/components/PushDetailModal.tsx`
- `frontend/app/radar/history/components/PushDetailModal.test.tsx`
