---
title: 'story 8.1 test quality findings remediation'
type: 'refactor'
created: '2026-05-01T00:00:00+08:00'
status: 'done'
baseline_commit: '7621eae979ac407bd73388613d7685bcc8448399'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/8-1-rollout-overview-readonly-control-plane-visibility.md'
  - '{project-root}/_bmad-output/test-artifacts/test-review.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** story 8.1 的测试套件已经能提供基本回归保护，但仍存在一个会误放过前端误实现的弱 oracle、两份超长 backend service spec，以及整套 story-local 测试缺少统一 stable test ID / priority marker、残留 `ATDD RED` / `RED PHASE` 文案的问题。这些质量债不会立刻让功能失效，但会持续抬高维护和 review 成本，并降低测试是否真正锁住 backend contract 的可信度。

**Approach:** 只在 story 8.1 测试层面做收口，不为了测试去改生产代码语义。具体做法是强化 `page.test.tsx` 的 readiness 断言、为 story 8.1 全套 active tests 统一 stable ID 与 priority marker、清理陈旧 RED-phase 命名，并把两份超长的 backend service spec 按行为边界拆成更聚焦的文件，同时保留现有 coverage 语义与 selective execution 可读性。

## Boundaries & Constraints

**Always:** 测试必须适配现有生产实现而不是反向推动生产代码为测试让路；保留 story 8.1 已有 AC 语义与 network-first / isolation 优点；拆分 spec 时按行为边界拆，不做语义重写；所有 active tests 都要使用统一的 story-local stable ID 和显式优先级；修改后需要通过对应 backend、frontend 和 E2E 定向验证。

**Ask First:** 如果在修复弱 oracle 或拆分 spec 时发现真实 production bug，且必须修改生产代码才能让测试成立；如果现有 dirty worktree 中的 story 8.1 相关未提交改动与本次重构发生直接冲突，导致无法无损衔接。

**Never:** 不删除 story 8.1 测试文件；不跳过 backend / frontend / Playwright 验证；不通过新增仅测试用的生产 DOM 属性、后门逻辑或条件分支来让测试通过；不降低断言强度来换取“更容易绿”；不把本次工作扩展到 story 8.2+ 或无关页面。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| BACKEND_FLAG_ORACLE | `page.test.tsx` 中存在 `rolloutState` 与 backend readiness flag 可故意不一致的 fixture | 测试只能在页面消费 backend `stateAllowsPrimary` / `stateAllowsLegacyFallback` 时通过，若前端回退成按 `rolloutState` 重算则失败 | 如当前页面实际不消费 backend flag，停止并上报为 production bug |
| SPEC_SPLIT_DISCOVERY | `domain-rollout-policy.service.spec.ts` 与 `domain-rollout-policy.service.atdd-8-1.spec.ts` 按行为拆成多个 `*.spec.ts` 文件 | Jest 仍能发现全部测试，且每个新文件都聚焦单一行为簇、长度不再超阈值 | 如拆分后出现共享夹具漂移，抽最小公共 helper，不回退到单大文件 |
| SUITE_METADATA_NORMALIZATION | 6 个 story-local 测试文件存在不一致的标题、priority marker、RED-phase 文案 | 所有 active tests 都具有稳定 story-local ID、显式 `[P0/P1]`，suite title 不再声明 RED/unfinished | 如个别文件的标题结构会影响现有命令筛选，仅做兼容性最强的重命名 |

</frozen-after-approval>

## Code Map

- `backend/src/modules/case-import-orchestrator/controllers/taxonomy-rollout.controller.spec.ts` -- story 8.1 controller-level tests，需清理 RED-phase 命名并补 stable ID
- `backend/src/modules/case-import-orchestrator/taxonomy-rollout.routes.atdd.spec.ts` -- story 8.1 route ATDD，需清理 RED-phase 命名并补 stable ID
- `backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.spec.ts` -- backend behavioral spec，当前过长，需按 bootstrap/readiness/decision logic 拆分
- `backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.atdd-8-1.spec.ts` -- story-local service ATDD，当前过长，需按 list/detail/readiness 行为簇拆分
- `backend/src/modules/case-import-orchestrator/testing/taxonomy-rollout-policy.atdd.fixtures.ts` -- 现有共享夹具，拆分后优先复用，避免重新造测试数据
- `frontend/app/admin/taxonomy-rollout/page.test.tsx` -- RTL page test，存在弱 readiness oracle 且缺少 stable ID / priority marker
- `frontend/e2e/admin/taxonomy-rollout.atdd-8-1.spec.ts` -- Playwright story-local suite，已有稳定交互模式，需统一 title metadata

## Tasks & Acceptance

**Execution:**
- [x] `frontend/app/admin/taxonomy-rollout/page.test.tsx` -- 把 readiness 用例改成只能由 backend flag 解释通的 fixture，并为全部 tests 补 stable ID / priority marker -- 修复最高优先级的弱 oracle，同时统一前端 story-local 测试元数据
- [x] `frontend/e2e/admin/taxonomy-rollout.atdd-8-1.spec.ts` -- 统一所有 active Playwright tests 的 stable ID / priority marker，并保持 network-first mocking 与现有断言语义不退化 -- 提升 selective execution 与长期可追踪性
- [x] `backend/src/modules/case-import-orchestrator/controllers/taxonomy-rollout.controller.spec.ts` 和 `backend/src/modules/case-import-orchestrator/taxonomy-rollout.routes.atdd.spec.ts` -- 去掉 suite/title 中的 `ATDD RED` / `RED PHASE` 表述，补统一 stable ID / priority marker -- 清理“未完成脚手架”假信号并统一 story-local metadata
- [x] `backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.spec.ts` -- 拆成若干 focused behavioral specs，并保留 bootstrap defaults、ownership normalization、transition validation、readiness summary、resolvePolicyDecision 覆盖 -- 把超长行为 spec 切回可 review、可定位失败的粒度
- [x] `backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.atdd-8-1.spec.ts` -- 拆成若干 focused story-local ATDD specs，并复用现有 fixture / helper -- 降低未来 8.x 扩展时继续堆积到单文件的风险
- [x] `backend/src/modules/case-import-orchestrator/testing/taxonomy-rollout-policy.atdd.fixtures.ts` 或最小新增 helper 文件 -- 仅在拆分后有明显重复时抽取最小共享构件 -- 避免为了 DRY 引入新的测试基础设施复杂度

**Acceptance Criteria:**
- Given `page.test.tsx` 使用与 `rolloutState` 可冲突的 readiness fixture, when 测试执行, then ready / not-ready 断言只能由 backend readiness flags 满足，前端按 `rolloutState` 重算会导致失败。
- Given story 8.1 六个 active test files, when 读取 suite 与 test 标题, then 不再存在 `ATDD RED` / `RED PHASE` 文案，且每条 active test 都带有稳定 story-local test ID 与 `[P0/P1]` 优先级。
- Given backend service behavioral 与 service ATDD 覆盖被拆分, when 运行相关 Jest specs, then 原有 story 8.1 和 service 关键行为仍被覆盖，且每个新 spec 文件都控制在可维护长度内。

## Spec Change Log

## Design Notes

本次不是“补更多测试”，而是提升已有测试的信号质量和维护结构。拆分 backend service specs 时优先按行为边界而不是按文件层级机械切割，例如把 bootstrap/readiness 与 decision logic 分开，而不是随意一半一半拆。stable ID 建议统一沿用 `8.1-<LAYER>-<NNN>` 形式，例如 `8.1-CTRL-001`、`8.1-ROUTE-003`、`8.1-SVC-005`、`8.1-RTL-001`、`8.1-E2E-010`，这样在 review、trace、selective execution 和后续 retro 中都能稳定引用。

## Verification

**Commands:**
- `npm --workspace backend run test -- src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.spec.ts src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.decision.spec.ts src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.atdd-8-1.spec.ts src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.readiness.atdd-8-1.spec.ts --runInBand` -- expected: story 8.1 service behavioral/ATDD 拆分后的相关 Jest specs 全绿
- `npm --workspace backend run test -- src/modules/case-import-orchestrator/controllers/taxonomy-rollout.controller.spec.ts src/modules/case-import-orchestrator/taxonomy-rollout.routes.atdd.spec.ts --runInBand` -- expected: controller 与 route story-local tests 全绿
- `npm --workspace frontend run test -- app/admin/taxonomy-rollout/page.test.tsx --runInBand` -- expected: RTL page tests 在强化 oracle 后仍全绿
- `npm --workspace frontend run test:e2e:chromium -- e2e/admin/taxonomy-rollout.atdd-8-1.spec.ts` -- expected: story 8.1 Playwright suite 全绿

## Suggested Review Order

**Oracle Hardening**

- Adversarial fixture now breaks rollout-state and fallback-derived summary regressions.
  [`page.test.tsx:95`](../../frontend/app/admin/taxonomy-rollout/page.test.tsx#L95)

- E2E readiness data now proves backend flags, not client recompute, drive counts.
  [`taxonomy-rollout.atdd-8-1.spec.ts:18`](../../frontend/e2e/admin/taxonomy-rollout.atdd-8-1.spec.ts#L18)

- Navigation assertion now verifies the actual route change instead of button visibility.
  [`taxonomy-rollout.atdd-8-1.spec.ts:345`](../../frontend/e2e/admin/taxonomy-rollout.atdd-8-1.spec.ts#L345)

**HTTP Contract Guarding**

- Controller 404 test now exercises a valid-but-missing domain instead of format rejection.
  [`taxonomy-rollout.controller.spec.ts:209`](../../backend/src/modules/case-import-orchestrator/controllers/taxonomy-rollout.controller.spec.ts#L209)

- Route contract checks now lock required list/detail fields and evidence payload shape.
  [`taxonomy-rollout.routes.atdd.spec.ts:105`](../../backend/src/modules/case-import-orchestrator/taxonomy-rollout.routes.atdd.spec.ts#L105)

- Lowercase and trimmed domain codes now prove normalization before lookup.
  [`taxonomy-rollout.routes.atdd.spec.ts:259`](../../backend/src/modules/case-import-orchestrator/taxonomy-rollout.routes.atdd.spec.ts#L259)

**Suite Restructure**

- Core semantics stay short and reviewable after extracting decision-path coverage.
  [`domain-rollout-policy.service.spec.ts:11`](../../backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.spec.ts#L11)

- Decision-path assertions are isolated so kill-switch and fallback logic review cleanly.
  [`domain-rollout-policy.service.decision.spec.ts:42`](../../backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.decision.spec.ts#L42)

- Story-local list/detail ATDD coverage now reads independently from readiness aggregation.
  [`domain-rollout-policy.service.atdd-8-1.spec.ts:8`](../../backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.atdd-8-1.spec.ts#L8)

- Readiness aggregation and bootstrap defaults are isolated into their own ATDD cluster.
  [`domain-rollout-policy.readiness.atdd-8-1.spec.ts:11`](../../backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.readiness.atdd-8-1.spec.ts#L11)

- Shared repository builders keep the split ATDD suites small without data drift.
  [`domain-rollout-policy.test-helpers.ts:8`](../../backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.test-helpers.ts#L8)

**Verification Trail**

- Spec now records Windows-safe backend and Playwright verification commands.
  [`spec-8-1-fix-test-quality-findings.md:73`](spec-8-1-fix-test-quality-findings.md#L73)
