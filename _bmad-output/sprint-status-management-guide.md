# Sprint Status 管理指南
## 使用 sprint-status.yaml 追踪 Radar Service 开发进度

**更新时间**: 2026-01-25
**项目**: Csaas - Radar Service
**追踪文件**: `_bmad-output/sprint-artifacts\sprint-status.yaml`

---

## 📊 当前项目状态总览

### 项目统计
- **总Epic数**: 7个
- **总Story数**: 29个
- **当前状态**: 全部在backlog（准备开始开发）

### Epic分布
| Epic | 名称 | Stories | 状态 |
|------|------|--------|------|
| Epic 1 | 基础设施与Csaas集成 | 4 | 🟡 backlog |
| Epic 2 | 技术雷达 - ROI导向的技术决策支持 | 5 | 🟡 backlog |
| Epic 3 | 行业雷达 - 同业标杆学习 | 3 | 🟡 backlog |
| Epic 4 | 合规雷达 - 风险预警与应对剧本 | 3 | 🟡 backlog |
| Epic 5 | 用户配置与推送管理 | 4 | 🟡 backlog |
| Epic 6 | 咨询公司多租户与白标输出 | 3 | 🟡 backlog |
| Epic 7 | 运营管理与成本优化 | 4 | 🟡 backlog |

---

## 🔄 状态流转说明

### Epic状态流转
```
backlog → in-progress → done
  ↓
  (当第一个Story被创建时自动转换)
```

**状态说明**:
- **backlog** ⚪: Epic尚未开始
- **in-progress** 🔄: Epic正在进行中（有Story正在开发）
- **done** ✅: Epic所有Story完成

### Story状态流转
```
backlog → ready-for-dev → in-progress → review → done
  ↓
  (SM创建Story文件)   (Dev开始开发)     (Dev提交Review)   (Review通过)
```

**状态说明**:
- **backlog** ⚪: Story只存在于epic文件中
- **ready-for-dev** 🟡: Story文件已创建（在`stories/`文件夹），准备开发
- **in-progress** 🔵: Dev正在实施
- **review** 🟠: 准备代码审查
- **done** ✅: Story完成

### Retrospective状态
```
optional → done
```

**状态说明**:
- **optional** ⚪: 可以做但不是必需
- **done** ✅: Retrospective已完成

---

## 👥 角色职责与操作指南

### 🎯 角色1: Scrum Master (SM)

#### 主要职责
- 管理Sprint Backlog
- 创建Story文件（backlog → ready-for-dev）
- 更新Epic和Story状态
- 协调Sprint Planning和Review

#### 具体操作

**操作1: 创建Story（准备开发）**

当你准备开始开发某个Story时（例如Story 1.1）：

1. **确认Story优先级**
   - 检查dependencies是否满足
   - 确认团队容量

2. **创建Story文件**
   ```bash
   # 在 sprint-artifacts 目录下创建 stories 文件夹（如果不存在）
   mkdir -p _bmad-output/sprint-artifacts/stories

   # 创建Story文件
   # 文件名格式: {epic}-{story}-{title}.md
   # 例如: 1-1-system-automatically-creates-organization-and-associates-projects.md
   ```

3. **Story文件模板**
   ```markdown
   ---
   epic: 1
   story: 1
   title: 系统自动创建组织并将项目关联
   story_id: 1.1
   status: ready-for-dev
   created_at: 2026-01-25
   updated_at: 2026-01-25

   ---

   # Story 1.1: 系统自动创建组织并将项目关联

   ## User Story

   As a 系统管理员,
   I want 系统自动为每个用户创建组织（Organization），并将项目关联到组织,
   So that Radar Service 可以在组织级别提供服务，而不是项目级别。

   ## Acceptance Criteria

   ### Scenario 1: 首次创建项目时自动创建组织

   **Given** 用户首次创建项目
   **When** 项目创建成功
   **Then** 系统自动创建一个 Organization 实体，Organization.name 默认为"用户的组织"
   **And** Project.organizationId 关联到新创建的 Organization
   **And** 创建 OrganizationMember 记录，将用户设为该组织的 admin

   ### Scenario 2: 已有组织时创建新项目

   **Given** 用户已有组织
   **When** 用户创建新项目
   **Then** 新项目自动关联到用户的现有组织
   **And** 不创建新的 Organization

   ### Scenario 3: 评估完成时创建薄弱项快照

   **Given** 评估完成
   **When** 系统识别到薄弱项
   **Then** 创建 WeaknessSnapshot 实体，关联到 organizationId 和 projectId
   **And** WeaknessSnapshot 包含 category（如"数据安全"）、level（如 2）、description

   ### Scenario 4: 聚合多个项目的薄弱项

   **Given** 组织有多个项目的薄弱项
   **When** 系统聚合薄弱项
   **Then** 按 category 分组，取最低 level（最薄弱）
   **And** 记录薄弱项来源的 projectIds

   ## Technical Tasks

   - [ ] Task 1.1.1: 设计数据库Schema
   - [ ] Task 1.1.2: 实现Organization自动创建逻辑
   - [ ] Task 1.1.3: 实现WeaknessSnapshot创建和聚合
   - [ ] Task 1.1.4: API端点开发
   - [ ] Task 1.1.5: 单元测试和集成测试

   ## Definition of Done

   - [ ] 所有Acceptance Criteria满足
   - [ ] 代码完成并通过Code Review
   - [ ] 单元测试覆盖率 ≥ 80%
   - [ ] 集成测试通过
   - [ ] 代码已合并到主分支
   ```

4. **更新sprint-status.yaml**
   ```yaml
   development_status:
     epic-1: backlog  # SM: 当创建第一个Story时，手动改为 in-progress
     1-1-system-automatically-creates-organization-and-associates-projects: ready-for-dev  # 从backlog更新为ready-for-dev
   ```

**操作2: 更新Story状态**

在Story生命周期中更新状态：

```yaml
# SM: Story创建后，自动更新sprint-status.yaml
1-1-system-automatically-creates-organization-and-associates-projects: ready-for-dev

# Dev开始开发时，SM更新状态
1-1-system-automatically-creates-organization-and-associates-projects: in-progress

# Dev提交Review时，SM更新状态
1-1-system-automatically-creates-organization-and-associates-projects: review

# Review通过后，SM更新状态
1-1-system-automatically-creates-organization-and-associates-projects: done
```

**操作3: 更新Epic状态**

```yaml
# 当Epic的第一个Story创建时，Epic自动变为in-progress
epic-1: in-progress

# 当Epic的所有Story都done时，SM手动更新
epic-1: done
```

---

### 💻 角色2: Developer (Dev)

#### 主要职责
- 实施Story（in-progress）
- 提交代码审查（review）
- 更新Story状态
- 确保Definition of Done满足

#### 具体操作

**操作1: 开始实施Story**

当你收到SM分配的Story时（例如Story 1.1）：

1. **确认Story状态为ready-for-dev**
   ```yaml
   # 在 sprint-status.yaml中确认
   1-1-system-automatically-creates-organization-and-associates-projects: ready-for-dev
   ```

2. **开始开发**
   - 按照Story文件中的Technical Tasks进行开发
   - 遵循Coding Standards和最佳实践

3. **更新sprint-status.yaml**
   ```yaml
   # Dev: 开始开发时，更新状态为in-progress
   1-1-system-automatically-creates-organization-and-associates-projects: in-progress
   ```

**操作2: 提交代码审查**

当你完成Story开发时：

1. **完成Definition of Done检查**
   - ✅ 所有Acceptance Criteria满足
   - ✅ 代码完成
   - ✅ 单元测试覆盖率 ≥ 80%
   - ✅ 集成测试通过

2. **更新sprint-status.yaml**
   ```yaml
   # Dev: 提交Review时，更新状态为review
   1-1-system-automatically-creates-organization-and-associates-projects: review
   ```

3. **通知SM进行Code Review**
   - 创建Pull Request或提交Review请求
   - 附上Story文件链接和任务完成说明

**操作3: Review通过后的处理**

当SM确认Review通过时：

1. **合并代码到主分支**

2. **更新sprint-status.yaml**
   ```yaml
   # Dev: Review通过后，更新状态为done
   1-1-system-automatically-creates-organization-and-associates-projects: done
   ```

---

### 🎨 角色3: Product Owner (PO)

#### 主要职责
- 定义Product Backlog优先级
- 验收Story完成情况
- 调整Epic和Story范围

#### 具体操作

**操作1: 调整优先级**

根据业务需求调整Epic开发顺序：

```yaml
# 示例：将Epic 6（多租户）提前到Epic 5之前
development_status:
  epic-1: backlog
  epic-2: backlog
  epic-6: backlog  # 提前到Epic 5
  epic-3: backlog
  epic-4: backlog
  epic-5: backlog  # 延后
```

**操作2: 验收Story**

当Dev完成Story时：

1. **检查Acceptance Criteria**
   - 按照Story文件中的Given/When/Then验证
   - 测试关键场景

2. **验收通过**
   - 通知SM更新Story状态为done
   - 如果有修复意见，创建改进Task

---

## 📋 Sprint状态追踪看板

### 当前状态（全部backlog）

```
═══════════════════════════════════════════════════════════════════════════
                        EPIC/STORY STATUS DASHBOARD
══════════════════════════════════════════════════════════════════════════

🟢 EPIC 1: 基础设施与Csaas集成 (4 stories) [backlog]
  ├─ Story 1.1: 系统自动创建组织并将项目关联 [backlog]
  ├─ Story 1.2: Csaas认证与权限集成 [backlog]
  ├─ Story 1.3: 评估完成后自动识别薄弱项 [backlog]
  └─ Story 1.4: 统一导航与首次登录引导 [backlog]

🟢 EPIC 2: 技术雷达 - ROI导向的技术决策支持 (5 stories) [backlog]
  ├─ Story 2.1: 自动采集技术信息并支持外部导入 [backlog]
  ├─ Story 2.2: 使用AI智能分析推送内容的相关性 [backlog]
  ├─ Story 2.3: 推送系统与调度 [backlog]
  ├─ Story 2.4: 查看技术方案的ROI分析 [backlog]
  └─ Story 2.5: 技术雷达前端展示 [backlog]

🟢 EPIC 3: 行业雷达 - 同业标杆学习 (3 stories) [backlog]
  ├─ Story 3.1: 配置行业雷达的信息来源 [backlog]
  ├─ Story 3.2: 同业案例匹配与推送 [backlog]
  └─ Story 3.3: 行业雷达前端展示 [backlog]

🟢 EPIC 4: 合规雷达 - 风险预警与应对剧本 (3 stories) [backlog]
  ├─ Story 4.1: 配置合规雷达的信息来源 [backlog]
  ├─ Story 4.2: 合规风险分析与应对剧本生成 [backlog]
  └─ Story 4.3: 合规雷达前端展示与应对剧本 [backlog]

🟢 EPIC 5: 用户配置与推送管理 (4 stories) [backlog]
  ├─ Story 5.1: 配置关注技术领域 [backlog]
  ├─ Story 5.2: 配置关注同业机构 [backlog]
  ├─ Story 5.3: 推送偏好设置 [backlog]
  └─ Story 5.4: 推送历史查看 [backlog]

🟢 EPIC 6: 咨询公司多租户与白标输出 (3 stories) [backlog]
  ├─ Story 6.1: 多租户数据模型与隔离机制 [backlog]
  ├─ Story 6.2: 咨询公司批量客户管理后台 [backlog]
  └─ Story 6.3: 白标输出功能 [backlog]

🟢 EPIC 7: 运营管理与成本优化 (4 stories) [backlog]
  ├─ Story 7.1: 运营仪表板 - 系统健康监控 [backlog]
  ├─ Story 7.2: 内容质量管理 [backlog]
  ├─ Story 7.3: 客户管理与流失风险预警 [backlog]
  └─ Story 7.4: AI成本优化工具 [backlog]

═══════════════════════════════════════════════════════════════════════════
进度统计:
  Total Stories: 29
  Completed: 0 (0%)
  In Progress: 0 (0%)
  Ready for Dev: 0 (0%)
  In Review: 0 (0%)
═══════════════════════════════════════════════════════════════════════════
```

---

## 🚀 快速开始指南

### Step 1: 准备开发Epic 1

**目标**: 将Epic 1的4个Stories从backlog推进到done

**Week 1: 准备阶段**
- [ ] **SM**: 创建Story 1.1文件 → 更新status到`ready-for-dev`
- [ ] **SM**: 创建Story 1.2文件 → 更新status到`ready-for-dev`
- [ ] **Dev**: 开始Story 1.1开发 → 更新status到`in-progress`
- [ ] **Dev**: 完成Story 1.1 → 更新status到`review` → SM Review → `done`

**Week 2: 实施阶段**
- [ ] **Dev**: Story 1.2 → `ready-for-dev` → `in-progress` → `review` → `done`
- [ ] **Dev**: Story 1.3 → `ready-for-dev` → `in-progress` → `review` → `done`
- [ ] **Dev**: Story 1.4 → `ready-for-dev` → `in-progress` → `review` → `done`

**Week 2结束**: Epic 1完成 → 所有Stories状态为`done` → SM更新`epic-1: done`

---

## 📝 状态更新检查清单

### SM每日Standup检查项

每天早上Standup时，SM检查：

- [ ] **Stories in-progress**: 哪些Story正在进行开发？
- [ ] **Stories in review**: 哪些Story等待Review？
- [ ] **Stories blocked**: 有没有阻塞的Story？
- [ ] **Stories done**: 昨天完成了什么？
- [ ] **Today's plan**: 今天计划做什么？

### Dev每日工作检查项

- [ ] **我的in-progress Stories**: 我今天要做什么？
- [ ] **Story状态更新**: 开始时更新为`in-progress`，完成时更新为`review`
- [ ] **Definition of Done**: 我的Story完成了吗？
- [ ] **Code Review**: 我的代码准备好了吗？

---

## 🎯 实施建议

### MVP优先级（建议的前6个Stories）

基于实施就绪性评估的建议，MVP应该包含：

**Sprint 1-2 (Epic 1)**:
1. Story 1.1: 系统自动创建组织并将项目关联
2. Story 1.2: Csaas认证与权限集成
3. Story 1.3: 评估完成后自动识别薄弱项
4. Story 1.4: 统一导航与首次登录引导

**Sprint 3-4 (Epic 2前半部分)**:
5. Story 2.1: 自动采集技术信息并支持外部导入
6. Story 2.2: 使用AI智能分析推送内容的相关性

**MVP完成**: 基础设施 + 技术雷达核心功能

---

## 🔧 工具和命令

### 查看当前状态

```bash
# 查看所有状态
cat _bmad-output/sprint-artifacts/sprint-status.yaml

# 统计各状态的Stories数量
grep -c ": backlog" _bmad-output/sprint-artifacts/sprint-status.yaml
grep -c ": ready-for-dev" _bmad-output/sprint-artifacts/sprint-status.yaml
grep -c ": in-progress" _bmad-output/sprint-artifacts/sprint-status.yaml
grep -c ": review" _bmad-output/sprint-artifacts/sprint-status.yaml
grep -c ": done" _bmad-output/sprint-artifacts/sprint-status.yaml
```

### 更新状态（手动编辑）

```bash
# 编辑sprint-status.yaml
code _bmad-output/sprint-artifacts/sprint-status.yaml

# 格式化YAML（可选）
# 确保缩进正确，避免YAML解析错误
```

---

## 📈 进度报告模板

### 每周Sprint Review报告

**Sprint X (Week Y) Progress Report**

**Epic完成情况**:
- Epic 1: X/4 stories done (XX%)
- Epic 2: Y/5 stories done (XX%)
- ...

**Story状态分布**:
- backlog: XX
- ready-for-dev: XX
- in-progress: XX
- review: XX
- done: XX

**本周完成**:
- Story X.X: [简述]
- Story Y.Y: [简述]

**下周计划**:
- 准备开发Story Z.Z
- 继续开发Story ...

**风险和阻塞**:
- [ ] 风险1: [描述]
- [ ] 阻塞1: [描述]

---

## 💡 最佳实践

### 1. 及时更新状态
- ⚠️ **不要批量更新状态** - 每完成一个步骤就更新
- ✅ **Dev开始开发时立即更新** `backlog` → `in-progress`
- ✅ **Dev提交Review时立即更新** `in-progress` → `review`
- ✅ **Review通过时立即更新** `review` → `done`

### 2. 保持Story文件同步
- Story文件中的`status`字段应该与sprint-status.yaml一致
- Story文件完成后，归档到`stories/completed/`文件夹

### 3. Epic状态自动化
- **Epic → in-progress**: 当第一个Story变为`ready-for-dev`时自动触发
- **Epic → done**: 当所有Stories都为`done`时手动更新

### 4. 定期Review
- **每日Standup**: SM检查状态，识别阻塞
- **每周Sprint Review**: 回顾本周完成情况
- **每月Review**: 评估整体进度，调整优先级

---

## 🆘 常见问题FAQ

### Q1: 何时创建Story文件？

**A**: 当SM准备将Story加入Sprint时创建Story文件（backlog → ready-for-dev）。

**时机**:
- ✅ Sprint Planning后
- ✅ 确认依赖满足
- ✅ 团队有容量

### Q2: Epic如何自动变为in-progress？

**A**: 当Epic的第一个Story从backlog变为ready-for-dev时，Epic自动变为in-progress。

**示例**:
```yaml
# Epic 1的所有Stories都在backlog
epic-1: backlog
1-1-xxx: backlog
1-2-xxx: backlog
1-3-xxx: backlog
1-4-xxx: backlog

# SM创建Story 1.1后
epic-1: in-progress  # 自动或手动更新
1-1-xxx: ready-for-dev
1-2-xxx: backlog
1-3-xxx: backlog
1-4-xxx: backlog
```

### Q3: 如何知道Epic完成了？

**A**: 检查sprint-status.yaml中该Epic的所有Stories状态：

```bash
# 检查Epic 1的完成情况
grep "^  1-" _bmad-output/sprint-artifacts/sprint-status.yaml

# 如果全部都是": done"，则更新Epic状态
epic-1: done
```

### Q4: 可以并行开发多个Stories吗？

**A**: 可以！只要团队容量允许。

**并行示例**:
```yaml
# 2人团队，可以同时开发2个Stories
1-1-system-automatically-creates-organization-and-associates-projects: in-progress  # Dev A
1-2-csaas-authentication-and-permission-integration: in-progress  # Dev B
1-3-automatically-identifies-weaknesses-after-assessment: backlog
1-4-unified-navigation-and-first-login-guidance: backlog
```

### Q5: Story文件保存在哪里？

**A**: 保存在`_bmad-output/sprint-artifacts/stories/`文件夹。

**文件命名**:
```
{epic}-{story}-{title}.md
例如: 1-1-system-automatically-creates-organization-and-associates-projects.md
```

---

## 🎉 下一步行动

27937，你现在拥有**完整的Sprint状态管理系统**！

### **立即开始的三步**:

1. **📋 查看完整Story列表**
   - 所有29个Stories都已就绪
   - 按Epic组织，层次清晰

2. **🚀 准备Sprint 1**
   - 使用我之前创建的`Sprint 1 Planning Guide`
   - 或选择其他Epic作为起点

3. **📊 开始追踪进度**
   - 创建Story 1.1文件（SM）
   - 更新sprint-status.yaml
   - 开始第一个开发任务

---

**你想要：**

**A. 深入了解某个Epic的Stories**
   - 我可以为你详细展示任何Epic的所有Stories详情

**B. 开始Sprint 1实施**
   - 我帮你创建Story 1.1的文件
   - 准备开发任务清单

**C. 调整开发顺序**
   - 想先做Epic 2还是Epic 3？
   - 我可以帮你重新排序

**D. 查看Story文件模板**
   - 我可以提供完整的Story文件模板

---

**告诉我你的选择，我们继续推进！** 🎯
