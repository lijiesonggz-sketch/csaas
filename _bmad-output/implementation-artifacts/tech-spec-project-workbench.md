# Tech-Spec: 项目工作台与版本管理系统

**Created:** 2025-12-31
**Updated:** 2025-12-31 (Party Mode Review - Simplified)
**Status:** Ready for Development
**Phase:** Month 3 (Week 9)
**Author:** Barry (Quick Flow Solo Dev)
**Reviewers:** Winston (Architect), Sally (UX), John (PM), Murat (Test Architect)
**Dependencies:** Phase 1 + Phase 2 (已完成)

**⚠️ 重要变更**：经过专家团队审查，版本管理方案已从"完整版本历史"简化为"单步版本保留（备份+回退）"，降低开发成本约5天。详见"Version Management (Simplified)"章节。

---

## Overview

### Problem Statement

Csaas平台已完成AI生成引擎的核心功能（综述、聚类、矩阵、问卷、措施），但存在三个关键的用户体验和安全问题：

#### 问题1：割裂的页面体验
**现状**：
- 6个AI生成功能（上传→综述→聚类→矩阵→问卷→措施）都是独立页面
- 用户需要记忆/手工输入URL（如 `/ai-generation/clustering?taskId=uuid`）
- 缺少统一的项目视图和工作流导航
- 任务执行期间无法方便查看之前的步骤，只能"干等"

**影响**：
- 用户迷失在独立页面中，无法感知整体进度
- 新手用户难以理解工作流程
- 任务等待体验差，无法并行查看多个步骤

#### 问题2：任务ID缺乏语义
**现状**：
- 所有任务使用UUID标识（如 `a1b2c3d4-e5f6-...`）
- 用户看到一堆数字字母，无法识别任务内容
- URL中直接暴露任务ID

**影响**：
- 用户难以区分不同项目
- 无法快速找到历史项目
- 专业性不足，影响用户信心

#### 问题3：安全问题
**现状**：
- URL直接暴露任务ID，用户可以手工修改ID访问他人任务
- 缺少项目级别的权限控制
- 无访问审计日志

**影响**：
- 存在越权访问风险（数据泄露）
- 无法追溯谁访问了哪些项目
- 不符合企业级安全要求

### Solution

**构建项目工作台系统**，以项目为核心抽象层，整合所有AI生成功能：

#### 核心架构
```
用户登录
  ↓
项目列表页 (/projects)
  - 显示所有可访问的项目
  - 项目卡片：名称、客户、标准、进度、状态
  ↓
点击某个项目
  ↓
项目工作台 (/projects/[projectId])
  - 顶部：项目信息（名称、描述、创建时间、状态）
  - 中部：工作流步骤Tab导航（上传→综述→聚类→矩阵→问卷→措施）
  - 主体：当前步骤内容
  - 右侧：版本历史（显示历史版本）
```

#### 关键特性

**1. 项目命名系统**
- 用户创建项目时定义：项目名称、客户名称、评估标准、项目描述
- 项目生成UUID作为内部标识
- 历史数据迁移到"数据安全测试项目"（系统账号）

**2. 工作流步骤导航**
- 6个步骤Tab：上传、综述、聚类、矩阵、问卷、措施
- 每个步骤显示状态图标：⚪未开始 / ⚙️进行中 / ✅已完成 / ⚠️失败
- 用户可随时点击任何Tab查看内容
- 进行中的步骤显示实时进度（WebSocket）

**3. 版本管理系统（MVP简化版 - 单步备份与回退）** ⭐
- **任务重跑（with备份）**：用户可重新执行任何步骤，系统自动备份当前版本
- **备份机制**：每次重跑前，将当前结果存入 `backup_result` 字段
- **回退功能**：如果新版本不满意，可回退到备份版本
- **简单明了**：每个任务最多保留2个版本（当前版本 + 备份版本）
- **V1.1升级路径**：根据用户反馈，可升级到完整版本历史（树形可视化）

**设计理由**：
- ✅ 降低开发成本：从4天 → 1.5天
- ✅ 保留核心价值：支持回退（解决"新结果更差"的问题）
- ✅ 数据库不爆炸：每个任务最多2个版本
- ✅ MVP够用：AI质量稳定后，重跑需求会降低

**4. 权限系统**
- **三种角色**：OWNER（所有者）、EDITOR（编辑者）、VIEWER（查看者）
- **ProjectAccessGuard**：后端强制权限验证
- **前端路由保护**：Middleware拦截无权限访问
- **审计日志**：记录所有访问尝试（成功/失败）

**5. 项目状态管理**
- **DRAFT**：草稿（刚创建）
- **ACTIVE**：进行中（至少一个步骤完成）
- **COMPLETED**：已完成（所有6个步骤都完成）
- **ARCHIVED**：已归档（用户手动归档）

### Scope (In/Out)

#### ✅ Week 9 In-Scope

**数据模型**
- [ ] 扩展 `projects` 表（添加 client_name, standard_name 字段）
- [ ] 创建 `project_members` 表（多对多关系）
- [ ] 修改 `ai_tasks` 表（添加版本管理字段）
- [ ] 创建 `system_users` 表（系统账号）
- [ ] 创建 `audit_logs` 表（访问审计）

**后端API**
- [ ] ProjectsModule + ProjectsController + ProjectsService
- [ ] ProjectAccessGuard（权限验证）
- [ ] ProjectMembersService（成员管理）
- [ ] TaskRerunService（简化版：备份+回退，~80行代码）
- [ ] AuditLogService（审计日志记录，MVP不提供查询UI）
- [ ] 项目CRUD API
- [ ] 项目列表API（仅返回用户有权限的项目）
- [ ] 任务重跑API（Rerun with Backup）
- [ ] 任务回退API（Rollback to Backup）

**前端UI**
- [ ] 项目列表页面 (`/projects`)
- [ ] 项目工作台页面 (`/projects/[projectId]`)
- [ ] StepsTabNavigator组件（步骤Tab导航）
- [ ] TaskStatusIndicator组件（状态指示器）
- [ ] RollbackButton组件（回退到备份版本按钮）
- [ ] CreateProjectDialog组件（创建项目对话框）
- [ ] RerunTaskDialog组件（重跑任务确认对话框，含明确文案）
- [ ] ~~VersionHistory组件~~（移至V1.1）
- [ ] ~~VersionTimeline组件~~（移至V1.1）

**系统集成**
- [ ] 将现有AI生成页面整合到工作台Tab
- [ ] 修改API调用，使用projectId而非taskId
- [ ] WebSocket实时进度推送集成
- [ ] 数据迁移脚本（历史数据）

#### ❌ Week 9 Out-of-Scope

以下功能留待后续版本实现：
- ❌ 完整版本历史（树形可视化、多版本对比） → V1.1（根据用户反馈决定优先级）
- ❌ 审计日志查询UI → V1.1（MVP只记录数据，供管理员直接查库）
- ❌ 审计日志归档策略 → V1.1（MVP数据量小，无需归档）
- ❌ 项目模板功能 → V1.2
- ❌ 细粒度权限（步骤级别的权限控制） → V2.0
- ❌ 项目分享功能（外部链接） → V1.2
- ❌ 项目复制/克隆 → V1.3
- ❌ Slug短链接（使用UUID即可） → V2.0

---

## Context for Development

### Database Schema

#### 1. 扩展 `projects` 表

```sql
-- 添加新字段
ALTER TABLE projects
ADD COLUMN client_name VARCHAR(100),
ADD COLUMN standard_name VARCHAR(100),
ADD COLUMN metadata JSONB DEFAULT '{}';

-- 创建索引
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
```

**字段说明**：
- `client_name`：客户名称（如"中国银行"）
- `standard_name`：评估标准（如"ISO27001", "DCMM"）
- `metadata`：扩展字段（JSONB格式，存储额外配置）

#### 2. 创建 `project_members` 表

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'OWNER', 'EDITOR', 'VIEWER'
  added_at TIMESTAMP DEFAULT NOW(),
  added_by UUID REFERENCES users(id),

  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

**角色权限**：
| 角色 | 创建项目 | 编辑项目 | 删除项目 | 执行AI任务 | 重跑任务 | 查看内容 |
|-----|---------|---------|---------|-----------|---------|---------|
| OWNER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EDITOR | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| VIEWER | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

#### 3. 修改 `ai_tasks` 表（简化版版本管理 - 单步备份）

```sql
-- 添加备份字段（MVP最小化修改）
ALTER TABLE ai_tasks
ADD COLUMN backup_result JSONB,
ADD COLUMN backup_created_at TIMESTAMP;

-- 创建索引（优化备份查询）
CREATE INDEX idx_ai_tasks_backup ON ai_tasks(project_id, type)
WHERE backup_result IS NOT NULL;
```

**版本管理逻辑（简化版）**：
```
初始生成：result=<初始结果>, backup_result=NULL

重跑任务（with backup）：
1. 将当前result存入backup_result, backup_created_at=NOW()
2. 创建新任务：result=<新生成的结果>, backup_result=NULL
3. 如果新版本不满意 → 回退：将backup_result复制回result
4. 回退后再次重跑 → 覆盖backup_result（不是累积历史）
```

**相比原设计的简化**：
- ❌ 移除：version, version_label, superseded_by, is_active, rerun_count, rerun_reason
- ✅ 保留：backup_result, backup_created_at
- 📉 数据库字段：6个 → 2个
- 📉 代码复杂度：~410行 → ~80行
- 📉 测试用例：15+个 → 7个核心用例

#### 4. 创建 `system_users` 表

```sql
CREATE TABLE system_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(100) UNIQUE,
  name VARCHAR(100),
  type VARCHAR(50) DEFAULT 'SYSTEM', -- 'SYSTEM', 'SERVICE'
  created_at TIMESTAMP DEFAULT NOW()
);

-- 插入系统账号
INSERT INTO system_users (id, email, name, type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@csaas.local',
  'System Account',
  'SYSTEM'
) ON CONFLICT (email) DO NOTHING;
```

#### 5. 创建 `audit_logs` 表

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  action VARCHAR(50) NOT NULL, -- 'ACCESS_PROJECT', 'RERUN_TASK', 'VIEW_VERSION'
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### Codebase Patterns

#### 后端代码规范

**新增模块结构**：
```
/src/modules/projects/
  ├── entities/
  │   ├── project.entity.ts (已存在，需扩展)
  │   ├── project-member.entity.ts
  │   └── task-version.entity.ts (虚拟实体，基于ai_tasks)
  ├── dto/
  │   ├── create-project.dto.ts
  │   ├── update-project.dto.ts
  │   ├── rerun-task.dto.ts
  │   └── query-versions.dto.ts
  ├── guards/
  │   └── project-access.guard.ts
  ├── services/
  │   ├── projects.service.ts
  │   ├── project-members.service.ts
  │   ├── task-version.service.ts
  │   └── audit-log.service.ts
  ├── controllers/
  │   └── projects.controller.ts
  └── projects.module.ts
```

**关键服务接口**：

```typescript
// ProjectsService
class ProjectsService {
  create(userId: string, dto: CreateProjectDto): Promise<Project>
  findAll(userId: string): Promise<Project[]> // 仅返回用户有权限的项目
  findOne(projectId: string, userId: string): Promise<Project>
  update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<Project>
  remove(projectId: string, userId: string): Promise<void>
  updateStatus(projectId: string, status: ProjectStatus): Promise<void>
}

// TaskRerunService（简化版）
class TaskRerunService {
  rerunWithBackup(projectId: string, taskType: AITaskType): Promise<AITask> // ~50行
  rollbackToBackup(projectId: string, taskType: AITaskType): Promise<AITask> // ~30行
  hasBackup(projectId: string, taskType: AITaskType): Promise<boolean> // ~10行
}

// ~~TaskVersionService~~（完整版移至V1.1）

// AuditLogService
class AuditLogService {
  log(params: {
    userId: string,
    projectId: string,
    action: string,
    success: boolean,
    req: Request
  }): Promise<void>
  queryProjectAccess(projectId: string): Promise<AuditLog[]>
}
```

**ProjectAccessGuard实现**：

```typescript
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const projectId = request.params.projectId
    const user = request.user

    // 1. 检查项目是否存在
    const project = await this.projectsRepository.findOne(projectId)
    if (!project) {
      throw new NotFoundException('项目不存在')
    }

    // 2. 检查用户是否有权限
    const membership = await this.projectMembersRepository.findOne({
      where: { project_id: projectId, user_id: user.id }
    })

    if (!membership) {
      // 记录失败访问尝试
      this.auditLogService.log({
        userId: user.id,
        projectId: projectId,
        action: 'ACCESS_PROJECT',
        success: false,
        req: request
      })
      throw new ForbiddenException('您没有权限访问此项目')
    }

    // 3. 将项目信息注入request
    request.project = project
    request.userRole = membership.role

    // 4. 记录成功访问
    this.auditLogService.log({
      userId: user.id,
      projectId: projectId,
      action: 'ACCESS_PROJECT',
      success: true,
      req: request
    })

    return true
  }
}
```

#### 前端代码规范

**页面结构**：
```
/app
  /projects/
    page.tsx              # 项目列表页
    [projectId]/
      page.tsx            # 项目工作台主页
      layout.tsx          # 工作台布局（侧边栏+主内容）
```

**组件结构**：
```
/components/projects/
  ├── ProjectList.tsx              # 项目列表
  ├── ProjectCard.tsx              # 项目卡片
  ├── ProjectWorkbench.tsx         # 工作台主容器
  ├── StepsTabNavigator.tsx        # 步骤Tab导航
  ├── TaskStatusIndicator.tsx      # 任务状态指示器
  ├── RollbackButton.tsx           # 回退按钮（新增）
  ├── CreateProjectDialog.tsx      # 创建项目对话框
  └── RerunTaskDialog.tsx          # 重跑任务确认对话框（含明确文案）
```

**移至V1.1的组件**：
- ~~VersionHistory.tsx~~ - 版本历史侧边栏（完整版）
- ~~VersionTimeline.tsx~~ - 版本时间线（树形可视化）
- ~~CascadeWarningDialog.tsx~~ - 级联失效警告（简化版不需要）

**StepsTabNavigator组件设计**：

```typescript
interface Step {
  id: string // 'upload', 'summary', 'clustering', 'matrix', 'questionnaire', 'action-plan'
  name: string // '上传文档', '综述生成', ...
  icon: string // React icon
  route: string // `/projects/${projectId}/${stepId}`
  status: 'pending' | 'processing' | 'completed' | 'failed'
  activeVersion?: { // 当前活跃版本
    version: number
    label: string
    createdAt: Date
  }
}

interface StepsTabNavigatorProps {
  projectId: string
  steps: Step[]
  currentStepId: string
  onStepChange: (stepId: string) => void
}

// UI设计：
// ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐
//  │ ✓ │   │ ✓ │   │ ⚙️ │   │ ○ │   │ ○ │   │ ○ │
// │上传│   │综述│   │聚类│   │矩阵│   │问卷│   │措施│
// └───┘   └───┘   └───┘   └───┘   └───┘   └───┘
// 点击任何Tab都可切换查看
```

**RollbackButton组件设计**（新增）：

```typescript
interface RollbackButtonProps {
  projectId: string
  taskType: AITaskType
  hasBackup: boolean // 从API查询
  onRollback: () => void
}

// UI设计：
// ┌────────────────────────────────────┐
// 📤 上传文档  │ ✅ 综述生成  │ ⚙️ 聚类生成  │ ...
//                                      │
// [回退到备份版本] [重新生成]           │
// └────────────────────────────────────┘
//
// 点击"回退到备份版本"后：
// ┌────────────────────────────────────┐
// ⚠️ 回退确认                         │
//                                    │
// 将回退到上一个版本（2025-12-31 14:30）│
// 回退后，当前版本将被覆盖            │
//                                    │
// [取消]           [确认回退]         │
// └────────────────────────────────────┘

// 如果没有备份：
// 按钮禁用 + tooltip："暂无备份版本"
```

### Files to Reference

**后端关键文件**：
- `backend/src/database/entities/project.entity.ts` - Project实体（需扩展）
- `backend/src/database/entities/ai-task.entity.ts` - AITask实体（需添加版本字段）
- `backend/src/modules/ai-generation/ai-generation.controller.ts` - 参考AI生成API设计
- `backend/src/modules/ai-clients/ai-orchestrator.service.ts` - AI编排器（任务重跑需调用）

**前端关键文件**：
- `frontend/app/ai-generation/summary/page.tsx` - 综述生成页面（需整合到工作台）
- `frontend/app/ai-generation/clustering/page.tsx` - 聚类生成页面（需整合）
- `frontend/app/ai-generation/matrix/page.tsx` - 矩阵生成页面（需整合）
- `frontend/lib/api/ai-generation.ts` - API调用封装（需改造）

**现有配置文件**：
- `backend/.env.development` - 后端环境变量（添加系统账号配置）
- `frontend/.env.local` - 前端环境变量

### Technical Decisions

#### 决策1：任务重跑with备份逻辑（简化版）

**场景**：用户对当前的聚类结果不满意，想调整参数重新生成

**重跑逻辑**（~50行代码）：
```typescript
async rerunWithBackup(projectId: string, taskType: AITaskType): Promise<AITask> {
  // 1. 查找当前活跃任务
  const currentTask = await this.aiTaskRepository.findOne({
    where: { project_id: projectId, type: taskType }
  })

  if (!currentTask) {
    throw new Error('没有可重跑的任务')
  }

  // 2. 将当前结果存入backup_result
  currentTask.backup_result = currentTask.result
  currentTask.backup_created_at = new Date()
  await this.aiTaskRepository.save(currentTask)

  // 3. 创建新任务（调用现有AI生成逻辑）
  const newTask = await this.aiGenerationService.generate(projectId, {
    type: taskType
  })

  // 4. 标记旧任务为非活跃
  currentTask.is_active = false
  await this.aiTaskRepository.save(currentTask)

  return newTask
}
```

**回退逻辑**（~30行代码）：
```typescript
async rollbackToBackup(projectId: string, taskType: AITaskType): Promise<AITask> {
  // 1. 查找当前活跃任务
  const currentTask = await this.aiTaskRepository.findOne({
    where: { project_id: projectId, type: taskType, is_active: true }
  })

  if (!currentTask) {
    throw new Error('当前没有活跃版本')
  }

  // 2. 检查是否有备份
  if (!currentTask.backup_result) {
    throw new Error('没有可回退的备份版本')
  }

  // 3. 创建回退任务（新生成一个任务ID）
  const rollbackTask = await this.aiTaskRepository.save({
    project_id: projectId,
    type: taskType,
    result: currentTask.backup_result, // 复制备份数据
    status: TaskStatus.COMPLETED,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  })

  // 4. 标记当前任务为失效
  currentTask.is_active = false
  await this.aiTaskRepository.save(currentTask)

  return rollbackTask
}
```

**备份幂等性保证**：
```
v1.0（current）→ 重跑 → v2.0（current，backup=v1.0）
v2.0（current）→ 回退 → v1.1（current，backup=v2.0）
v1.1（current）→ 重跑 → v3.0（current，backup=v1.1）
```
每次重跑都覆盖`backup_result`，不是累积历史。

#### 决策2：重跑任务对话框的UX文案（Sally建议）

**明确的用户提示**：
```
┌────────────────────────────────────┐
│ 重新生成聚类                       │
├────────────────────────────────────┤
│ ⚠️ 注意：                         │
│                                    │
│ 重新生成将替换当前的聚类结果        │
│                                    │
│ 系统会自动备份当前版本，如果新结果  │
│ 不满意，您可以随时回退到备份版本    │
│                                    │
│ [取消]           [确认重跑]         │
└────────────────────────────────────┘
```

**关键UX改进**：
- ✅ 明确说明"失效≠除失"（"可以随时回退"）
- ✅ 强调系统自动备份（降低用户焦虑）
- ✅ 移除复杂的"级联失效"说明（简化版不级联失效）
- ✅ V1.0 MVP不显示"失效"图标（因为不会级联失效）

#### 决策3：项目状态自动更新规则

**触发条件**：
```typescript
async function updateProjectStatus(projectId: string): Promise<void> {
  // 1. 获取所有步骤的最新活跃任务
  const activeTasks = await this.aiTaskRepository.find({
    where: { project_id: projectId, is_active: true }
  })

  // 2. 检查完成状态
  const allSteps = [
    AITaskType.SUMMARY,
    AITaskType.CLUSTERING,
    AITaskType.MATRIX,
    AITaskType.QUESTIONNAIRE,
    AITaskType.ACTION_PLAN
  ]

  const completedSteps = activeTasks.filter(
    task => task.status === TaskStatus.COMPLETED
  ).map(task => task.type)

  const allCompleted = allSteps.every(step => completedSteps.includes(step))
  const anyCompleted = completedSteps.length > 0

  // 3. 更新状态
  if (allCompleted) {
    await this.projectsRepository.update(projectId, {
      status: ProjectStatus.COMPLETED
    })
  } else if (anyCompleted) {
    await this.projectsRepository.update(projectId, {
      status: ProjectStatus.ACTIVE
    })
  }
}
```

#### 决策4：权限检查的三层防护

**Layer 1：前端路由保护**（Middleware）
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('next-auth.session-token')
  const projectMatch = request.nextUrl.pathname.match(/^\/projects\/([^\/]+)/)

  if (projectMatch) {
    const projectId = projectMatch[1]
    const hasAccess = await checkProjectAccess(projectId, token)

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return NextResponse.next()
}
```

**Layer 2：后端Guard**（强制）
```typescript
@UseGuards(ProjectAccessGuard)
@Controller('projects/:projectId')
export class ProjectsController {
  // 所有endpoint都通过Guard验证
}
```

**Layer 3：数据库查询过滤**（防御深度）
```typescript
// 所有查询都自动过滤
async findAll(userId: string): Promise<Project[]> {
  return this.projectsRepository
    .createQueryBuilder('project')
    .innerJoin('project.members', 'member')
    .where('member.user_id = :userId', { userId })
    .getMany()
}
```

---

## Implementation Plan

### Tasks

#### Task 1: 数据库schema设计和迁移
- [ ] 1.1 扩展projects表（添加client_name, standard_name）
- [ ] 1.2 创建project_members表
- [ ] 1.3 修改ai_tasks表（添加版本管理字段）
- [ ] 1.4 创建system_users表并插入系统账号
- [ ] 1.5 创建audit_logs表
- [ ] 1.6 创建数据库迁移脚本（migration文件）
- [ ] 1.7 创建历史数据迁移脚本（现有任务关联到"数据安全测试项目"）

#### Task 2: 后端Entity和DTO
- [ ] 2.1 扩展Project entity（添加新字段）
- [ ] 2.2 创建ProjectMember entity
- [ ] 2.3 扩展AITask entity（添加版本字段）
- [ ] 2.4 创建SystemUser entity
- [ ] 2.5 创建AuditLog entity
- [ ] 2.6 创建CreateProjectDto
- [ ] 2.7 创建UpdateProjectDto
- [ ] 2.8 创建RerunTaskDto
- [ ] 2.9 创建QueryVersionsDto

#### Task 3: 权限和审计系统
- [ ] 3.1 实现ProjectAccessGuard
- [ ] 3.2 实现AuditLogService
- [ ] 3.3 创建ProjectMembersService
- [ ] 3.4 实现角色权限检查（OWNER/EDITOR/VIEWER）
- [ ] 3.5 创建审计日志查询API
- [ ] 3.6 测试权限边界（无权限访问应被拦截）

#### Task 4: 项目管理核心服务
- [ ] 4.1 实现ProjectsService（CRUD）
- [ ] 4.2 实现项目状态自动更新逻辑
- [ ] 4.3 实现项目列表API（仅返回有权限的项目）
- [ ] 4.4 实现项目详情API
- [ ] 4.5 实现项目更新API
- [ ] 4.6 实现项目删除API（软删除）

#### Task 5: 简化版版本管理系统（备份+回退）
- [ ] 5.1 实现TaskRerunService（~80行代码）
- [ ] 5.2 实现rerunWithBackup方法（~50行）
- [ ] 5.3 实现rollbackToBackup方法（~30行）
- [ ] 5.4 实现hasBackup辅助方法（~10行）
- [ ] 5.5 创建重跑任务API（POST /projects/:id/rerun）
- [ ] 5.6 创建回退任务API（POST /projects/:id/rollback）
- [ ] 5.7 单元测试（备份、回退、幂等性）

#### Task 6: 后端Controller集成
- [ ] 6.1 创建ProjectsController
- [ ] 6.2 应用ProjectAccessGuard到所有endpoint
- [ ] 6.3 实现POST /projects（创建项目）
- [ ] 6.4 实现GET /projects（项目列表）
- [ ] 6.5 实现GET /projects/:id（项目详情）
- [ ] 6.6 实现PATCH /projects/:id（更新项目）
- [ ] 6.7 实现DELETE /projects/:id（删除项目）
- [ ] 6.8 实现POST /projects/:id/rerun（重跑任务）
- [ ] 6.9 实现POST /projects/:id/rollback（回退任务）
- [ ] ~~GET /projects/:id/versions~~（移至V1.1）

#### Task 7: 前端API客户端
- [ ] 7.1 创建projects API封装（lib/api/projects.ts）
- [ ] 7.2 ~~创建taskVersions API封装~~（移至V1.1）
- [ ] 7.3 ~~创建auditLogs API封装~~（V1.1：查询UI）
- [ ] 7.4 集成到现有API client中

#### Task 8: 前端核心组件
- [ ] 8.1 创建ProjectList组件
- [ ] 8.2 创建ProjectCard组件
- [ ] 8.3 创建StepsTabNavigator组件
- [ ] 8.4 创建TaskStatusIndicator组件
- [ ] 8.5 创建RollbackButton组件（新增）
- [ ] 8.6 创建CreateProjectDialog组件
- [ ] 8.7 创建RerunTaskDialog组件（含明确文案）
- [ ] ~~8.5 创建VersionHistory组件~~（移至V1.1）
- [ ] ~~8.6 创建VersionTimeline组件~~（移至V1.1）
- [ ] ~~8.9 创建CascadeWarningDialog组件~~（简化版不需要）

#### Task 9: 前端页面开发
- [ ] 9.1 创建项目列表页面 `/projects/page.tsx`
- [ ] 9.2 创建项目工作台页面 `/projects/[projectId]/page.tsx`
- [ ] 9.3 创建工作台布局 `/projects/[projectId]/layout.tsx`
- [ ] 9.4 实现步骤Tab内容区域（动态加载对应页面）
- [ ] 9.5 集成现有AI生成页面到Tab系统

#### Task 10: API调用改造
- [ ] 10.1 修改综述生成页面，使用projectId
- [ ] 10.2 修改聚类生成页面，使用projectId
- [ ] 10.3 修改矩阵生成页面，使用projectId
- [ ] 10.4 修改问卷生成页面，使用projectId
- [ ] 10.5 修改措施生成页面，使用projectId
- [ ] 10.6 移除URL中的taskId参数

#### Task 11: WebSocket实时进度集成
- [ ] 11.1 在工作台页面建立WebSocket连接
- [ ] 11.2 监听任务进度更新事件
- [ ] 11.3 更新步骤Tab状态图标
- [ ] 11.4 显示实时进度百分比
- [ ] 11.5 任务完成时自动刷新步骤状态

#### Task 12: 数据迁移和测试
- [ ] 12.1 运行数据库迁移脚本
- [ ] 12.2 运行历史数据迁移脚本
- [ ] 12.3 验证系统账号创建成功
- [ ] 12.4 验证历史数据关联到"数据安全测试项目"
- [ ] 12.5 数据迁移完整性验证（AC 9.5新增）
- [ ] 12.6 创建测试用户和测试项目
- [ ] 12.7 测试项目创建流程
- [ ] 12.8 测试项目列表权限过滤
- [ ] 12.9 测试项目工作台导航
- [ ] 12.10 测试任务重跑功能（备份+生成）
- [ ] 12.11 测试任务回退功能（回退到备份）
- [ ] 12.12 测试备份幂等性（多次重跑+回退）
- [ ] ~~12.10 测试级联失效逻辑~~（简化版移除）
- [ ] ~~12.11 测试版本历史查看~~（移至V1.1）
- [ ] 12.13 测试权限边界（无权限用户访问拦截）
- [ ] 12.14 测试审计日志记录（数据层面，无UI）
- [ ] 12.15 完整工作流E2E测试（创建→上传→综述→聚类→矩阵→问卷→措施）
- [ ] 12.16 测试重跑+回退场景（重跑→不满意→回退→确认数据正确）

### Acceptance Criteria

#### AC 1：项目创建和列表
**Given** 用户已登录
**When** 用户访问 `/projects`
**Then** 显示用户有权限的所有项目
**And** 每个项目卡片显示：项目名称、客户名称、评估标准、进度百分比、状态
**And** 显示"创建新项目"按钮

#### AC 2：创建项目
**Given** 用户在项目列表页
**When** 用户点击"创建新项目"
**And** 填写表单（项目名称、客户名称、评估标准）
**And** 提交表单
**Then** 创建成功，跳转到项目工作台
**And** 用户自动成为项目OWNER
**And** 项目状态为DRAFT
**And** 所有步骤Tab显示为未开始状态

#### AC 3：项目工作台导航
**Given** 用户在项目工作台
**When** 用户查看工作流步骤
**Then** 显示6个步骤Tab：上传→综述→聚类→矩阵→问卷→措施
**And** 每个步骤显示状态图标（⚪未开始 / ⚙️进行中 / ✅已完成 / ⚠️失败）
**And** 用户可点击任何Tab查看内容

#### AC 4：任务执行和进度显示
**Given** 用户在工作台的"综述生成"Tab
**When** 用户点击"开始生成"
**Then** 综述Tab显示⚙️进行中图标
**And** 显示实时进度（如"生成中... 45%"）
**And** 用户可切换到其他Tab查看之前的内容
**When** 任务完成
**Then** 综述Tab显示✅已完成图标
**And** 自动跳到下一个Tab（聚类）
**And** 项目状态更新为ACTIVE

#### AC 5：任务重跑with备份
**Given** 项目已完成聚类生成
**When** 用户在"聚类"Tab点击"重新生成"
**Then** 显示确认对话框："重新生成将替换当前结果，系统会自动备份，如果新结果不满意，您可以随时回退"
**When** 用户确认
**Then** 当前结果存入backup_result字段
**And** 创建新的聚类任务
**And** "回退到备份版本"按钮变为可用状态
**And** 按钮显示备份创建时间（如"备份于 2025-12-31 14:30"）

#### AC 6：任务回退到备份
**Given** 用户已重跑聚类任务（有备份版本）
**When** 用户点击"回退到备份版本"按钮
**Then** 显示确认对话框："将回退到备份版本（2025-12-31 14:30），回退后当前版本将被覆盖"
**When** 用户确认回退
**Then** 创建新的回退任务，result = backup_result
**And** 当前任务标记为非活跃
**And** 回退任务的backup_result = 回退前的当前版本
**And** "回退到备份版本"按钮仍然可用（可以再次回退）
**And** 验证：回退任务的result数据与原备份完全一致

#### AC 7：备份幂等性（Murat建议）
**Given** 用户已执行多次重跑和回退操作
**When** 用户执行"重跑→回退→再重跑→再回退"循环
**Then** 每次重跑都覆盖backup_result（不是累积）
**And** 每次回退都正确复制数据
**And** 数据库中每个任务类型只有最多2个版本（当前+备份）
**And** 验证：backup_created_at时间戳正确更新

#### AC 8：权限控制
**Given** 用户A创建了项目P
**When** 用户B尝试直接访问 `/projects/P`
**Then** 后端返回403 Forbidden
**And** 记录审计日志（用户B尝试无权访问项目P）
**And** 前端重定向到 `/unauthorized` 页面
**When** 用户A将用户B添加为VIEWER
**And** 用户B再次访问
**Then** 用户B可以查看项目内容
**And** 但无法执行AI任务或重跑任务

#### AC 9：项目状态自动更新
**Given** 项目状态为ACTIVE
**When** 所有6个步骤都完成
**Then** 项目状态自动更新为COMPLETED
**And** 项目卡片显示"已完成"徽章

#### AC 9.5：历史数据迁移完整性验证（Murat建议）
**Given** 数据库中有100个旧的ai_tasks记录（无project_id）
**When** 运行数据迁移脚本
**Then** 所有100个任务都成功关联到"数据安全测试项目"
**And** 每个任务的result字段数据完整（JSONB格式验证）
**And** 每个任务的created_at保持原值（未修改）
**And** 创建的系统账号ID为 00000000-0000-0000-0000-000000000001
**And** 数据库级验证：
```sql
-- 验证所有任务都关联
SELECT COUNT(*) = 100 FROM ai_tasks
WHERE project_id IN (
  SELECT id FROM projects
  WHERE name = '数据安全测试项目'
);

-- 验证数据完整性
SELECT COUNT(*) = 100 FROM ai_tasks
WHERE project_id IN (
  SELECT id FROM projects WHERE name = '数据安全测试项目'
)
AND result IS NOT NULL
AND created_at IS NOT NULL;
```

#### AC 10：历史数据迁移
**Given** 系统中存在旧的ai_tasks记录（无project_id）
**When** 运行数据迁移脚本
**Then** 创建"数据安全测试项目"（系统账号为owner）
**And** 所有旧任务关联到该项目
**And** 每个任务保持原有数据和结果

---

## Additional Context

### Dependencies

**Phase 1依赖**：
- ✅ BullMQ任务队列系统
- ✅ AI Orchestrator（三模型并行调用）
- ✅ WebSocket实时进度推送
- ✅ 用户认证系统（NextAuth.js）

**Phase 2依赖**：
- ✅ 5个AI生成器（综述、聚类、矩阵、问卷、措施）
- ✅ ai_tasks表（需扩展）
- ✅ projects表（需扩展）

**外部服务**：
- PostgreSQL 15+（JSONB支持）
- Redis 7+（用于BullMQ）
- AI API服务（OpenAI, Anthropic, 通义千问）

### Testing Strategy

#### 单元测试
- ProjectsService各方法
- TaskRerunService重跑with备份逻辑（~3个测试用例）
- TaskRerunService回退逻辑（~2个测试用例）
- TaskRerunService备份幂等性（~2个测试用例）
- ProjectAccessGuard权限验证
- 项目状态自动更新逻辑

#### 集成测试
- API端点测试（创建、更新、删除、查询）
- 权限边界测试（无权限访问拦截）
- 审计日志记录测试
- 数据迁移脚本测试

#### E2E测试
- 完整工作流：创建项目→上传→综述→聚类→矩阵→问卷→措施
- 重跑+回退场景：重跑聚类→验证备份→回退→确认数据正确
- 权限场景：创建者→添加成员→验证不同角色权限
- ~~版本历史完整性~~（移至V1.1）
- 备份幂等性场景：重跑→回退→再重跑→再回退（验证数据一致性）

#### 性能测试
- 项目列表查询（100+项目）
- 备份查询性能（使用索引优化）
- 数据迁移性能（1000个任务迁移时间）

### Notes

**数据迁移注意事项**：
1. 迁移前备份数据库
2. 先在开发环境测试，确认无问题后在生产环境执行
3. 迁移脚本支持回滚（提供down migration）
4. 系统账号ID固定：`00000000-0000-0000-0000-000000000001`

**权限边界**：
- MVP阶段仅支持项目级别的权限（OWNER/EDITOR/VIEWER）
- 不支持步骤级别的权限控制（如"只能查看综述，不能修改矩阵"）
- 项目删除仅OWNER可执行

**版本管理限制（MVP简化版）**：
- 每个任务最多保留2个版本（当前版本 + 备份版本）
- 不支持完整版本历史（树形可视化、多版本对比）
- 不支持分支（Git-like branching）
- 备份版本不是累积历史（每次重跑覆盖备份）
- V1.1升级路径：根据用户反馈决定是否升级到完整版本历史

**UI/UX建议**：
- 使用Ant Design的Steps组件显示进度
- 使用Badge组件显示项目状态和任务状态
- 使用Popconfirm确认重跑操作（含明确文案：强调"可回退"）
- 使用Button + Tooltip实现"回退到备份版本"按钮
- ~~使用Timeline显示版本历史~~（移至V1.1）
-~~使用Modal显示级联失效警告~~（简化版不需要）

**国际化**：
- 项目名称、客户名称支持中文
- 错误提示消息支持中文
- ~~版本标签支持中文~~（MVP无版本标签）

**监控指标**：
- 项目创建成功率
- 任务重跑频率（用于评估V1.1是否需要完整版本历史）
- 备份使用频率（回退次数）
- 权限拦截次数
- 审计日志记录频率（数据层面）
- ~~级联失效次数~~（简化版移除）

---

## Party Mode Review Summary

**审查团队**：Winston (Architect), Sally (UX Designer), John (PM), Murat (Test Architect)

**主要优化决策**：

### 1. 版本管理简化（核心优化）
| 指标 | 原设计（完整版本历史） | 优化后（单步备份） | 节省 |
|-----|---------------------|-----------------|------|
| 数据库字段 | 6个 | 2个 | -67% |
| 后端代码量 | ~410行 | ~80行 | -80% |
| 前端组件 | 9个 | 6个 | -33% |
| 测试用例 | 15+个 | 7个 | -53% |
| 开发时间 | 4天 | 1.5天 | **-62%** |

**理由**：
- ✅ MVP用户重跑需求频率预计<10%（AI质量稳定后）
- ✅ 保留核心价值：支持回退（解决"新结果更差"的问题）
- ✅ 数据库不爆炸：每个任务最多2个版本
- ✅ V1.1升级路径：根据用户反馈决定是否升级

### 2. 审计日志UI延后
- **MVP**：只记录数据，供管理员直接查库
- **V1.1**：提供查询界面 + 归档策略
- **节省**：~2天开发时间

### 3. 测试用例补充
- **新增AC 9.5**：数据迁移完整性验证（SQL级断言）
- **新增AC 7**：备份幂等性测试（防止数据累积bug）

**总工作量对比**：

| 阶段 | 原Tech-Spec | 优化后 | 节省时间 |
|-----|-----------|--------|---------|
| 数据库设计 | 0.5天 | 0.5天 | - |
| 版本管理后端 | 4天 | 1.5天 | **2.5天** |
| 版本历史前端 | 2天 | 0.5天 | **1.5天** |
| 审计日志UI | 1.5天 | 0天（延后） | **1.5天** |
| 测试 | 2天 | 1天 | **1天** |
| **总计** | **10天** | **3.5天** | **6.5天 (65%)** |

**风险与缓解**：

⚠️ **风险1**：用户可能需要查看多个历史版本
- **缓解**：V1.1根据用户反馈决定是否升级

⚠️ **风险2**：重跑需求可能超出预期（>30%项目）
- **缓解**：监控"任务重跑频率"指标，V1.1优先级升级

✅ **核心价值保留**：
- 支持回退功能（解决"新结果更差"的问题）
- 项目工作台和权限系统（MVP必须）
- 数据完整性保障（备份幂等性测试）

**后续升级路径（V1.1）**：
- 完整版本历史（树形可视化）
- 审计日志查询UI + 归档策略
- 前提条件：用户反馈验证需求优先级

