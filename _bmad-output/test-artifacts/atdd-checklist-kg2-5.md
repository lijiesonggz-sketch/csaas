---
storyId: '2.5'
storyKey: 'kg2-5-it04-benchmark-validation'
workflowType: testarch-atdd
createdAt: '2026-04-14T03:05:00+08:00'
status: complete
---

# ATDD Checklist - Story 2.5: IT04 Benchmark 验证

## Story Intent

- 用 30 个 IT04 标注案例验证 `case -> taxonomy -> failure_mode -> control_point -> evidence` 链路。
- 至少 10 个案例必须完整命中。
- 报告必须解释未命中原因，并给出旧 `case-theme.utils.ts` 是否可废弃的判断依据。

## Acceptance Coverage Plan

| AC | Coverage Strategy | Artifact |
| --- | --- | --- |
| AC1 | 30 个标注案例 fixture，逐案包含 `expectedL2Code` / `expectedFailureModeCodes` / `expectedControlCodes` / `expectedEvidenceCodes` | `backend/src/modules/case-import-orchestrator/testing/it04-benchmark-cases.fixture.json` |
| AC2 | 真实 KG seed + `FailureModeService` + `CaseClusteringChainService` + `ControlPointService.findByL2CodeWithFullChain` 跑端到端 benchmark | `backend/scripts/run-it04-benchmark.ts` |
| AC3 | 自动生成 markdown/json benchmark report，并在 fresh DB 下执行 gate | `backend/scripts/validate-it04-benchmark.js` |
| AC4 | 在 benchmark analysis 中输出“旧链路是否可删除”的判断，并保留 classifier heuristic 风险说明 | `_bmad-output/test-artifacts/benchmark-analysis-story-2-5.md` |

## Red-to-Green Record

1. 先补 formal seed 缺口：
   - IT04 taxonomy L2 主数据不完整。
   - `taxonomy-fm-map.seed.json` 把 IT04 failure mode 错绑到单一 `IT04-06`。
   - IT04 新 hard control points 没有 formal evidence seeds，导致 full-chain evidence 无法验证。
2. 再补 benchmark 自动化：
   - `it04-benchmark.runner.ts` 负责分类、链路执行、聚合和报告输出。
   - `it04-benchmark.runner.spec.ts` 覆盖分类与报告聚合。
3. 最后用 fresh DB gate 证明真实可运行：
   - `npm --workspace backend run benchmark:it04:fresh`

## Execution Evidence

- `npm --workspace backend test -- --runInBand src/modules/applicability-engine/seeds/kg-seed-data.spec.ts src/modules/applicability-engine/seeds/kg-seed.service.spec.ts src/modules/case-import-orchestrator/services/it04-benchmark.runner.spec.ts`
- `npm --workspace backend test -- --runInBand src/modules/case-import-orchestrator/services/case-clustering-chain.service.spec.ts src/modules/knowledge-graph/services/failure-mode.service.spec.ts src/modules/knowledge-graph/services/control-point.service.spec.ts`
- `npm --workspace backend run benchmark:it04:fresh`

## Outcome

- ATDD coverage artifacts created.
- Benchmark gate passed: `25/30` full-chain hits, threshold `>= 10`.
- Remaining misses are taxonomy-classification heuristic misses, not KG chain misses.
