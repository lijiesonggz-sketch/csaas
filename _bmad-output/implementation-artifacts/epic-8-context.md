# Epic 8 Context: taxonomy rollout 与 retirement 运营控制台（Follow-up Productization）

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 8 把已经存在于后端和脚本层的 per-domain taxonomy rollout、gate、retirement、rollback、reclassify、backfill control-plane 产品化为真实管理员操作面。它的价值不是新增分类能力，而是让平台管理员在不查库、不跑脚本、不依赖工程师手工介入的情况下，安全地查看状态、发起受控操作并追溯证据，同时保持 Epic 6/7 已有运行时约束和审计边界不被前端绕过。

## Stories

- Story 8.1: Rollout Overview 与只读控制面可见性
- Story 8.2: Gate Evaluation 与 State Transition Console
- Story 8.3: Retirement / Rollback Console
- Story 8.4: Reclassify / Backfill / Report History Console

## Requirements & Constraints

- 运营控制台必须按 domain 工作，禁止用全局开关或一刀切操作替代 per-domain rollout / gate / retirement。
- 本 epic 只做 operator surface 产品化，不新增 classifier、rulebook、runtime profile 建模，也不重写 Epic 6/7 已有 service 逻辑。
- 只读查询必须通过正式 HTTP API 返回当前 rollout policy、normalized readiness summary、ownership metadata、latest evidence/report metadata，不能直接依赖脚本输出或数据库查询。
- mutation 相关能力必须保留既有后端约束，前端不能自行重算 gate、transition 或 retirement 判定逻辑。
- 高风险动作必须具备显式确认、operator 身份、审计记录、machine-readable 结果、blocking reasons 以及在语义适用时的 dry-run first。
- `/admin/control-points` 继续负责 control point 资产治理，`/admin/knowledge-graph` 继续负责 taxonomy source-of-truth 治理；runtime rollout / retirement 必须落在独立页面族，不得继续堆进现有治理页。

## Technical Decisions

- 新增独立的 operator surface：`/admin/taxonomy-rollout` 页面族，覆盖 overview、gates、retirement、recovery 四类工作流。
- `kg_taxonomy_domain_rollout_policies` 是 per-domain rollout policy 的 source of truth，统一承载 rollout state、allowLegacyFallback、primaryThreshold、shadowWindowDays、cutover/retirement thresholds、kill switch 等参数；这些参数不能散落在 story 文本或测试常量里长期维护。
- `backend/src/modules/case-import-orchestrator/services/taxonomy-classification/domain-rollout-policy.service.ts` 负责读取 per-domain policy、暴露只读决策接口，并在写入前做 schema/transition 约束。
- 只读 API 至少包括：
  - `GET /api/admin/knowledge-graph/taxonomy-rollout/policies`
  - `GET /api/admin/knowledge-graph/taxonomy-rollout/policies/:l1Code`
- 后续 mutation API 仍走独立 contract，例如 gates evaluate、transitions、retirement dry-run/execute/rollback、reclassify/backfill、reports。
- UI 不是策略引擎。它只负责读取、发起评估、提交受控命令和展示结果，不能绕过 `validateRolloutTransition()`、`evaluateDomainReadiness()`、retirement prerequisites 或 physical cleanup guards。
- `kill_switch_enabled = true` 时，该 domain 不应进入新链 primary 决策，只允许 legacy fallback、abstain 或 unclassified 语义。

## UX & Interaction Patterns

- Sidebar 需要提供 `Taxonomy Rollout` 一级入口，并与知识图谱相关管理项相邻。
- 用户的推荐操作顺序是：先看 Overview，再去 Gates，再做 Retirement，最后用 Recovery 查看恢复动作与历史；不要把四类能力堆成一个长页面。
- Overview 页面承担只读职责：展示 IT01-IT08 当前 state、fallback、kill switch、version、ownership、thresholds 和 evidence summary，不直接触发高风险 mutation。
- Overview 需要提供关键字、`rolloutState`、`allowLegacyFallback`、`killSwitchEnabled` 过滤；状态颜色应稳定，`killSwitchEnabled=true` 要有醒目标记。
- Gate、Retirement、Recovery 页面中的危险动作必须采用显式危险操作流，而不是轻量单击按钮。

## Cross-Story Dependencies

- Epic 8 硬依赖 Epic 6 提供 rollout / gate / retirement 后端能力和状态机规则。
- Epic 8 硬依赖 Epic 7 提供 governance summary、runtime profile 页面模式与管理端治理上下文。
- Story 8.1 提供只读 overview、导航入口和基础可见性，是 8.2-8.4 的操作前置信息层。
- Story 8.2、8.3、8.4 都必须复用 Story 8.1 建立的 domain 视角和 policy/evidence 展示模型，而不是各自重新定义状态语义。
