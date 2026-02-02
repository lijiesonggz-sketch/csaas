# Story {{epic_num}}.{{story_num}}: {{story_title}}

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a {{role}},
I want {{action}},
so that {{benefit}}.

## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Testing Requirements

#### Unit Tests
- [列出需要单元测试的核心功能和业务逻辑]

#### Integration Tests
- [列出需要集成测试的组件交互]

#### E2E Tests (Playwright)
**如果此故事涉及前端页面功能，必须包含以下内容：**

- **测试场景**：[列出关键用户流程，使用 Given-When-Then 格式]
- **测试优先级**：[标记为 P1/P2]
- **测试覆盖**：
  - [ ] 基础功能测试
  - [ ] 响应式设计测试（桌面端 + 移动端）
  - [ ] 错误处理测试
- **测试文件位置**：`frontend/e2e/[feature-name].spec.ts`
- **参考指南**：`frontend/PLAYWRIGHT_GUIDE.md`
- **测试模式示例**：`frontend/e2e/push-history.spec.ts`

**测试用例模板**：
```typescript
test.describe('[P1] [功能名称] - 基础功能测试', () => {
  test('[P1] 应该能够[具体功能]', async ({ page }) => {
    // GIVEN: [前置条件]
    // WHEN: [执行操作]
    // THEN: [验证结果]
  })
})
```

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
