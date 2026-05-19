---
workflowType: code-review
storyId: '2.1'
storyKey: '2-1-desktop-advisory-workspace-shell'
reviewMode: full
specFile: 'D:\Csaas\_bmad-output\implementation-artifacts\2-1-desktop-advisory-workspace-shell.md'
reviewDate: '2026-05-19T08:24:14+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: '按 bmad-code-review 的三层视角在当前代理内顺序执行；工具规则不允许主动 spawn sub-agent，且用户要求全自动推进。'
---

# Code Review - Story 2.1

## Scope

审查范围限定在 Story 2.1 的当前实现切片：

- `frontend/app/advisory/page.tsx`
- `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
- `frontend/app/advisory/__tests__/page.test.tsx`
- Story 与 sprint 状态文档同步

## Layer Notes

### Blind Hunter

- 关注点：是否用新 shell 绕过 Story 1.1 access gate、是否引入 runtime/provider/report 功能、是否把路线页变成营销页。
- 结论：未发现 blocker；授权仍由 `fetchThinkTankAccess()` 控制，shell 只负责桌面结构与空态。

### Edge Case Hunter

- 关注点：1024px 边界、窄屏是否渲染破碎三列、access denied 是否泄露 workspace UI、`matchMedia` 缺失时是否有稳定默认。
- 结论：核心边界已有测试和实现覆盖；发现一处测试覆盖缺口。

### Acceptance Auditor

- 对照 AC1-AC3 与任务清单：
  - AC1：CSAAS frame、左 advisory sidebar、中央 conversation area、右 collapsed drawer 已实现。
  - AC2：`(min-width: 1024px)` gate 与窄屏提示已实现。
  - AC3：没有引入 gamification、庆祝态、decorative AI hero 或 workflow runtime。
- 结论：实现符合 Story 2.1 范围；仅需补齐 document drawer landmark 的 smoke assertion。

## Findings

### Patch

1. **补齐右侧文档抽屉 landmark 的 smoke coverage**
   - 位置：`frontend/app/advisory/__tests__/page.test.tsx`
   - 证据：测试已断言 collapsed drawer button，但未断言 `aria-label="咨询文档抽屉"` 的 complementary region。
   - 处理：已补充 `screen.getByRole('complementary', { name: '咨询文档抽屉' })` 断言。

## Verification After Fix

- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx --runInBand`：PASS
- `cd frontend && npx tsc --noEmit`：PASS

## Triage Summary

- `intent_gap`: 0
- `bad_spec`: 0
- `patch`: 1 resolved
- `defer`: 0
- `reject/noise`: 0

## Conclusion

结论：**PASS after patch**

Story 2.1 code review 没有剩余 HIGH/MEDIUM/blocking finding，可以进入 traceability gate。
