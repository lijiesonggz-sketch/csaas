---
workflowType: code-review
storyId: '2.5'
storyKey: 'kg2-5-it04-benchmark-validation'
reviewMode: full
reviewDate: '2026-04-14T03:10:00+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: '按 bmad-code-review 的三层视角在当前代理内顺序执行；本轮未启用子代理。'
---

# Code Review - Story 2.5

## Scope

- `backend/package.json`
- `backend/scripts/run-it04-benchmark.ts`
- `backend/scripts/validate-it04-benchmark.js`
- `backend/src/modules/case-import-orchestrator/services/it04-benchmark.runner.ts`
- `backend/src/modules/case-import-orchestrator/services/it04-benchmark.runner.spec.ts`
- `backend/src/modules/case-import-orchestrator/testing/it04-benchmark-cases.fixture.json`
- `backend/src/modules/applicability-engine/seeds/data/taxonomy.seed.json`
- `backend/src/modules/applicability-engine/seeds/data/taxonomy-fm-map.seed.json`
- `backend/src/modules/applicability-engine/seeds/data/evidence-type.seed.json`
- `backend/src/modules/applicability-engine/seeds/data/control-evidence-map.seed.json`
- `backend/src/modules/applicability-engine/seeds/kg-seed-data.ts`
- `backend/src/modules/applicability-engine/seeds/kg-seed.service.ts`
- `backend/src/modules/knowledge-graph/services/failure-mode.service.ts`
- `backend/src/modules/knowledge-graph/services/control-point.service.ts`

## Layer Notes

### Blind Hunter

- 关注点：是否为了 benchmark 通过而硬改生产逻辑、是否重新造第二套 KG 链路、是否把 2.5 膨胀成 unrelated feature。
- 结论：本次改动集中在 formal seed 修正、benchmark runner、真实 DB gate、以及暴露出的两个真实 query bug 修复，没有重写业务链路。

### Edge Case Hunter

- 关注点：taxonomy seed 缺口、IT04 多 L2 映射、evidence seed 缺失、fresh DB 下 query-builder 真实执行。
- 结论：fresh gate 已验证 migration + seed + benchmark 可跑；`FailureModeService` 和 `ControlPointService` 的真实 SQL 问题已修复。

### Acceptance Auditor

- 对照故事 AC：
  - 30 case 标注集存在
  - full-chain benchmark 自动化存在
  - fresh DB gate 存在
  - benchmark analysis 给出旧链路废弃判断
- 结论：故事边界内的交付项齐全，且 benchmark gate `25/30` 命中超过 `>=10` 门槛。

## Findings

本轮 review 未保留 blocking findings。

- `intent_gap`: 0
- `bad_spec`: 0
- `patch`: 0
- `defer`: 0
- `reject/noise`: 0

## Residual Risk

1. 当前 benchmark 的 taxonomy 命中依赖 `semantic mapping CSV heuristic`，不是外部生产分类器本体，所以 `5` 个 miss 仍然集中在 taxonomy 入口。
2. `benchmark:it04:fresh` 依赖 Docker。本地/CI 若无 Docker，可运行 unit/regression，但无法完成同等级 gate。

## Conclusion

结论：**Clean review**

2.5 的实现没有发现需要继续回修的 blocker。可以进入 traceability / status 收口阶段。
