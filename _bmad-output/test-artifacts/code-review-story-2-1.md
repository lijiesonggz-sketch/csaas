---
workflowType: code-review
storyId: '2.1'
storyKey: '2-1-desktop-advisory-workspace-shell'
reviewMode: full
specFile: 'D:\Csaas\_bmad-output\implementation-artifacts\2-1-desktop-advisory-workspace-shell.md'
reviewDate: '2026-05-19T08:24:14+08:00'
rerunDate: '2026-05-19T08:48:04+08:00'
reviewLayers:
  - blind
  - edge
  - auditor
executionNote: '初次 review 在当前代理内顺序执行；2026-05-19 rerun 按用户明确授权使用三个独立子代理并行执行。'
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

## Rerun With Subagents - 2026-05-19T08:48:04+08:00

### Scope

用户明确要求“可以用子代理，用 `$bmad-code-review` 重新跑 Story 2.1”。本轮按 workflow 的三层并行审查重新执行：

- Blind Hunter：子代理 `019e3da8-05c7-7d63-95c6-145170537029`，只接收 Story 2.1 代码 diff。
- Edge Case Hunter：子代理 `019e3da8-062d-71b0-846b-0330182cb634`，接收 diff 并允许读取相关项目文件。
- Acceptance Auditor：子代理 `019e3da8-06aa-77a1-9b1c-f78e53405728`，接收 diff、story spec 和必要 planning context。

### Raw Layer Results

#### Blind Hunter

- HIGH：`AdvisoryWorkspaceShell` 的 `useState(readDesktopViewport)` 在 SSR 默认桌面、客户端窄屏首次渲染非桌面时可能出现 hydration markup mismatch。
- MEDIUM：文档抽屉按钮呈现为可操作按钮但没有 `onClick`、状态、`aria-expanded` 或 `disabled`。
- MEDIUM：工作流条目看起来可点击但使用非交互 `<div>`，没有键盘支持或点击逻辑。
- MEDIUM：工作流区域作为 `aside` 测试为 complementary，但实际内容也需要导航语义。
- MEDIUM：`useDesktopViewport` 只使用 `addEventListener`，缺少旧版 `addListener` fallback。
- MEDIUM：外层 grid `overflow-hidden`，列内容增长时缺少内部滚动策略。
- Low-confidence：`matchMedia` 缺失时默认桌面三栏不够稳妥。
- Low-confidence：全局 viewport 宽度不等于主内容可用宽度。
- Low-confidence：测试未覆盖抽屉按钮禁用/行为。
- Low-confidence：测试未覆盖 media query change listener。

#### Edge Case Hunter

```json
[
  {
    "location": "frontend/app/advisory/page.tsx:52",
    "trigger_condition": "MainLayout runs where window.matchMedia is unavailable",
    "guard_snippet": "if (typeof window.matchMedia !== 'function') return",
    "potential_consequence": "Advisory page crashes before rendering access state"
  },
  {
    "location": "frontend/components/advisory/AdvisoryWorkspaceShell.tsx:39-40",
    "trigger_condition": "MediaQueryList only supports addListener/removeListener",
    "guard_snippet": "mediaQuery.addEventListener ? mediaQuery.addEventListener('change', update) : mediaQuery.addListener(update)",
    "potential_consequence": "Viewport crossing 1024px leaves stale shell state"
  },
  {
    "location": "frontend/components/advisory/AdvisoryWorkspaceShell.tsx:151-160",
    "trigger_condition": "User activates enabled document drawer button",
    "guard_snippet": "onClick={() => setDrawerOpen(true)}",
    "potential_consequence": "Drawer command appears available but does nothing"
  }
]
```

#### Acceptance Auditor

- 无有效 findings。未发现 Story 2.1 commit `d4f6680` 在限定 diff 中违反 AC1-AC3、scope boundary，或遗漏指定 shell/access/desktop gate 行为。

### Triage

#### Patch - Resolved

1. **Hydration-safe viewport gate**
   - Source: Blind Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: changed desktop state to `boolean | null`, rendering a stable `role="status"` preparation state until the client effect resolves the media query.

2. **`matchMedia` unavailable guard**
   - Source: Edge Case Hunter
   - Location: `frontend/components/layout/MainLayout.tsx`, `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: `MainLayout` now defaults to non-mobile when `matchMedia` is unavailable; advisory shell falls back to the desktop-required state instead of rendering unsupported three-column UI.

3. **MediaQueryList legacy listener fallback**
   - Source: Blind Hunter + Edge Case Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: added `addListener/removeListener` fallback when `addEventListener/removeEventListener` is unavailable.

4. **Document drawer false affordance**
   - Source: Blind Hunter + Edge Case Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: kept the collapsed drawer affordance but disabled the button because live drawer behavior belongs to later stories.

5. **Workflow item pseudo-interaction**
   - Source: Blind Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: converted workflow placeholders to non-interactive list items with subdued `待接入` state and removed chevron affordances.

6. **Workflow navigation semantics**
   - Source: Blind Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: preserved the spec-requested advisory `aside` landmark and added a nested `nav aria-label="咨询工作流"` for the workflow list.

7. **Column overflow handling**
   - Source: Blind Hunter
   - Location: `frontend/components/advisory/AdvisoryWorkspaceShell.tsx`
   - Resolution: constrained shell height and added internal overflow handling to left sidebar and conversation body.

8. **Regression coverage for review findings**
   - Source: Blind Hunter
   - Location: `frontend/app/advisory/__tests__/page.test.tsx`
   - Resolution: added assertions for disabled drawer affordance, runtime media query changes, and unavailable `matchMedia` fallback.

#### Defer

1. **Container width vs viewport width**
   - Source: Blind Hunter low-confidence
   - Reason: Story 2.1 explicitly defines the gate as viewport width below `1024px`; container-query compatibility and browser matrix are owned by Story 2.3.

#### Reject / Noise

- None.

### Verification After Rerun Fixes

- `cd frontend && npm run test -- app/advisory/__tests__/page.test.tsx components/layout/__tests__/MainLayout.test.tsx --runInBand`：PASS
- `cd frontend && npx tsc --noEmit`：PASS
- `git diff --check`：PASS
- `cd frontend && npm run build`：BLOCKED on current rerun by external Google Fonts fetch failures (`Plus Jakarta Sans` / Inter, `ECONNRESET`) in `app/layout.tsx` before application compilation completed. This command had previously completed after transient retries during the Story 2.1 review-fix pass, but the latest two retries failed for the same network reason.
- `cd frontend && npm run test -- --runInBand`：FAIL due to `app/admin/failure-modes/page.test.tsx › adds and removes taxonomy map` not calling `mockDeleteTaxonomyMap`; the same file passes in isolation with `15 passed`. This is recorded as an existing order-dependent/flaky admin test risk, not caused by Story 2.1 advisory/MainLayout changes.

### Rerun Triage Summary

- `intent_gap`: 0
- `bad_spec`: 0
- `patch`: 8 resolved
- `defer`: 1
- `reject/noise`: 0

## Conclusion

结论：**PASS after rerun fixes, with verification exceptions recorded**

Story 2.1 code review rerun 没有剩余 HIGH/MEDIUM/blocking finding。未消除的验证风险有两项：当前 build 被外部 Google Fonts `ECONNRESET` 阻断；无关 admin failure-modes 测试在全量顺序执行中存在 order-dependent 失败且单独运行通过。
