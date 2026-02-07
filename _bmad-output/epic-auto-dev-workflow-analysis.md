# EPIC 自动化开发工作流完整流程分析

## 概述

**菜单4: 自动化 EPIC 开发(完整周期)** 是 BMad 系统中最核心的自动化工作流，它能够完全自动化地执行整个 EPIC 的开发生命周期，从故事创建到代码审查，实现端到端的自动化开发。

**工作流位置**: `_bmad/bmm/workflows/4-implementation/epic-auto-dev/`

**核心文件**:
- `instructions.xml` - 主工作流执行逻辑
- `workflow.yaml` - 配置、变量和子工作流路径

## 核心设计理念

### 1. 质量优先策略
- **不因 token 限制而简化**: `quality_first: true`
- **自动修复循环**: 每个关键步骤都有最多2次的自动修复迭代
- **隔离上下文**: 每个子步骤使用 `invoke-task` 创建独立 subagent，确保干净的上下文

### 2. 完全自动化
- **无需人工干预**: 除非遇到错误或 EPIC 完成，否则持续运行
- **顺序处理**: 故事按顺序逐个处理，不并行（确保依赖关系）
- **状态驱动**: 基于 `sprint-status.yaml` 的状态机驱动流程

### 3. 预授权机制
工作流预授权了常见开发命令，避免中断自动化流程：
- 安装依赖、运行测试、数据库迁移
- 构建项目、代码格式化、Git 操作
- 各种测试框架（Jest、Playwright、Vitest 等）

## 完整流程架构


### 三大主步骤

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: 初始化和选择 EPIC                                    │
│  - 加载 sprint-status.yaml                                   │
│  - 识别 in-progress 的 EPIC                                  │
│  - 自动选择或让用户选择                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: 故事循环处理（核心循环）                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2.1 创建故事 (backlog → story-created)                │  │
│  │     - 调用 create-story workflow                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2.2 验证故事质量 (story-created → story-validated)    │  │
│  │     - 调用 validate-story workflow                    │  │
│  │     - 最多2次自动修复迭代                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2.3 开发故事 (story-validated → dev-completed)        │  │
│  │     - 调用 dev-story workflow                         │  │
│  │     - 实现所有任务/子任务                              │  │
│  │     - 遵循 red-green-refactor 循环                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2.4 扩展测试覆盖 (dev-completed → test-automated)     │  │
│  │     - 调用 testarch-automate workflow                 │  │
│  │     - 最多2次自动修复迭代                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2.5 代码审查和修复 (test-automated → done)            │  │
│  │     - 调用 code-review workflow                       │  │
│  │     - 最多2次自动修复迭代                              │  │
│  │     - 找出3-10个问题并全部修复                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  └──→ 检查是否还有未完成的故事 ──→ 是 ──→ 循环回到 2.1      │
│                            ↓ 否                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: EPIC 完成和报告                                      │
│  - 更新 EPIC 状态为 done                                      │
│  - 生成完整报告                                               │
│  - 询问是否运行回顾会议                                        │
└─────────────────────────────────────────────────────────────┘
```


## Step 1: 初始化和选择 EPIC

### 1.1 加载和解析 sprint-status.yaml

**目标**: 理解项目当前状态，识别需要处理的 EPIC

**执行步骤**:
1. 加载完整的 `sprint-status.yaml` 文件
2. 从头到尾读取所有行，理解项目结构
3. 解析 `development_status` 部分，识别所有 EPIC 和故事

### 1.2 查找待处理的 EPIC

**查找逻辑**:
```
FOR EACH epic IN development_status:
  IF epic.status == "in-progress":
    pending_stories = COUNT(stories WHERE status != "done")
    IF pending_stories > 0:
      ADD epic TO candidate_epics
```

### 1.3 EPIC 选择策略

#### 场景 A: 没有找到待处理的 EPIC
```
输出:
📋 No in-progress EPICs with pending stories found.

**Current Sprint Status:**
- All in-progress EPICs are complete
- Check sprint-status.yaml to start a new EPIC

**What would you like to do?**
1. Review sprint-status.yaml to see overall progress
2. Exit workflow

动作: HALT - 没有工作要做
```

#### 场景 B: 恰好一个待处理的 EPIC
```
自动选择该 EPIC:
- 设置 {{selected_epic}} = epic key
- 提取 EPIC 编号（例如 "epic-3" → "3"）
- 统计故事总数和各状态数量

输出:
🎯 **Auto-selected EPIC for Automation**

**EPIC:** epic-3
**Total Stories:** 5
**Status Breakdown:**
- ✅ Done: 2
- 🧪 Test Automated: 0
- 💻 Dev Completed: 1
- ✅ Story Validated: 1
- 📝 Story Created: 0
- 📋 Backlog: 1

**Automation Plan:**
Will process all stories in SEQUENCE (not parallel) until EPIC is complete.
```

#### 场景 C: 多个待处理的 EPIC
```
列出所有 in-progress EPIC:

📋 **Multiple In-Progress EPICs Found**

**EPIC 3:** 用户认证系统
- Total Stories: 5
- Pending: 3
- Done: 2

**EPIC 4:** 数据分析仪表板
- Total Stories: 4
- Pending: 4
- Done: 0

**Which EPIC should I automate?**

用户输入选项:
1. 输入 EPIC 编号（例如 "3"）→ 处理该 EPIC
2. 输入 "all" → 顺序处理所有 EPIC
```

### 1.4 初始化变量

```javascript
{{epic_key}} = selected_epic          // 例如: "epic-3"
{{epic_number}} = extracted_number    // 例如: "3"
{{epic_report}} = {}                  // 空报告结构
{{epic_start_time}} = current_timestamp
{{process_all_epics}} = false/true    // 是否处理所有 EPIC
```


## Step 2: 故事循环处理（核心引擎）

### 循环机制

**关键特性**:
- ✅ **顺序处理**: 一次处理一个故事，不并行
- ✅ **状态驱动**: 根据当前状态决定执行哪个子步骤
- ✅ **持续循环**: 直到所有故事状态为 "done"
- ✅ **隔离上下文**: 每个子步骤使用独立的 subagent

### 循环入口逻辑

```
ANCHOR: story_loop_start

1. 重新加载 sprint-status.yaml（获取最新状态）
2. 查找属于当前 EPIC 的所有故事（匹配模式: {{epic_number}}-*-*）
3. 找到第一个状态不是 "done" 的故事
4. 优先级顺序: backlog → story-created → story-validated → dev-completed → test-automated

IF 所有故事都是 "done":
  → 跳转到 Step 3（EPIC 完成）
ELSE:
  → 处理找到的故事
  → 设置 {{current_story_key}} 和 {{current_story_status}}
  → 进入子步骤处理
```

---

## 子步骤 2.1: 创建故事

**触发条件**: `{{current_story_status}} == 'backlog'`

**目标**: 将 epic 文件中的故事条目转换为完整的故事文件

### 执行流程

```
输出:
📝 **Step 2.1: Creating Story**

Story exists in epic file but not yet created as story file.
Invoking create-story workflow via subagent...

调用 subagent:
  类型: general-purpose
  描述: Create story {{current_story_key}}
  
  提示词:
    1. 加载并执行: {workflow_paths:create_story}
    2. 传递参数: story_key = {{current_story_key}}
    3. 等待工作流完成
    4. 返回结果: SUCCESS 或 FAILURE（带详情）
```

### 结果处理

#### 失败场景
```
❌ **Error: Story Creation Failed**

Story: 3-1-user-login
Error: {{error_message}}

**Action Required:** Manual intervention needed.

动作:
- 添加到 {{epic_report}} → errors 部分
- HALT - 无法继续，没有故事文件
```

#### 成功场景
```
✅ Story created successfully

Updating sprint-status.yaml...

动作:
- 更新 sprint-status.yaml: {{current_story_key}} status → "story-created"
- 更新 {{current_story_status}} = "story-created"
- 继续到下一个子步骤（2.2）
```

### create-story 工作流详情

**配置文件**: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`

**关键功能**:
- 从 epics.md 中提取故事需求
- 使用模板生成完整的故事文件
- 包含 BDD 场景和验收标准
- 支持选择性加载（只加载需要的 epic）

**输入文件**:
- `sprint-status.yaml` - 故事跟踪主源
- `epics.md` - 增强的 epics+stories（包含 BDD 和源提示）
- `PRD.md` - 需求回退（如果 epics 文件中没有）
- `architecture.md` - 约束回退
- `ux.md` - UX 需求回退

**输出**: `{story_dir}/{{story_key}}.md`


## 子步骤 2.2: 验证故事质量（带自动修复循环）

**触发条件**: `{{current_story_status}} == 'story-created'`

**目标**: 确保故事质量达标，自动修复所有发现的问题

### 自动修复循环机制

```javascript
{{validation_iteration}} = 0
{{max_validation_iterations}} = 2

ANCHOR: validation_loop_start

输出:
🔍 **Step 2.2: Validating Story Quality (Iteration {{validation_iteration}}/{{max_validation_iterations}})**

Running Scrum Master validation with auto-fix for story quality...
This will analyze the story in a fresh context and apply ALL improvements.
```

### 调用验证 Subagent

```
调用 subagent:
  类型: general-purpose
  描述: Validate and fix story {{current_story_key}}
  
  关键指令:
    - **CRITICAL: This is iteration {{validation_iteration}} of {{max_validation_iterations}}**
    - **CRITICAL: Use incremental editing strategy - do NOT rewrite entire file**
    
  执行步骤:
    1. 加载并执行: {workflow_paths:validate_story}
    2. 传递参数: story_key = {{current_story_key}}
    3. 工作流将:
       - 逐节分析故事质量
       - 使用 Edit 工具应用修复（增量编辑）
       - 自动处理大文件（分块）
       - 重试失败的编辑（减小块大小）
    4. 等待工作流完成
    5. 返回结果:
       - SUCCESS: 所有问题已修复并验证
       - ISSUES_REMAIN: 无法修复所有问题（带详情）
       - FAILURE: 关键错误
```

### 结果处理逻辑

#### 结果 A: ISSUES_REMAIN（仍有问题）
```
动作:
  {{validation_iteration}}++
  
  IF {{validation_iteration}} < {{max_validation_iterations}}:
    输出: 🔄 Validation found issues. Re-running validation loop...
    → GOTO validation_loop_start（重新验证）
  
  ELSE:
    输出:
    ⚠️ **Maximum validation iterations reached (2)**
    
    Proceeding with current story quality. Some issues may remain 
    but will not block progress.
    
    动作:
    - 更新 sprint-status.yaml: status → "story-validated"
    - 更新 {{current_story_status}} = "story-validated"
    - 添加到报告: validation: "passed (max iterations)"
```

#### 结果 B: FAILURE（验证失败）
```
❌ **Error: Story Validation Failed**

Story: {{current_story_key}}
Error: {{error_message}}

**Action Required:** Manual intervention needed to fix story quality issues.

动作:
- 添加到 {{epic_report}} → errors 部分
- HALT - 无法继续处理低质量故事
```

#### 结果 C: SUCCESS（验证成功）
```
✅ Story validation complete - ALL issues fixed

Story quality verified and all improvements applied.
Updating sprint-status.yaml...

动作:
- 更新 sprint-status.yaml: status → "story-validated"
- 更新 {{current_story_status}} = "story-validated"
- 添加到报告: validation: "passed"
- 继续到下一个子步骤（2.3）
```

### 增量编辑策略

**为什么需要增量编辑**:
- 避免 "file too large" 错误
- 保持上下文清晰
- 更精确的修改

**实现方式**:
1. 自动检测大文件（>1000 行）
2. 在可管理的块中应用修复
3. 失败时自动减小块大小并重试


## 子步骤 2.3: 开发故事

**触发条件**: `{{current_story_status}} == 'story-validated'`

**目标**: 实现故事中的所有任务和子任务，遵循 TDD 原则

### 执行流程

```
输出:
💻 **Step 2.3: Developing Story**

Invoking dev-story workflow via subagent...
This will implement all tasks/subtasks following red-green-refactor cycle.

调用 subagent:
  类型: general-purpose
  描述: Develop story {{current_story_key}}
  
  执行步骤:
    1. 加载故事文件: {story_dir}/{{current_story_key}}.md
    2. 加载并执行: {workflow_paths:dev_story}
    3. 传递参数: story_path = {story_dir}/{{current_story_key}}.md
    4. 实现所有任务/子任务，遵循 red-green-refactor 循环
    5. 运行所有测试以验证实现
    6. 返回结果: SUCCESS（所有任务完成）或 FAILURE（带错误）
```

### dev-story 工作流详情

**配置文件**: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`

**核心原则**:
- **Red-Green-Refactor 循环**:
  1. 🔴 Red: 先写失败的测试
  2. 🟢 Green: 写最少的代码让测试通过
  3. 🔵 Refactor: 重构代码，保持测试通过

**执行策略**:
- 逐个处理任务和子任务
- 每个任务完成后运行测试
- 更新故事文件中的任务状态
- 验证所有验收标准

### 结果处理

#### 失败场景
```
❌ **Error: Story Development Failed**

Story: {{current_story_key}}
Error: {{error_message}}

**Action Required:** Manual intervention needed to fix development issues.

动作:
- 添加到 {{epic_report}} → errors 部分
- HALT - 无法继续处理失败的开发
```

#### 成功场景
```
✅ Story development complete

All tasks/subtasks implemented and tested.
Updating sprint-status.yaml...

动作:
- 更新 sprint-status.yaml: status → "dev-completed"
- 更新 {{current_story_status}} = "dev-completed"
- 添加到报告: development: "completed"
- 继续到下一个子步骤（2.4）
```


## 子步骤 2.4: 扩展测试覆盖（带自动修复循环）

**触发条件**: `{{current_story_status}} == 'dev-completed'`

**目标**: 分析代码覆盖率，生成额外测试，确保所有测试通过

### 自动修复循环机制

```javascript
{{test_iteration}} = 0
{{max_test_iterations}} = 2

ANCHOR: test_automate_loop_start

输出:
🧪 **Step 2.4: Expanding Test Coverage (Iteration {{test_iteration}}/{{max_test_iterations}})**

Invoking testarch-automate workflow with auto-fix via subagent...
This will analyze code coverage and generate additional tests with auto-fix.
```

### 调用测试自动化 Subagent

```
调用 subagent:
  类型: general-purpose
  描述: Automate tests with fix for {{current_story_key}}
  
  关键指令:
    - **CRITICAL: This is iteration {{test_iteration}} of {{max_test_iterations}}**
    - **CRITICAL: Quality over token limit - complete ALL tasks**
    
  执行步骤:
    1. 加载并执行: {workflow_paths:testarch_automate}
    2. 分析故事实现的代码覆盖率
    3. **COMPLETE COVERAGE**: 为所有未覆盖的路径生成测试
    4. 运行所有测试 - 如果有失败:
       a. 分析失败原因
       b. **AUTO-FIX**: 修复实现或测试问题
       c. 重新运行测试
       d. 重复直到所有测试通过
    5. 不要因为 token/时间限制而停止 - 如果达到限制则报告
    6. 返回结果:
       - SUCCESS: 所有测试生成并通过
       - NEEDS_FIX: 某些测试仍然失败（将重试）
       - FAILURE: 关键错误
```

### 结果处理逻辑

#### 结果 A: NEEDS_FIX（需要修复）
```
动作:
  {{test_iteration}}++
  
  IF {{test_iteration}} < {{max_test_iterations}}:
    输出: 🔄 Tests need fixing. Re-running test automation...
    → GOTO test_automate_loop_start（重新测试）
  
  ELSE:
    输出:
    ⚠️ **Maximum test iterations reached (2)**
    
    Proceeding with current test coverage. Some tests may still be 
    failing but will not block progress.
    
    动作:
    - 添加到报告: test_automation: "completed with warnings"
    - 更新 sprint-status.yaml: status → "test-automated"
    - 更新 {{current_story_status}} = "test-automated"
```

#### 结果 B: FAILURE（测试失败）
```
⚠️ **Warning: Test Automation Failed**

Story: {{current_story_key}}
Error: {{error_message}}

**Decision:** Continuing with existing test coverage.
This is not a blocking error.

动作:
- 添加到报告: test_automation: "failed (non-blocking)"
- 继续处理（非阻塞错误）
```

#### 结果 C: SUCCESS（测试成功）
```
✅ Test coverage expansion complete - ALL tests passing

Additional tests generated and verified.

动作:
- 添加到报告: test_automation: "completed"
- 更新 sprint-status.yaml: status → "test-automated"
- 更新 {{current_story_status}} = "test-automated"
- 继续到下一个子步骤（2.5）
```

### testarch-automate 工作流特点

**关键功能**:
- 代码覆盖率分析
- 智能测试生成（边界情况、错误路径等）
- 自动修复失败的测试
- 支持多种测试框架（Jest、Playwright、Vitest）


## 子步骤 2.5: 代码审查和自动修复（带自动修复循环）

**触发条件**: `{{current_story_status}} == 'test-automated'`

**目标**: 执行对抗性代码审查，找出3-10个问题并全部自动修复

### 自动修复循环机制

```javascript
{{code_review_iteration}} = 0
{{max_code_review_iterations}} = 2

ANCHOR: code_review_loop_start

输出:
🔍 **Step 2.5: Code Review and Auto-Fix (Iteration {{code_review_iteration}}/{{max_code_review_iterations}})**

Invoking code-review workflow with FULL auto-fix via subagent...
This will find 3-10 issues and automatically fix ALL problems.
```

### 调用代码审查 Subagent

```
调用 subagent:
  类型: general-purpose
  描述: Code review with auto-fix for {{current_story_key}}
  
  关键指令:
    - **CRITICAL: This is iteration {{code_review_iteration}} of {{max_code_review_iterations}}**
    - **CRITICAL: Fix ALL issues - this may be the last iteration**
    
  执行步骤:
    1. 加载故事文件: {story_dir}/{{current_story_key}}.md
    2. 加载并执行: {workflow_paths:code_review}
    3. 执行对抗性代码审查，找出3-10个问题
    4. **AUTO-FIX ALL ISSUES**:
       - HIGH 优先级: 必须修复
       - MEDIUM 优先级: 必须修复
       - LOW 优先级: 如果简单则修复
    5. 修复所有问题后:
       a. 重新运行所有测试
       b. 验证所有测试通过
       c. 重新审查代码以确认修复
    6. 如果重新审查时发现新问题，也要修复
    7. 不要因为 token/时间限制而停止
    8. 返回结果:
       - SUCCESS: 所有问题找到并修复，测试通过
       - ISSUES_REMAIN: 无法修复所有问题（如果还有迭代次数则重试）
       - TESTS_FAILED: 修复后测试失败（如果还有迭代次数则重试）
       - FAILURE: 关键错误
```

### code-review 工作流详情

**配置文件**: `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`

**对抗性审查原则**:
- **永远不接受 "looks good"**: 必须找到最少3个问题
- **挑战一切**: 代码质量、测试覆盖、架构合规、安全性、性能
- **全面审查维度**:
  - 代码质量和可维护性
  - 测试覆盖率和测试质量
  - 架构合规性
  - 安全漏洞（OWASP Top 10）
  - 性能问题
  - 错误处理
  - 文档完整性

**输入文件**:
- 故事文件
- `architecture.md` - 系统架构（全量加载）
- `ux.md` - UX 设计规范（如果是 UI 审查）
- `epics.md` - 包含故事的 epic（选择性加载）

### 结果处理逻辑

#### 结果 A: ISSUES_REMAIN（仍有问题）
```
动作:
  {{code_review_iteration}}++
  
  IF {{code_review_iteration}} < {{max_code_review_iterations}}:
    输出: 🔄 Code review found more issues. Re-running code review loop...
    → GOTO code_review_loop_start（重新审查）
  
  ELSE:
    输出:
    ✅ **Maximum code review iterations reached (2)**
    
    Code review completed 2 iterations. Marking story as done.
    Some minor issues may remain but quality threshold has been met.
    
    动作:
    - 更新 sprint-status.yaml: status → "done"
    - 更新 {{current_story_status}} = "done"
    - 记录故事完成时间和持续时间
    - 添加到报告: code_review: "passed (max iterations)"
```

#### 结果 B: TESTS_FAILED（测试失败）
```
动作:
  {{code_review_iteration}}++
  
  IF {{code_review_iteration}} < {{max_code_review_iterations}}:
    输出: 🔄 Tests failing after fixes. Re-running code review to fix...
    → GOTO code_review_loop_start（重新审查修复）
  
  ELSE:
    输出:
    ✅ **Maximum code review iterations reached (2)**
    
    Code review completed 2 iterations. Marking story as done.
    Tests may have some failures but quality threshold has been met 
    for automation purposes.
    
    动作:
    - 更新 sprint-status.yaml: status → "done"
    - 更新 {{current_story_status}} = "done"
    - 记录故事完成时间和持续时间
    - 添加到报告: code_review: "passed (max iterations, some test warnings)"
    - 添加警告: "Story {{current_story_key}}: Some tests may need manual review"
```

#### 结果 C: FAILURE（审查失败）
```
❌ **Error: Code Review Failed**

Story: {{current_story_key}}
Error: {{error_message}}

**Action Required:** Manual intervention needed to fix code review issues.

动作:
- 添加到 {{epic_report}} → errors 部分
- HALT - 无法继续处理失败的代码审查
```

#### 结果 D: SUCCESS（审查成功）
```
✅ **Code Review Passed!**

Story: {{current_story_key}}
All issues fixed and acceptance criteria met.

动作:
- 更新 sprint-status.yaml: status → "done"
- 更新 {{current_story_status}} = "done"
- 记录故事完成时间和持续时间
- 添加到报告: code_review: "passed"
- 添加到报告: final_status: "done"
- 继续到子步骤 2.6（检查下一个故事）
```

---

## 子步骤 2.6: 检查并继续下一个故事

**目标**: 确定是否还有未完成的故事，决定是继续循环还是完成 EPIC

### 执行流程

```
输出:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ **Story {{current_story_key}} Processing Complete**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Checking for next story in EPIC...

动作:
1. 重新加载 sprint-status.yaml（获取最新状态）
2. 统计当前 EPIC 中状态不是 "done" 的故事数量
```

### 决策逻辑

#### 场景 A: 还有剩余故事
```
输出:
📋 **3 stories remaining in epic-3**

Continuing to next story...

动作:
→ GOTO story_loop_start（返回 Step 2 开始处理下一个故事）
```

#### 场景 B: 没有剩余故事
```
输出:
🎉 **All stories in epic-3 complete!**

Proceeding to EPIC completion...

动作:
→ GOTO Step 3（EPIC 完成和报告）
```


## Step 3: EPIC 完成和报告

### 3.1 计算 EPIC 持续时间

```javascript
{{epic_end_time}} = current_timestamp
{{epic_duration}} = {{epic_end_time}} - {{epic_start_time}}
```

### 3.2 验证所有故事完成

```
动作:
1. 重新加载 sprint-status.yaml
2. 验证当前 EPIC 的所有故事状态都是 "done"
```

#### 场景 A: 所有故事都完成
```
✅ **EPIC Status Updated**

epic-3 → done

动作:
- 更新 sprint-status.yaml 中的 EPIC 状态为 "done"
- 保存文件，保留所有注释和结构
```

#### 场景 B: 有故事未完成
```
⚠️ **Warning: EPIC Incomplete**

epic-3 has stories that are not "done".
EPIC status will remain "in-progress".

**Incomplete Stories:**
- 3-4-password-reset: dev-completed
- 3-5-email-verification: story-validated

动作:
- EPIC 状态保持 "in-progress"
- 在报告中记录未完成的故事
```

### 3.3 生成 EPIC 完成报告

**报告内容**:
```markdown
# EPIC Automation Report

## EPIC Information
- **EPIC Key**: epic-3
- **EPIC Number**: 3
- **Total Stories**: 5
- **Total Duration**: 2h 34m

## Story Summary

### Story 3-1-user-login
- **Status**: done
- **Duration**: 28m
- **Validation**: passed
- **Development**: completed
- **Test Automation**: completed
- **Code Review**: passed

### Story 3-2-user-registration
- **Status**: done
- **Duration**: 32m
- **Validation**: passed (max iterations)
- **Development**: completed
- **Test Automation**: completed with warnings
- **Code Review**: passed

[... 其他故事 ...]

## Overall Statistics
- **Successfully Completed**: 5/5
- **Failed**: 0
- **Success Rate**: 100%

## Errors Encountered
[如果有错误，列出详情]

## Warnings
- Story 3-2-user-registration: Some tests may need manual review
```

**保存位置**: `{output_folder}/epic-auto-dev-report-{{date}}.md`

### 3.4 输出完成信息

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 **EPIC AUTOMATION COMPLETE!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**EPIC:** epic-3
**Total Stories:** 5
**Successfully Completed:** 5
**Failed:** 0
**Total Duration:** 2h 34m

**Report saved to:** _bmad-output/epic-auto-dev-report-2025-02-06.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.5 处理多 EPIC 场景

**检查条件**: `{{process_all_epics}} == true`

#### 场景 A: 找到下一个 EPIC
```
🔄 **Processing Next EPIC**

Found another in-progress EPIC with pending stories.
Continuing automation...

动作:
- 设置 {{selected_epic}} = 下一个 EPIC key
- 设置 {{epic_key}} = 下一个 EPIC key
- 提取 {{epic_number}}
→ GOTO Step 2（为下一个 EPIC 开始故事循环）
```

#### 场景 B: 没有更多 EPIC
```
✅ **All In-Progress EPICs Complete!**

No more EPICs to process.

动作:
- 继续到回顾会议询问
```

### 3.6 询问回顾会议

```
检查回顾会议状态:
- 获取回顾会议 key: {{epic_key}}-retrospective
- 从 sprint-status.yaml 获取回顾会议状态

IF retrospective status == 'optional':
  询问用户:
  
  Would you like to run a retrospective for epic-3?
  
  Retrospective will review overall success, extract lessons learned, 
  and identify improvements for the next epic.
  
  [Y/n]:
  
  IF 用户回答 yes:
    输出:
    📝 **Running Retrospective**
    
    Please run the retrospective workflow manually:
    `retrospective` or `*retrospective`
    
    This workflow will now exit.
  
  IF 用户回答 no:
    输出:
    ✅ **Workflow Complete**
    
    You can run retrospective later if needed.
```

### 3.7 最终输出

```
🎊 **Thank you, 27937!**

EPIC automation workflow completed successfully.
Check the report for detailed information about the automated development process.
```


## 关键技术特性

### 1. Subagent 隔离上下文机制

**为什么需要隔离上下文**:
- 避免上下文污染和混淆
- 每个步骤都有干净的起点
- 支持自动修复循环而不累积错误

**实现方式**:
```xml
<invoke-task subagent_type="general-purpose" description="任务描述">
  <prompt>
    详细的任务指令...
  </prompt>
</invoke-task>
```

**Subagent 类型**:
- `general-purpose`: 通用型 agent，可以执行多步骤任务

### 2. 自动修复循环模式

**三个关键循环**:
1. **验证循环** (Step 2.2): 最多2次迭代修复故事质量问题
2. **测试循环** (Step 2.4): 最多2次迭代修复测试失败
3. **审查循环** (Step 2.5): 最多2次迭代修复代码问题

**循环模式**:
```
iteration = 0
max_iterations = 2

ANCHOR: loop_start

执行任务...

IF 返回 NEEDS_FIX:
  iteration++
  IF iteration < max_iterations:
    → GOTO loop_start
  ELSE:
    → 继续（带警告）
```

**优势**:
- 自动恢复能力
- 质量保证
- 避免无限循环

### 3. 状态机驱动

**故事状态流转**:
```
backlog 
  ↓ (Step 2.1: 创建故事)
story-created 
  ↓ (Step 2.2: 验证质量)
story-validated 
  ↓ (Step 2.3: 开发)
dev-completed 
  ↓ (Step 2.4: 测试)
test-automated 
  ↓ (Step 2.5: 审查)
done
```

**状态持久化**: 所有状态变更都保存到 `sprint-status.yaml`

### 4. 错误处理策略

**阻塞错误** (HALT):
- 故事创建失败
- 故事验证失败
- 故事开发失败
- 代码审查失败

**非阻塞错误** (继续):
- 测试自动化失败（使用现有测试覆盖）
- 达到最大迭代次数（带警告继续）

### 5. 预授权机制

**目的**: 避免自动化流程被权限请求中断

**预授权命令类别**:
```yaml
allowedPrompts:
  - tool: Bash
    prompt: "install dependencies"
  - tool: Bash
    prompt: "run tests"
  - tool: Bash
    prompt: "run migrations"
  # ... 更多命令
```

**覆盖范围**:
- 依赖管理（npm、yarn）
- 测试运行（Jest、Playwright、Vitest）
- 数据库操作（TypeORM、Prisma）
- 代码质量（linter、formatter）
- Git 操作（status、diff、stage）


## 配置和变量系统

### 核心配置来源

**主配置文件**: `_bmad/bmm/config.yaml`

**关键变量**:
```yaml
user_name: "27937"                    # 用户名称
communication_language: Chinese       # 交流语言
document_output_language: Chinese     # 文档输出语言
output_folder: "{project-root}/_bmad-output"  # 输出文件夹
sprint_artifacts: "{output_folder}/sprint-artifacts"  # Sprint 工件
```

### 工作流特定变量

**epic-auto-dev/workflow.yaml**:
```yaml
variables:
  sprint_status: "{sprint_artifacts}/sprint-status.yaml"
  story_dir: "{sprint_artifacts}"
  max_retries: 10
  auto_fix_issues: true
  quality_first: true
  project_context: "**/project-context.md"
```

### 子工作流路径

```yaml
workflow_paths:
  create_story: "{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml"
  validate_story: "{project-root}/_bmad/bmm/workflows/4-implementation/create-story/validate-story-workflow.yaml"
  dev_story: "{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml"
  code_review: "{project-root}/_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml"
  testarch_automate: "{project-root}/_bmad/bmm/workflows/testarch/automate/workflow.yaml"
```

### 输出文件配置

```yaml
default_output_file: "{output_folder}/epic-auto-dev-report-{{date}}.md"
```

**变量替换**:
- `{{date}}`: 系统生成的当前日期
- `{{epic_key}}`: 当前处理的 EPIC key
- `{{story_key}}`: 当前处理的故事 key

## 依赖的工具

### 必需工具

```yaml
required_tools:
  - read_file      # 读取文件
  - write_file     # 写入文件
  - invoke_task    # 调用子任务（创建 subagent）
  - bash           # 执行 shell 命令
```

### 工具使用场景

**read_file**:
- 加载 sprint-status.yaml
- 读取故事文件
- 读取配置文件

**write_file**:
- 更新 sprint-status.yaml
- 生成报告文件
- 创建故事文件

**invoke_task**:
- 创建隔离的 subagent
- 执行子工作流
- 支持自动修复循环

**bash**:
- 运行测试
- 安装依赖
- 执行数据库迁移
- Git 操作

## 数据流

### 输入数据

```
sprint-status.yaml (主要输入)
  ├─ development_status
  │   ├─ epic-1
  │   │   ├─ status: "done"
  │   │   └─ stories: [...]
  │   ├─ epic-2
  │   │   ├─ status: "in-progress"
  │   │   └─ stories:
  │   │       ├─ 2-1-feature-a: "done"
  │   │       ├─ 2-2-feature-b: "dev-completed"
  │   │       └─ 2-3-feature-c: "backlog"
  │   └─ epic-3
  │       ├─ status: "in-progress"
  │       └─ stories: [...]
  └─ retrospectives: [...]

epics.md (辅助输入)
  └─ 包含详细的 EPIC 和故事需求

project-context.md (上下文)
  └─ 项目整体上下文信息
```

### 中间数据

```
{{epic_key}} = "epic-2"
{{epic_number}} = "2"
{{current_story_key}} = "2-2-feature-b"
{{current_story_status}} = "dev-completed"
{{epic_report}} = {
  stories: {
    "2-1-feature-a": {
      validation: "passed",
      development: "completed",
      test_automation: "completed",
      code_review: "passed",
      duration: "28m"
    },
    "2-2-feature-b": {
      validation: "passed",
      development: "completed",
      test_automation: "completed with warnings",
      code_review: "passed (max iterations)",
      duration: "35m"
    }
  },
  errors: [],
  warnings: ["Story 2-2-feature-b: Some tests may need manual review"]
}
```

### 输出数据

```
sprint-status.yaml (更新后)
  └─ epic-2 status: "done"
  └─ 所有故事状态: "done"

epic-auto-dev-report-2025-02-06.md
  ├─ EPIC 信息
  ├─ 故事摘要
  ├─ 整体统计
  ├─ 错误列表
  └─ 警告列表
```


## 使用场景和最佳实践

### 适用场景

✅ **推荐使用**:
1. **完整 EPIC 自动化**: 有多个故事需要按顺序开发
2. **质量优先项目**: 需要严格的代码审查和测试覆盖
3. **重复性开发任务**: 类似的 CRUD 操作、API 端点等
4. **夜间自动化**: 设置后让系统自动运行
5. **快速原型验证**: 快速实现和验证多个功能

❌ **不推荐使用**:
1. **探索性开发**: 需求不明确，需要频繁调整
2. **复杂架构决策**: 需要人工判断和权衡
3. **单个故事开发**: 使用 `dev-story` 工作流更合适
4. **紧急 bug 修复**: 使用 `quick-dev` 工作流更快

### 最佳实践

#### 1. 准备工作

**确保 sprint-status.yaml 准确**:
```yaml
development_status:
  epic-3:
    status: "in-progress"
    stories:
      3-1-user-login:
        status: "backlog"
      3-2-user-registration:
        status: "backlog"
      3-3-password-reset:
        status: "backlog"
```

**确保故事需求清晰**:
- epics.md 包含详细的需求描述
- 验收标准明确
- BDD 场景完整

#### 2. 监控执行

**关键监控点**:
- 每个故事的状态变更
- 自动修复循环的迭代次数
- 错误和警告信息

**中断处理**:
- 如果遇到 HALT，检查错误信息
- 手动修复问题后，可以重新运行工作流
- 工作流会从上次中断的地方继续

#### 3. 质量控制

**自动修复迭代**:
- 验证循环: 最多2次
- 测试循环: 最多2次
- 审查循环: 最多2次

**质量阈值**:
- 达到最大迭代次数后会继续（带警告）
- 关键错误会 HALT 流程
- 非关键错误会记录但不阻塞

#### 4. 报告分析

**查看完成报告**:
```bash
cat _bmad-output/epic-auto-dev-report-2025-02-06.md
```

**关注指标**:
- 成功率
- 平均故事持续时间
- 警告和错误数量
- 自动修复循环使用情况

### 故障排除

#### 问题 1: 工作流卡在某个故事

**可能原因**:
- 测试一直失败
- 代码审查发现无法自动修复的问题

**解决方案**:
1. 检查最新的 subagent 输出
2. 手动修复问题
3. 更新 sprint-status.yaml 中的故事状态
4. 重新运行工作流

#### 问题 2: 找不到 in-progress 的 EPIC

**可能原因**:
- sprint-status.yaml 中没有 EPIC 标记为 "in-progress"
- 所有 in-progress 的 EPIC 都已完成

**解决方案**:
1. 检查 sprint-status.yaml
2. 将需要处理的 EPIC 状态设置为 "in-progress"
3. 确保 EPIC 中有状态不是 "done" 的故事

#### 问题 3: Subagent 返回 FAILURE

**可能原因**:
- 代码编译错误
- 测试配置问题
- 依赖缺失

**解决方案**:
1. 查看错误详情
2. 手动运行相关命令验证
3. 修复环境或配置问题
4. 重新运行工作流

#### 问题 4: 自动修复循环达到最大次数

**可能原因**:
- 问题复杂，需要多次迭代
- 自动修复策略不够智能

**解决方案**:
1. 查看警告信息
2. 手动审查相关代码
3. 如果质量可接受，继续下一个故事
4. 如果质量不可接受，手动修复后重新运行


## 性能和效率

### 时间估算

**单个故事平均时间**: 20-40分钟
- 创建故事: 2-5分钟
- 验证质量: 3-8分钟（含自动修复）
- 开发实现: 10-20分钟
- 测试覆盖: 3-8分钟（含自动修复）
- 代码审查: 5-10分钟（含自动修复）

**5个故事的 EPIC**: 约 2-3小时

### 并行化策略

**当前**: 顺序处理（一次一个故事）

**原因**:
- 故事之间可能有依赖关系
- 避免并发修改同一文件
- 更容易追踪和调试

**未来优化**: 可以考虑并行处理独立的故事

### Token 使用优化

**隔离上下文**:
- 每个 subagent 都有干净的上下文
- 避免累积大量历史对话

**选择性加载**:
- 只加载需要的文档部分
- 支持分片文档（sharded docs）

**增量编辑**:
- 使用 Edit 工具而不是重写整个文件
- 自动检测大文件并分块处理

## 扩展性和定制

### 添加新的子工作流

**步骤**:
1. 在 `workflow_paths` 中添加新工作流路径
2. 在 `instructions.xml` 中添加新的子步骤
3. 定义触发条件和结果处理逻辑

**示例**: 添加性能测试步骤
```yaml
workflow_paths:
  performance_test: "{project-root}/_bmad/bmm/workflows/testarch/performance/workflow.yaml"
```

### 自定义自动修复迭代次数

**修改配置**:
```yaml
variables:
  max_validation_iterations: 3  # 默认 2
  max_test_iterations: 3        # 默认 2
  max_code_review_iterations: 3 # 默认 2
```

### 添加自定义检查点

**在 instructions.xml 中添加**:
```xml
<check if="custom_condition">
  <action>执行自定义逻辑</action>
</check>
```

### 自定义报告格式

**修改报告生成逻辑**:
- 在 Step 3.3 中自定义报告内容
- 添加自定义指标和统计
- 支持多种输出格式（Markdown、JSON、HTML）

## 与其他工作流的集成

### 上游工作流

**create-epics-and-stories**:
- 生成 epics.md 和 sprint-status.yaml
- 为 epic-auto-dev 提供输入

**create-architecture**:
- 生成 architecture.md
- 为代码审查提供架构约束

### 下游工作流

**retrospective**:
- 在 EPIC 完成后运行
- 提取经验教训和改进建议

**testarch-test-review**:
- 审查测试质量
- 识别测试覆盖缺口

### 并行工作流

**quick-dev**:
- 用于快速单个功能开发
- 不需要完整的 EPIC 流程

**code-review** (独立使用):
- 可以单独对任何故事运行
- 不依赖 epic-auto-dev

## 总结

### 核心优势

✅ **完全自动化**: 从故事创建到代码审查的端到端自动化
✅ **质量保证**: 多层次的自动修复循环确保代码质量
✅ **隔离上下文**: 每个步骤都有干净的上下文，避免污染
✅ **状态持久化**: 所有进度保存到 sprint-status.yaml，可恢复
✅ **灵活配置**: 支持单个或多个 EPIC 处理
✅ **详细报告**: 生成完整的执行报告和统计

### 适用团队

- **小型团队**: 减少重复性开发工作
- **初创公司**: 快速迭代和原型验证
- **外包团队**: 标准化开发流程
- **个人开发者**: 提高生产力

### 学习曲线

**初级用户**: 
- 理解 sprint-status.yaml 结构
- 学会准备 epics.md
- 监控工作流执行

**中级用户**:
- 自定义配置参数
- 处理常见错误
- 优化故事质量

**高级用户**:
- 扩展工作流
- 添加自定义步骤
- 集成其他工具

### 未来改进方向

1. **智能并行化**: 自动识别独立故事并并行处理
2. **增强的错误恢复**: 更智能的错误处理和自动恢复
3. **实时监控**: Web UI 显示实时进度
4. **机器学习优化**: 根据历史数据优化迭代次数
5. **多语言支持**: 支持更多编程语言和框架

---

## 附录

### A. 相关文件路径

```
_bmad/
├── core/
│   ├── config.yaml                    # 主配置文件
│   └── agents/
│       └── bmad-master.md             # BMad Master agent
├── bmm/
│   ├── config.yaml                    # BMM 模块配置
│   └── workflows/
│       └── 4-implementation/
│           ├── epic-auto-dev/
│           │   ├── workflow.yaml      # 主工作流配置
│           │   └── instructions.xml   # 执行逻辑
│           ├── create-story/
│           │   ├── workflow.yaml
│           │   └── instructions.xml
│           ├── dev-story/
│           │   ├── workflow.yaml
│           │   └── instructions.xml
│           └── code-review/
│               ├── workflow.yaml
│               └── instructions.xml
└── _bmad-output/
    ├── sprint-artifacts/
    │   ├── sprint-status.yaml         # 状态跟踪
    │   └── *.md                       # 故事文件
    ├── epics.md                       # EPIC 和故事需求
    ├── architecture.md                # 系统架构
    └── epic-auto-dev-report-*.md      # 执行报告
```

### B. 关键术语表

- **EPIC**: 大型功能集合，包含多个故事
- **Story**: 单个用户故事，包含任务和验收标准
- **Subagent**: 独立的执行代理，有隔离的上下文
- **invoke-task**: 创建 subagent 的机制
- **sprint-status.yaml**: 项目状态跟踪文件
- **Auto-fix loop**: 自动修复循环，最多2次迭代
- **HALT**: 阻塞错误，停止工作流执行
- **Non-blocking error**: 非阻塞错误，记录但继续执行

### C. 快速参考命令

```bash
# 启动 BMad Master
/bmad:core:agents:bmad-master

# 选择菜单4
4

# 查看 sprint 状态
cat _bmad-output/sprint-artifacts/sprint-status.yaml

# 查看最新报告
ls -lt _bmad-output/epic-auto-dev-report-*.md | head -1

# 查看故事文件
cat _bmad-output/sprint-artifacts/3-1-user-login.md

# 手动运行子工作流
/bmad:bmm:workflows:create-story
/bmad:bmm:workflows:dev-story
/bmad:bmm:workflows:code-review
```

---

**文档版本**: 1.0  
**生成日期**: 2025-02-06  
**作者**: BMad Master  
**适用版本**: BMad 6.0.0-alpha.19+

