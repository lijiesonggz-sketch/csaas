# Story KG2.5: IT04 Benchmark 验证

Status: done

## Story

As a 合规顾问,
I want 用 IT04 的标注案例集验证案例 -> taxonomy -> failure mode -> control point -> evidence 的完整链路,
So that 我能确认 KG V2 在监管报送场景下的推荐结果具备可解释性与可用准确率。

## Source References

- KG V2 Epic 文档：`_bmad-output/planning-artifacts/epics-kg-v2.md`（Story 2.5）
- 重构方案：`docs/kg-restructure-final-plan.md` §10.4, §15
- IT04 failure mode 参考：`docs/kg-it04-failure-modes-v1.md`
- IT taxonomy 语义映射：`docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv`
- Story 1.6：`_bmad-output/implementation-artifacts/1-6-case-clustering-pipeline-refactor.md`
- Story 2.4：`_bmad-output/implementation-artifacts/kg2-4-new-hard-control-points-and-data.md`
- 相关代码：
  - `backend/src/modules/case-import-orchestrator/services/case-clustering-chain.service.ts`
  - `backend/src/modules/knowledge-graph/services/failure-mode.service.ts`
  - `backend/src/modules/knowledge-graph/services/control-point.service.ts`
  - `backend/src/modules/applicability-engine/seeds/`

## Minimum Viable Scope

- 建立 IT04 benchmark 标注集，至少 30 个案例
- 每个案例至少包含：
  - `caseText`
  - `expectedL2Code`
  - `expectedFailureModeCodes`
  - `expectedControlCodes`
  - `expectedEvidenceCodes` 或等价 evidence 类型期望
- 产出自动化 benchmark 验证脚本或测试
- 输出 benchmark 报告，明确：
  - 至少 10 个案例完整链路命中
  - 未命中案例原因分类
  - 对 taxonomy / FM / control / evidence 各层命中情况的统计

## Acceptance Criteria

1. **Given** 需要标注集
   **When** 准备 IT04 benchmark 数据
   **Then** 30 个典型处罚案例完成结构化标注
   **And** 每个案例至少包含 `taxonomy(l2_code)`、`failure_mode(code)`、`expected control_point(code)`、`expected evidence`

2. **Given** 需要端到端验证
   **When** 对每个标注案例执行完整链路
   **Then** 案例文本 -> IT 分类结果与标注一致
   **And** `taxonomy_failure_mode_maps` 返回的 failure modes 包含标注 failure mode
   **And** `failure_mode_control_maps` 返回的 control points 包含标注 control point
   **And** 控制点证据链返回的 evidence 与标注期望一致或可映射

3. **Given** 需要准确率指标
   **When** 完成 30 个案例验证
   **Then** 至少 10 个案例跑通完整链路（taxonomy -> failure mode -> control point -> evidence 全部命中）
   **And** 输出未命中原因分析
   **And** 产出 benchmark 报告文档

4. **Given** Story 1.6 仍保留旧链路代码
   **When** benchmark 完成
   **Then** 报告能够明确说明新链路是否足以支撑后续废弃 `case-theme.utils.ts`
   **And** 不在本故事里直接删除旧链路，只提供删除判断依据

## Tasks / Subtasks

- [x] Task 1: 准备 IT04 benchmark 标注数据集（AC: 1）
  - [x] 确定 benchmark 数据文件位置与结构
  - [x] 收集并整理 30 个 IT04 典型案例
  - [x] 为每个案例补齐 `expectedL2Code`
  - [x] 为每个案例补齐 `expectedFailureModeCodes`
  - [x] 为每个案例补齐 `expectedControlCodes`
  - [x] 为每个案例补齐 `expectedEvidenceCodes` 或 evidence 类型期望

- [x] Task 2: 实现 benchmark 执行逻辑（AC: 2, 3）
  - [x] 复用现有新链路服务，不重写第二套推理逻辑
  - [x] 编写自动化 benchmark 测试或 runner
  - [x] 输出 per-case 验证结果
  - [x] 输出 aggregate metrics（taxonomy/FM/control/evidence 命中）

- [x] Task 3: 产出 benchmark 报告与缺口分析（AC: 3, 4）
  - [x] 汇总完整链路命中案例数量
  - [x] 分类整理未命中原因
  - [x] 给出是否可以废弃旧链路的判断依据
  - [x] 生成 benchmark 报告文档

- [x] Task 4: 测试与验证（AC: 2, 3, 4）
  - [x] 跑 benchmark 自动化验证
  - [x] 跑相关定向回归测试
  - [x] 确认报告与代码结果一致

## Dev Notes

### Story Requirements and Intent

- 2.5 不是继续造 schema，而是验证 1.6 + 2.3 + 2.4 新链路到底有没有业务可信度。
- 关键不是追求“30/30 全命中”，而是用 30 个标注案例找出真实准确率和缺口分布。

### Brownfield Guardrails

- 必须复用：
  - `case-clustering-chain.service.ts`
  - `FailureModeService`
  - `ControlPointService.findByL2CodeWithFullChain`
  - 2.4 已交付的 formal seed 与 runtime fixture
- 不要做：
  - ❌ 不要为了 benchmark 通过去改生产逻辑硬迎合标注
  - ❌ 不要删除旧链路代码；只在报告中给出是否可删除判断
  - ❌ 不要引入第二套 benchmark 专用控制点映射规则

### Suggested Artifact Targets

- benchmark 数据集：
  - `backend/src/modules/applicability-engine/seeds/data/` 或更合适的 benchmark fixtures 目录
- benchmark 报告：
  - `_bmad-output/test-artifacts/`
- 自动化测试：
  - 优先放在 `backend/src/modules/case-import-orchestrator/` 或 `backend/src/modules/applicability-engine/`

### Quality Gates

- [x] 30 个 benchmark 案例完成标注
- [x] 至少 10 个案例完整链路命中
- [x] 未命中原因分析成文
- [x] benchmark 报告产出
- [x] 给出旧链路是否可废弃的结论依据

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- `npm --workspace backend test -- --runInBand src/modules/applicability-engine/seeds/kg-seed-data.spec.ts src/modules/applicability-engine/seeds/kg-seed.service.spec.ts src/modules/case-import-orchestrator/services/it04-benchmark.runner.spec.ts`
- `npm --workspace backend test -- --runInBand src/modules/case-import-orchestrator/services/case-clustering-chain.service.spec.ts src/modules/knowledge-graph/services/failure-mode.service.spec.ts src/modules/knowledge-graph/services/control-point.service.spec.ts`
- `npm --workspace backend run build`
- `npm --workspace backend run benchmark:it04:fresh`

### Completion Notes List

- 新增 30 个 IT04 标注案例 fixture，并实现 `It04BenchmarkRunner`，用 semantic mapping CSV heuristic 做 taxonomy 预测，再复用 `FailureModeService`、`CaseClusteringChainService` 和 `ControlPointService.findByL2CodeWithFullChain` 执行完整链路。
- benchmark 暴露并修复了两个真实 DB service bug：`FailureModeService` 的 QueryBuilder 排序字段不兼容真实 TypeORM 执行；`ControlPointService.findByL2CodeWithFullChain` 存在重复 alias。
- 补齐 IT04 formal evidence seeds，并扩展 `kg-seed-data.ts` / `kg-seed.service.ts`，使 fresh DB 下的 full-chain evidence 可验证。
- 修正 IT04 taxonomy 主数据与 taxonomy-fm seed 映射，使 IT04 不再错误压缩为单一 `IT04-06`。
- fresh DB benchmark gate 通过：`30` 个案例执行，`25` 个 full-chain hits，超过故事门槛 `>=10`；剩余 `5` 个 miss 全部是 taxonomy heuristic miss，不是 KG chain 缺口。
- 结论：新链路已足以支撑后续废弃旧 `case-theme.utils.ts` 的决策依据，但本故事不直接删除旧 fallback。

### File List

- backend/package.json
- backend/scripts/run-it04-benchmark.ts
- backend/scripts/validate-it04-benchmark.js
- backend/src/modules/applicability-engine/seeds/data/taxonomy.seed.json
- backend/src/modules/applicability-engine/seeds/data/taxonomy-fm-map.seed.json
- backend/src/modules/applicability-engine/seeds/data/evidence-type.seed.json
- backend/src/modules/applicability-engine/seeds/data/control-evidence-map.seed.json
- backend/src/modules/applicability-engine/seeds/kg-seed-data.ts
- backend/src/modules/applicability-engine/seeds/kg-seed-data.spec.ts
- backend/src/modules/applicability-engine/seeds/kg-seed.service.ts
- backend/src/modules/applicability-engine/seeds/kg-seed.service.spec.ts
- backend/src/modules/case-import-orchestrator/services/it04-benchmark.runner.ts
- backend/src/modules/case-import-orchestrator/services/it04-benchmark.runner.spec.ts
- backend/src/modules/case-import-orchestrator/testing/it04-benchmark-cases.fixture.json
- backend/src/modules/knowledge-graph/services/failure-mode.service.ts
- backend/src/modules/knowledge-graph/services/control-point.service.ts
- _bmad-output/test-artifacts/atdd-checklist-kg2-5.md
- _bmad-output/test-artifacts/benchmark-analysis-story-2-5.md
- _bmad-output/test-artifacts/code-review-story-2-5.md
- _bmad-output/test-artifacts/traceability-report-story-2-5.md
- _bmad-output/test-artifacts/it04-benchmark-report-2026-04-13_19-01-53.md
- _bmad-output/test-artifacts/it04-benchmark-report-2026-04-13_19-01-53.json
