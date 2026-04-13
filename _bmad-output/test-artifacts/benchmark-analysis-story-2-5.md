# Benchmark Analysis - Story 2.5: IT04 Benchmark 验证

## Result

- Dataset: `30` IT04 benchmark cases
- Full-chain hits: `25`
- Gate threshold: `10`
- Conclusion: `PASS`

## What Was Validated

1. IT04 taxonomy 主数据补齐后，failure mode 映射不再错误压缩到单一 `IT04-06`。
2. IT04 新 hard controls 已具备 formal evidence seeds，可通过 `findByL2CodeWithFullChain()` 返回 evidence。
3. `FailureModeService` / `CaseClusteringChainService` / `ControlPointService` 在真实 fresh DB 上可串联运行。

## Miss Pattern

本轮 `5` 个 miss 全部属于 `taxonomy` 分类命中不足：

- `IT04-BM-012`
- `IT04-BM-015`
- `IT04-BM-017`
- `IT04-BM-026`
- `IT04-BM-029`

这些 miss 的共同点不是 KG 链路断裂，而是 benchmark 内使用的 `semantic mapping CSV heuristic` 把 case text 误分到了 `IT04-05`。一旦 taxonomy 命中正确，failure mode / control / evidence 三层均可对齐。

## Retirement Judgment

结论：**新 KG 链路已经足以作为后续废弃 `case-theme.utils.ts` 的核心依据，但不建议在本故事里直接删除旧链路。**

判断依据：

1. Fresh DB 下 `25/30` case 完整命中，已显著超过故事要求的 `>=10`。
2. 未命中全部集中在 benchmark-local taxonomy heuristic，而不是 failure mode / control / evidence 数据链。
3. Story 1.6 的旧链路仍然承担“当 `l2Code` 缺失或分类不稳定时的 fallback”职责；在把生产环境 taxonomy 分类完全切换到稳定输入前，直接删除 fallback 风险偏高。

建议：

- 保持 `case-theme.utils.ts` 继续 `@deprecated`。
- 后续如需真正删除旧链路，应先把生产环境 taxonomy 分类输入收敛到稳定来源，再复跑本 benchmark。
