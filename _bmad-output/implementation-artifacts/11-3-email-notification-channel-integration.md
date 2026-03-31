# Story 11.3: 邮件通知通道接入 Radar Push

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Radar 服务订阅用户，
I want 在站内消息之外还能通过品牌化邮件收到新的 Radar 推送摘要，
so that 即使我暂时不在线，也能及时发现重要的技术、行业和合规更新。

## Source References

- Parent PRD `V1-F05`
- Epic 11 `KG 关联推送与历史闭环`
- `_bmad-output/analysis/kg-v1-unfinished-epics-and-stories-2026-03-26.md`
- `_bmad-output/planning-artifacts/epic-6-11-quality-assessment-2026-03-26.md`
- Existing backend capabilities:
  - `backend/src/modules/admin/clients/email.service.ts`
  - `backend/src/modules/admin/branding/email-template.service.ts`
  - `backend/src/modules/admin/branding/admin-branding.service.ts`
  - `backend/src/modules/radar/processors/push.processor.ts`
  - `backend/src/modules/radar/services/push-preference.service.ts`
  - `backend/src/database/entities/organization.entity.ts`

## Minimum Viable Scope

- 复用 `EmailTemplateService.getPushNotificationTemplate()` 与现有品牌渲染能力
- 在 `PushProcessor` 中形成“WebSocket + 邮件”双通道
- 邮件按组织汇总为单封摘要，而不是每条 push 单独发信
- 组织存在 `contactEmail` 时才尝试发信
- 邮件门槛受 `PushPreference.relevanceFilter` 控制
- 邮件失败最多重试一次，但不回滚站内消息成功状态

## Acceptance Criteria

1. **Given** 某组织存在可发送的 Radar 推送，且配置了 `contactEmail`
   **When** `PushProcessor` 完成该组织的站内推送
   **Then** 系统基于品牌模板发送一封推送摘要邮件
   **And** 邮件正文包含推送列表和进入 `/radar/history` 的入口

2. **Given** 组织的 `PushPreference.relevanceFilter = high_only`
   **When** 某条推送相关性低于高相关阈值
   **Then** 该条内容仍可通过站内消息发送
   **But** 不应进入邮件摘要

3. **Given** 邮件服务临时失败
   **When** 第一次发送报错
   **Then** 系统会立即再尝试一次
   **And** 若仍失败，只记录 warning / error
   **And** 不把整条 push 视为发送失败

4. **Given** 组织未配置 `contactEmail`
   **When** 处理该组织推送
   **Then** 系统只发送站内消息
   **And** 不尝试构造邮件

## Tasks / Subtasks

- [x] Task 1: 扩展 EmailService 的 Radar Push 邮件能力（AC: 1, 3）
  - [x] 新增 push summary email 渲染
  - [x] 新增一次重试策略
- [x] Task 2: 在 PushProcessor 接入邮件通道（AC: 1, 2, 3, 4）
  - [x] 组织级汇总邮件 payload
  - [x] relevanceFilter 邮件门槛
  - [x] email failure 不回滚 websocket success
- [x] Task 3: 补自动化测试（AC: 1, 2, 3, 4）
  - [x] EmailService 邮件渲染/重试测试
  - [x] PushProcessor 邮件通道测试

## Dev Notes

### Story Requirements and Intent

- 11.3 不是新建一套邮件基础设施，而是把已有 welcome / branding 邮件链路复用到 radar push。
- 双通道的优先级是：站内消息为主通道，邮件为附加通道；邮件失败不能把 WebSocket 已成功的 push 回滚为失败。
- 偏好控制优先使用现有 `relevanceFilter`，不在本 story 新增 channel-specific 偏好字段。

### Brownfield Guardrails

- 不新增数据库字段或 migration
- 不改动前端消费 contract
- 不让 EmailService 成为 PushProcessor 成败的 hard dependency
- `contactEmail` 以组织级联系人为收件人来源

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-03-31: `EmailService` 新增 `sendRadarPushNotificationSummary`，复用品牌模板渲染 Radar push 邮件摘要。
- 2026-03-31: 邮件发送失败时会自动重试一次，第二次仍失败则抛回 processor 记录 warning。
- 2026-03-31: `PushProcessor` 已按组织聚合邮件摘要，并用 `relevanceFilter` 作为邮件门槛。
- 2026-03-31: 邮件失败不会回滚站内消息链路，`markAsSent` 与 WebSocket 成功仍保持有效。
- 2026-03-31: backend 定向测试与 backend build 均通过；code review / traceability gate 结论 PASS。

### File List

- `_bmad-output/implementation-artifacts/11-3-email-notification-channel-integration.md`
- `_bmad-output/implementation-artifacts/11-3-email-notification-channel-integration-trace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/atdd-checklist-11-3.md`
- `_bmad-output/test-artifacts/code-review-story-11-3.md`
- `backend/src/modules/admin/clients/email.service.ts`
- `backend/src/modules/admin/clients/email.service.spec.ts`
- `backend/src/modules/radar/processors/push.processor.ts`
- `backend/src/modules/radar/processors/push.processor.email.spec.ts`
