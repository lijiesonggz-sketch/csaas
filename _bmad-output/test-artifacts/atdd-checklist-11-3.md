---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-31T00:00:00+08:00'
workflowType: testarch-atdd
storyId: '11-3'
storyTitle: 邮件通知通道接入 Radar Push
inputDocuments:
  - 'D:\Csaas\_bmad-output\implementation-artifacts\11-3-email-notification-channel-integration.md'
  - 'D:\Csaas\backend\src\modules\admin\clients\email.service.ts'
  - 'D:\Csaas\backend\src\modules\admin\branding\email-template.service.ts'
  - 'D:\Csaas\backend\src\modules\radar\processors\push.processor.ts'
  - 'D:\Csaas\backend\src\modules\radar\services\push-preference.service.ts'
---

# ATDD Checklist - Story 11.3: 邮件通知通道接入 Radar Push

## Step 1 - Preflight and Context

### Stack Detection

- `test_stack_type`: `backend`
- 项目级检测结果：`NestJS + BullMQ + nodemailer`
- Story 级测试焦点：`PushProcessor Dual Channel Delivery + Branded Push Email`

### Prerequisites Check

- EmailService 已具备品牌化邮件发送基础能力：`PASS`
- EmailTemplateService 已有 push notification template：`PASS`
- Organization 已具备 `contactEmail` 字段：`PASS`
- PushPreference 已具备 `relevanceFilter`：`PASS`

### Story Context Summary

- 11.3 的关键是把邮件能力插入已有 push processor，而不是绕开 processor 另起一套 job。
- 单通道成功必须允许：WebSocket 已成功时，邮件失败不能回滚 push。

## Step 2 - Generation Mode

### Chosen Mode

- 模式：`AI generation`
- 原因：
  - 需要同时扩展 EmailService 与 PushProcessor
  - 需要把品牌模板、收件人解析、偏好过滤与失败策略串起来

## Step 3 - Test Strategy

### Primary Test Level

- 主测试层级：`Backend Service + Processor Unit Tests`

### Acceptance Criteria to Scenario Mapping

#### AC1 - 品牌化邮件摘要

1. `[P0][EmailService]` push summary email 使用品牌模板并指向 `/radar/history`
2. `[P0][Processor]` 单组织多条 push 汇总为一封邮件

#### AC2 - relevanceFilter 门槛

3. `[P0][Processor]` `high_only` 时只纳入高相关 push

#### AC3 - 失败重试与单通道成功

4. `[P0][EmailService]` 首次发送失败后自动重试一次
5. `[P0][Processor]` 邮件两次失败时仍保留 WebSocket success / markAsSent

#### AC4 - 无 contactEmail 时跳过

6. `[P1][Processor]` `contactEmail` 为空时不调用 EmailService

## Step 4 - Validation and Completion

### Validation Result

- 当前代码结构适合以 processor 为编排点，EmailService 为渲染发送点，无需新增 queue：`PASS`
- 使用现有 `relevanceFilter` 作为邮件门槛，能避免无 schema 变更情况下继续扩 scope：`PASS`

### Next Step Recommendation

1. 先补 EmailService 的 push summary email 与 retry 逻辑
2. 再把 processor 组织级邮件汇总接上
3. 最后补 service/processor 单测并跑 backend build
