---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-04-14T03:12:00+08:00'
workflowType: testarch-trace
storyId: '2.5'
storyTitle: 'IT04 Benchmark 验证'
---

# Traceability Report - Story 2.5: IT04 Benchmark 验证

## Gate Decision: PASS

**Rationale:** 30 个 benchmark case 已构建并执行，`25/30` case 完整命中，超过故事门槛 `>=10`。未命中均为 taxonomy heuristic miss；failure mode / control / evidence 三层无额外缺口。

## Step 1: Context Summary

- **Story ID:** STORY-KG2-2.5
- **Title:** IT04 Benchmark 验证
- **Status:** done
- **Scope:** Backend benchmark runner + KG formal seed correction + fresh DB gate
- **Core Change:** 用真实 KG seed 数据、真实 query services 和 30-case fixture 证明 IT04 新链路可运行，并补齐 benchmark 暴露的 taxonomy/evidence 缺口

## Acceptance Criteria

| AC | Requirement | Priority |
| --- | --- | --- |
| AC1 | 30 个标注案例完成结构化标注 | P0 |
| AC2 | 对每个案例执行 taxonomy -> failure_mode -> control_point -> evidence 链路验证 | P0 |
| AC3 | 至少 10 个案例完整命中，并输出缺口分析报告 | P0 |
| AC4 | 给出旧 `case-theme.utils.ts` 是否可废弃的判断依据 | P1 |

## Production Code & Artifacts

| File | Type | Key Role |
| --- | --- | --- |
| `it04-benchmark.runner.ts` | NEW | 分类、链路执行、聚合、报告生成 |
| `run-it04-benchmark.ts` | NEW | 真实 DB benchmark CLI |
| `validate-it04-benchmark.js` | NEW | fresh DB benchmark gate |
| `it04-benchmark-cases.fixture.json` | NEW | 30 个 IT04 标注案例 |
| `taxonomy.seed.json` | MODIFIED | 补齐 IT04 L2 主数据 |
| `taxonomy-fm-map.seed.json` | MODIFIED | 修正 IT04 failure mode -> taxonomy 映射 |
| `evidence-type.seed.json` | NEW | IT04 hard control evidence 主数据 |
| `control-evidence-map.seed.json` | NEW | IT04 hard control evidence 映射 |
| `kg-seed-data.ts` / `kg-seed.service.ts` | MODIFIED | 读取、校验、seed formal evidence |
| `failure-mode.service.ts` | MODIFIED | 修复真实 DB QueryBuilder 排序 bug |
| `control-point.service.ts` | MODIFIED | 修复真实 DB full-chain query alias bug |

## Test & Verification Evidence

| Evidence | Result |
| --- | --- |
| `it04-benchmark.runner.spec.ts` | PASS |
| `kg-seed-data.spec.ts` | PASS |
| `kg-seed.service.spec.ts` | PASS |
| `case-clustering-chain.service.spec.ts` | PASS |
| `failure-mode.service.spec.ts` | PASS |
| `control-point.service.spec.ts` | PASS |
| `benchmark:it04:fresh` | PASS (`25/30` full-chain hits) |

## Traceability Matrix

| AC | Requirement | Test / Artifact | Coverage | Status |
| --- | --- | --- | --- | --- |
| AC1 | 30 个标注案例存在且字段完整 | `it04-benchmark-cases.fixture.json`, `atdd-checklist-kg2-5.md` | FULL | PASS |
| AC2 | 分类 -> FM -> Control -> Evidence 全链路执行 | `it04-benchmark.runner.ts`, `benchmark:it04:fresh`, `case-clustering-chain.service.spec.ts`, `failure-mode.service.spec.ts`, `control-point.service.spec.ts` | FULL | PASS |
| AC3 | 至少 10 个 case full-chain 命中，并输出缺口报告 | `it04-benchmark-report-2026-04-13_19-01-53.md`, `it04-benchmark-report-2026-04-13_19-01-53.json` | FULL | PASS |
| AC4 | 给出旧链路废弃判断 | `benchmark-analysis-story-2-5.md` | FULL | PASS |

## Gap Analysis

- **Critical gaps (P0):** 0
- **High gaps (P1):** 0
- **Observed misses:** 5 taxonomy misses
- **Miss root cause:** benchmark-local taxonomy heuristic 分类不稳定，而不是 KG chain 数据缺口

## Final Gate Decision

### Criteria Evaluation

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| Dataset size | 30 | 30 | MET |
| Full-chain hits | >= 10 | 25 | MET |
| Missing-case analysis | Required | Delivered | MET |
| Old-chain retirement judgment | Required | Delivered | MET |

### Decision: PASS

故事目标已满足，可标记完成。旧链路仍建议保持 `@deprecated` 而非本故事直接删除。
