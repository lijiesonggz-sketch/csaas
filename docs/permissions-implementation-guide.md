# 项目权限系统完整实现指南

## 📋 背景
为了快速验证MVP，暂时简化了权限系统（只检查用户是否登录），但**后续必须恢复完整的权限检查**，因为涉及多租户数据隔离和用户隐私。

## 🎯 权限角色定义

### ProjectMemberRole
- **OWNER**: 项目所有者
  - 完全控制权限
  - 可以添加/移除成员
  - 可以修改成员角色
  - 可以重跑/回退任务

- **EDITOR**: 编辑者
  - 可以创建和编辑项目内容
  - 可以重跑/回退任务
  - 不能管理成员

- **VIEWER**: 查看者
  - 只能查看项目内容
  - 不能编辑
  - 不能管理成员
  - 不能重跑/回退任务

## 🔒 需要恢复的权限检查点

### 1. ProjectAccessGuard (`src/modules/projects/guards/project-access.guard.ts`)
**当前状态**: 只检查用户是否登录
**需要恢复**: 完整的项目成员关系检查

```typescript
// 完整实现（后续需要恢复）：
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest()
  const { projectId } = request.params
  const user = request.user || { id: request.headers['x-user-id'] }

  // 1. 检查用户是否登录
  if (!user || !user.id) {
    throw new ForbiddenException('用户未登录')
  }

  // 2. 检查项目是否存在
  const project = await this.projectsService.findOne(projectId, user.id)
  if (!project) {
    throw new NotFoundException('项目不存在')
  }

  // 3. 检查用户是否是项目成员
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    user.id,
  )

  if (!membership) {
    // 记录失败访问尝试
    await this.auditLogService.log({
      userId: user.id,
      projectId,
      action: 'ACCESS_PROJECT',
      success: false,
      errorMessage: '无权限访问此项目',
      req: request,
    })
    throw new ForbiddenException('您没有权限访问此项目')
  }

  // 4. 将项目信息和用户角色注入request
  request.project = project
  request.userRole = membership.role

  // 5. 记录成功访问
  await this.auditLogService.log({
    userId: user.id,
    projectId,
    action: 'ACCESS_PROJECT',
    success: true,
    req: request,
  })

  return true
}
```

### 2. ProjectsService (`src/modules/projects/services/projects.service.ts`)
**需要恢复的检查**:

#### findOne()
```typescript
async findOne(projectId: string, userId: string): Promise<Project> {
  const project = await this.projectRepo.findOne({
    where: { id: projectId },
    relations: ['owner'],
  })

  if (!project) {
    throw new NotFoundException('项目不存在')
  }

  // 恢复：检查用户是否是项目成员
  const membership = await this.projectMemberRepo.findOne({
    where: { projectId, userId },
  })

  if (!membership) {
    throw new ForbiddenException('您没有权限访问此项目')
  }

  return project
}
```

#### update()
```typescript
async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<Project> {
  const project = await this.findOne(projectId, userId)

  // 恢复：检查权限（OWNER和EDITOR可以编辑）
  const membership = await this.projectMemberRepo.findOne({
    where: { projectId, userId },
  })

  if (!membership || ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)) {
    throw new ForbiddenException('只有项目所有者和编辑者可以编辑项目')
  }

  Object.assign(project, dto)
  await this.projectRepo.save(project)

  return project
}
```

#### remove()
```typescript
async remove(projectId: string, userId: string): Promise<void> {
  const project = await this.findOne(projectId, userId)

  // 恢复：只有OWNER可以删除项目
  const membership = await this.projectMemberRepo.findOne({
    where: { projectId, userId },
  })

  if (!membership || membership.role !== ProjectMemberRole.OWNER) {
    throw new ForbiddenException('只有项目所有者可以删除项目')
  }

  await this.projectRepo.softRemove(project)
}
```

#### findAll()
```typescript
async findAll(userId: string): Promise<Project[]> {
  // 当前已经正确：只返回用户有权限的项目
  const projects = await this.projectRepo
    .createQueryBuilder('project')
    .innerJoin('project.members', 'member')
    .where('member.user_id = :userId', { userId })
    .leftJoinAndSelect('project.owner', 'owner')
    .orderBy('project.updated_at', 'DESC')
    .getMany()

  // ... 添加进度信息
  return projects
}
```

### 3. ProjectsController 角色检查
**需要恢复的端点**:

#### 添加成员 (`POST /projects/:id/members`)
```typescript
async addMember(...) {
  // 恢复：只有OWNER可以添加成员
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    userId,
  )

  if (!membership || membership.role !== ProjectMemberRole.OWNER) {
    return {
      success: false,
      message: '只有项目所有者可以添加成员',
    }
  }

  // ... 添加成员逻辑
}
```

#### 更新成员角色 (`PATCH /projects/:id/members/:userId`)
```typescript
async updateMemberRole(...) {
  // 恢复：只有OWNER可以修改角色
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    currentUserId,
  )

  if (!membership || membership.role !== ProjectMemberRole.OWNER) {
    return {
      success: false,
      message: '只有项目所有者可以修改成员角色',
    }
  }

  // ... 更新逻辑
}
```

#### 移除成员 (`DELETE /projects/:id/members/:userId`)
```typescript
async removeMember(...) {
  // 恢复：只有OWNER可以移除成员
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    currentUserId,
  )

  if (!membership || membership.role !== ProjectMemberRole.OWNER) {
    throw new Error('只有项目所有者可以移除成员')
  }

  // ... 移除逻辑
}
```

#### 重跑任务 (`POST /projects/:id/rerun`)
```typescript
async rerunTask(...) {
  // 恢复：OWNER和EDITOR可以重跑任务
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    userId,
  )

  if (!membership || ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)) {
    return {
      success: false,
      message: '只有项目所有者和编辑者可以重跑任务',
    }
  }

  // ... 重跑逻辑
}
```

#### 回退任务 (`POST /projects/:id/rollback`)
```typescript
async rollbackTask(...) {
  // 恢复：OWNER和EDITOR可以回退
  const membership = await this.projectMembersService.findByProjectAndUser(
    projectId,
    userId,
  )

  if (!membership || ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)) {
    return {
      success: false,
      message: '只有项目所有者和编辑者可以回退任务',
    }
  }

  // ... 回退逻辑
}
```

## 🔍 关键修复点（TypeORM查询问题）

### 问题记录
在开发过程中发现TypeORM查询`project_members`表返回null，但直接SQL可以查询到数据。

### 可能原因
1. 实体字段映射问题（`@Column`装饰器）
2. 数据库列名vs实体属性名不一致
3. 关系配置问题

### 需要验证的地方
```typescript
// ProjectMember entity的字段映射是否正确
@Entity('project_members')
export class ProjectMember {
  @Column({ name: 'project_id' })
  projectId: string

  @Column({ name: 'user_id' })
  userId: string

  @Column({ type: 'varchar', length: 20 })  // 已经从enum改为varchar
  role: ProjectMemberRole

  // ... 其他字段
}
```

## ✅ 恢复检查清单

完成权限系统恢复时，按照以下顺序检查：

- [ ] **ProjectAccessGuard**: 恢复完整权限检查逻辑
- [ ] **ProjectsService.findOne()**: 添加成员关系检查
- [ ] **ProjectsService.update()**: 添加OWNER/EDITOR权限检查
- [ ] **ProjectsService.remove()**: 添加OWNER权限检查
- [ ] **ProjectsController.addMember()**: 添加OWNER权限检查
- [ ] **ProjectsController.updateMemberRole()**: 添加OWNER权限检查
- [ ] **ProjectsController.removeMember()**: 添加OWNER权限检查
- [ ] **ProjectsController.rerunTask()**: 添加OWNER/EDITOR权限检查
- [ ] **ProjectsController.rollbackTask()**: 添加OWNER/EDITOR权限检查
- [ ] **测试**: TypeORM project_members查询功能正常
- [ ] **测试**: 所有API的权限拦截正常工作
- [ ] **审计日志**: 确保所有权限失败都被记录

## 📝 相关文件

### 需要修改的文件
1. `src/modules/projects/guards/project-access.guard.ts` - Guard完整逻辑
2. `src/modules/projects/services/projects.service.ts` - Service层权限检查
3. `src/modules/projects/controllers/projects.controller.ts` - Controller层角色检查

### 数据库表
- `project_members` - 项目成员关系表
- `audit_logs` - 审计日志表

### 相关Entities
- `ProjectMember` - 成员关系实体
- `AuditLog` - 审计日志实体

## 🔐 安全考虑

1. **数据隔离**: 确保用户只能访问自己有权限的项目
2. **审计追踪**: 所有权限失败尝试都要记录
3. **最小权限原则**: VIEWER角色只有只读权限
4. **操作记录**: 敏感操作（添加/移除成员、角色变更）必须记录

## 📅 实施建议

当准备恢复完整权限系统时：

1. **创建feature分支**: `feature/restore-project-permissions`
2. **逐个恢复**: 按照检查清单，一次恢复一个检查点
3. **单元测试**: 为每个权限检查编写测试用例
4. **集成测试**: 测试完整的权限流程
5. **代码审查**: 重点检查是否有遗漏的权限检查点
6. **灰度发布**: 先在测试环境验证，再逐步推广

## 🎯 验证测试场景

恢复后需要测试的场景：

1. **OWNER权限**:
   - 可以查看、编辑、删除项目
   - 可以添加、移除、修改成员
   - 可以重跑、回退任务

2. **EDITOR权限**:
   - 可以查看、编辑项目
   - 可以重跑、回退任务
   - 不能管理成员

3. **VIEWER权限**:
   - 只能查看项目
   - 不能编辑
   - 不能管理成员
   - 不能重跑、回退任务

4. **非成员访问**:
   - 返回403 Forbidden
   - 记录审计日志

5. **未登录访问**:
   - 返回401 Unauthorized或403 Forbidden
