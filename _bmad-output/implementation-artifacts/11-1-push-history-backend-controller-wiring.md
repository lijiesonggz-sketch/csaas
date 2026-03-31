# Story 11.1: 推送历史后端 Controller 接线闭环

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Radar 历史页消费者，
I want 后端通过统一的 controller contract 暴露推送历史、已读、未读数和收藏能力，
so that 前端可以稳定消费现有 `RadarPushService` 能力，而不是继续依赖 controller 内部的半成品仓库查询逻辑。

## Source References

- Parent PRD `V1-F05`, `V1-F06`
- Epic 11 `KG 关联推送与历史闭环`
- `_bmad-output/analysis/kg-v1-unfinished-epics-and-stories-2026-03-26.md`
- `_bmad-output/planning-artifacts/epic-6-11-quality-assessment-2026-03-26.md`
- Existing implementation:
  - `backend/src/modules/radar/controllers/radar-push.controller.ts`
  - `backend/src/modules/radar/services/radar-push.service.ts`
  - `frontend/lib/api/radar.ts`
  - `frontend/app/radar/history/page.tsx`

## Minimum Viable Scope

- `RadarPushController` 不再重复实现历史聚合逻辑，而是复用 `RadarPushService`
- 补齐 `GET /api/radar/pushes/unread-count`
- 让 `PATCH /api/radar/pushes/:id/read` 真正更新已读状态
- 补齐 `POST /api/radar/pushes/:id/bookmark` 收藏/取消收藏接口
- 对历史列表和详情返回统一、稳定的 push DTO，保留 Epic 7 的 control context 字段
- 保证租户与组织隔离继续生效

## Acceptance Criteria

1. **Given** 已登录且具备 tenant / organization 上下文的用户访问推送历史
   **When** 调用 `GET /api/radar/pushes`
   **Then** controller 通过统一 service contract 返回分页、筛选、已读状态和 control context
   **And** 不再保留与 `RadarPushService` 分叉的仓库拼装逻辑

2. **Given** 页面需要展示导航未读角标
   **When** 调用 `GET /api/radar/pushes/unread-count`
   **Then** 接口返回当前 tenant + organization 下未读推送数
   **And** 仅统计 `status = sent` 且 `isRead = false` 的记录

3. **Given** 用户在历史页或详情页查看一条未读推送
   **When** 调用 `PATCH /api/radar/pushes/:id/read`
   **Then** 后端把该推送标记为已读并写入 `readAt`
   **And** 若推送不属于当前 tenant / organization，则返回 `NotFound`

4. **Given** 用户对一条推送执行收藏或取消收藏
   **When** 调用 `POST /api/radar/pushes/:id/bookmark`
   **Then** 后端更新 `isBookmarked`
   **And** 返回当前收藏状态，供前端直接同步

## Tasks / Subtasks

- [x] Task 1: 创建统一的 Radar Push HTTP contract（AC: 1, 2, 3, 4）
  - [x] 明确 controller/service DTO 边界
  - [x] 保留 Epic 7 的 control context 字段
- [x] Task 2: 接线 `getPushHistory` / `getPushDetail` / `markAsRead` / `getUnreadCount` / `bookmark`（AC: 1, 2, 3, 4）
  - [x] controller 改为依赖 `RadarPushService`
  - [x] service 补 bookmark 能力
- [x] Task 3: 补自动化测试（AC: 1, 2, 3, 4）
  - [x] controller spec 覆盖 unread-count / read / bookmark / isolation
  - [x] service spec 覆盖 bookmark 和 DTO 结果

## Dev Notes

### Story Requirements and Intent

- 11.1 不是重写 `RadarPushService`，而是把已存在的历史能力真正接到 controller，并消除 controller / service 双轨实现。
- 历史页已经在 `frontend/lib/api/radar.ts` 中依赖 `GET /api/radar/pushes`、`PATCH /read`、`GET /unread-count`，因此 controller contract 必须向前兼容。
- 收藏字段在 `RadarPush` 实体中已存在，不需要新增表结构。

### Brownfield Guardrails

- 不改动推送调度和 WebSocket 发送主链路
- 不新增数据库 migration
- 不移除现有 control context 协议字段
- 所有接口继续受 `JwtAuthGuard`、`TenantGuard`、`OrganizationGuard` 保护

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: 新增 `GET /api/radar/pushes/history`，将推送历史专用查询正式接到 `RadarPushService`。
- 2026-03-31: 新增 `GET /api/radar/pushes/unread-count`，并让 `PATCH /:id/read` 不再是占位实现。
- 2026-03-31: 新增 `POST /api/radar/pushes/:id/bookmark`，复用既有 `isBookmarked` 字段完成收藏闭环。
- 2026-03-31: history DTO 已补充 `isBookmarked` 与 unified control context 字段，为 Story 11.4 铺路。
- 2026-03-31: backend 定向测试与 backend build 均通过；code review / traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/11-1-push-history-backend-controller-wiring.md`
- `_bmad-output/implementation-artifacts/11-1-push-history-backend-controller-wiring-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-11-1.md`
- `_bmad-output/test-artifacts/code-review-story-11-1.md`
- `backend/src/modules/radar/controllers/radar-push.controller.ts`
- `backend/src/modules/radar/controllers/radar-push.controller.spec.ts`
- `backend/src/modules/radar/dto/push-history.dto.ts`
- `backend/src/modules/radar/services/radar-push.service.ts`
- `backend/src/modules/radar/services/radar-push.service.spec.ts`
