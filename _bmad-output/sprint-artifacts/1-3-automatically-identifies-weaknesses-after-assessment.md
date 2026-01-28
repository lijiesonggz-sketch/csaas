# Story 1.3: 评估完成后自动识别薄弱项

**Epic**: Epic 1 - 基础设施与Csaas集成
**Story ID**: 1.3
**Story Key**: 1-3-automatically-identifies-weaknesses-after-assessment
**状态**: review
**优先级**: P1 (高)
**预计时间**: 2-3天
**依赖**: Story 1.1 (已完成), Story 1.2 (已完成)

---

## 用户故事

**As a** 金融机构IT总监
**I want** 系统在评估完成后自动识别我的薄弱项
**So that** Radar Service可以基于薄弱项推送相关内容

---

## 业务价值

### 为什么这个故事很重要?
1. **自动化薄弱项识别**: 无需手动标记,系统自动从评估结果中识别薄弱领域
2. **Radar Service数据基础**: 薄弱项是Radar推送相关性的核心计算依据
3. **组织级聚合**: 支持多项目环境的薄弱项聚合,提供组织级视图
4. **实时事件驱动**: 通过WebSocket实现实时通知,提升用户体验

### 成功指标
- ✅ 评估完成后5分钟内自动识别并保存薄弱项
- ✅ 薄弱项识别准确率100% (所有level<3的领域)
- ✅ 组织级聚合正确显示最低level和来源项目
- ✅ WebSocket事件成功触发并包含完整数据

---

## 验收标准 (Acceptance Criteria)

### AC 1: 评估完成触发WebSocket事件

**Given** 用户完成Csaas成熟度评估
**When** 评估结果保存成功
**Then** 系统通过WebSocket发送`assessment:completed`事件
**And** 事件包含`projectId`和完整评估结果

### AC 2: 自动识别并保存薄弱项

**Given** Radar Service接收到`assessment:completed`事件
**When** 事件处理开始
**Then** 解析评估结果,提取所有成熟度等级<3的领域作为薄弱项
**And** 为每个薄弱项创建WeaknessSnapshot记录
**And** 整个过程在5分钟内完成

### AC 3: 组织级薄弱项聚合

**Given** 组织有多个项目
**When** 用户访问Radar Service
**Then** 系统聚合所有项目的薄弱项
**And** 按category分组,显示最低level
**And** 标注薄弱项来源的项目名称

### AC 4: 项目筛选器

**Given** 用户选择筛选特定项目
**When** 用户在UI中选择项目筛选器
**Then** 仅显示选中项目的薄弱项
**And** 推送内容基于筛选后的薄弱项

---

## 技术实施计划

### Phase 1: WebSocket事件基础设施 (0.5天)

#### Task 1.1: 创建评估完成事件
**优先级**: P0 (阻塞项)
**关联AC**: AC 1

**实施步骤**:
1. 在`AITaskProcessor`中添加评估完成事件发送逻辑
2. 定义事件payload接口:
   ```typescript
   interface AssessmentCompletedEvent {
     projectId: string
     organizationId: string
     assessmentResult: {
       categories: Array<{
         name: string
         level: number
         description?: string
       }>
       completedAt: Date
     }
   }
   ```

3. 通过TasksGateway发送事件:
   ```typescript
   this.tasksGateway.emit('assessment:completed', {
     projectId,
     organizationId,
     assessmentResult: result,
   })
   ```

4. 创建单元测试验证事件发送

**文件清单**:
- `backend/src/modules/ai-tasks/processors/ai-task.processor.ts` (修改)
- `backend/src/modules/ai-tasks/processors/ai-task.processor.spec.ts` (新增测试)

---

### Phase 2: 薄弱项识别与保存 (1天)

#### Task 2.1: 创建薄弱项识别Service
**优先级**: P0 (阻塞项)
**关联AC**: AC 2

**实施步骤**:
1. 创建`WeaknessSnapshotService`:
   ```typescript
   // backend/src/modules/organizations/weakness-snapshot.service.ts
   async identifyAndSaveWeaknesses(
     projectId: string,
     assessmentResult: AssessmentResult
   ): Promise<WeaknessSnapshot[]>
   ```

2. 实现薄弱项识别逻辑:
   - 提取所有`level < 3`的category
   - 验证category名称规范化
   - 计算organizationId (通过Project查找)

3. 批量创建WeaknessSnapshot记录:
   ```typescript
   const snapshots = weakCategories.map(category =>
     this.weaknessSnapshotRepository.create({
       organizationId,
       projectId,
       category: category.name,
       level: category.level,
       description: category.description,
       createdAt: new Date(),
     })
   )
   await this.weaknessSnapshotRepository.save(snapshots)
   ```

4. 添加错误处理和日志记录

5. 创建单元测试:
   - 测试薄弱项识别正确性
   - 测试level<3过滤逻辑
   - 测试批量保存成功/失败场景
   - 测试edge case (空结果, 所有level>=3)

**文件清单**:
- `backend/src/modules/organizations/weakness-snapshot.service.ts` (新建)
- `backend/src/modules/organizations/weakness-snapshot.service.spec.ts` (新建)

---

#### Task 2.2: 创建WebSocket事件监听器
**优先级**: P0 (阻塞项)
**关联AC**: AC 2

**实施步骤**:
1. 创建`AssessmentEventListener`:
   ```typescript
   // backend/src/modules/radar/assessment-event.listener.ts
   @Injectable()
   export class AssessmentEventListener {
     constructor(
       private readonly weaknessService: WeaknessSnapshotService,
       @Inject('BullQueue_radars') private readonly radarQueue: Queue,
     ) {}

     @OnEvent('assessment:completed')
     async handleAssessmentCompleted(event: AssessmentCompletedEvent) {
       // 处理逻辑
     }
   }
   ```

2. 在事件处理器中:
   - 验证organizationId存在
   - 调用`weaknessService.identifyAndSaveWeaknesses()`
   - 记录处理时间和成功/失败状态
   - 处理超时 (5分钟限制)

3. 在`AppModule`中注册事件监听器

4. 创建集成测试:
   - Mock WebSocket事件
   - 验证事件监听器被调用
   - 验证薄弱项保存成功
   - 测试异步处理和超时

**文件清单**:
- `backend/src/modules/radar/assessment-event.listener.ts` (新建)
- `backend/src/modules/radar/assessment-event.listener.spec.ts` (新建)
- `backend/src/app.module.ts` (修改 - 注册监听器)

---

### Phase 3: 组织级薄弱项聚合 (0.5天)

#### Task 3.1: 实现组织级聚合API
**优先级**: P1 (高)
**关联AC**: AC 3

**实施步骤**:
1. 扩展`WeaknessSnapshotService`:
   ```typescript
   async getAggregatedWeaknesses(
     organizationId: string,
     projectIdFilter?: string
   ): Promise<AggregatedWeakness[]>
   ```

2. 实现聚合逻辑:
   - 如果没有`projectIdFilter`: 查询组织的所有薄弱项
   - 如果有`projectIdFilter`: 仅查询指定项目的薄弱项
   - 按`category`分组
   - 每组取最低`level`
   - 收集所有相关的`projectIds`
   - 关联Project表获取项目名称

3. 返回格式:
   ```typescript
   interface AggregatedWeakness {
     category: string
     level: number
     projectIds: string[]
     projectNames: string[]
     organizationId: string
   }
   ```

4. 添加到OrganizationsController:
   ```typescript
   @Get(':id/weaknesses/aggregated')
   @UseGuards(JwtAuthGuard, OrganizationGuard)
   async getAggregatedWeaknesses(
     @Param('id') organizationId: string,
     @Query('projectId') projectId?: string,
   ) {
     return this.weaknessService.getAggregatedWeaknesses(
       organizationId,
       projectId
     )
   }
   ```

5. 创建单元测试:
   - 测试聚合逻辑 (取最低level)
   - 测试项目筛选器
   - 测试多项目场景
   - 测试空结果场景

**文件清单**:
- `backend/src/modules/organizations/weakness-snapshot.service.ts` (修改)
- `backend/src/modules/organizations/weakness-snapshot.service.spec.ts` (修改)
- `backend/src/modules/organizations/organizations.controller.ts` (修改)

---

### Phase 4: E2E测试与验证 (0.5天)

#### Task 4.1: 创建E2E测试
**优先级**: P1 (高)
**关联AC**: 全部

**实施步骤**:
1. 创建E2E测试文件:
   ```typescript
   // backend/test/weakness-detection.e2e-spec.ts
   ```

2. 测试场景:
   - **场景1**: 完整流程测试
     - 创建项目和组织
     - 模拟评估完成事件
     - 验证薄弱项自动保存
     - 验证WebSocket事件触发

   - **场景2**: 多项目聚合测试
     - 创建组织,添加多个项目
     - 每个项目创建不同薄弱项
     - 验证聚合API返回正确结果
     - 验证最低level逻辑

   - **场景3**: 项目筛选器测试
     - 创建多个项目的薄弱项
     - 调用聚合API并传递projectId参数
     - 验证仅返回指定项目的薄弱项

   - **场景4**: 性能测试
     - 测量从评估完成到薄弱项保存的时间
     - 验证< 5分钟要求

3. 验证所有AC满足

**文件清单**:
- `backend/test/weakness-detection.e2e-spec.ts` (新建)

---

## Dev Notes

### 相关架构模式和约束

1. **WebSocket事件模式**:
   - 复用现有TasksGateway (`/tasks` namespace)
   - 事件命名: `assessment:completed`
   - 遵循现有事件payload结构

2. **数据库实体**:
   - WeaknessSnapshot实体已存在 (Story 1.1创建)
   - 字段: `id`, `organizationId`, `projectId`, `category`, `level`, `description`, `createdAt`
   - 索引: `(organizationId, category)`, `projectId`

3. **异步处理**:
   - 使用BullMQ处理薄弱项识别任务
   - 支持重试机制 (最多3次)
   - 超时控制 (5分钟)

4. **错误处理**:
   - WebSocket事件发送失败: 记录日志,不阻塞主流程
   - 薄弱项保存失败: 记录详细错误,发送告警
   - 聚合查询失败: 返回空数组,记录错误

5. **性能优化**:
   - 批量插入WeaknessSnapshot (使用`repository.save()`批量操作)
   - 聚合查询使用数据库聚合函数
   - Redis缓存聚合结果 (TTL: 1小时)

### 需要接触的源码树组件

**后端模块**:
- `backend/src/modules/ai-tasks/` - AITaskProcessor (发送评估完成事件)
- `backend/src/modules/organizations/` - WeaknessSnapshotService, OrganizationsController
- `backend/src/modules/radar/` - AssessmentEventListener (新建模块)
- `backend/src/modules/ai-tasks/gateways/` - TasksGateway (复用)

**数据库实体**:
- `backend/src/database/entities/weakness-snapshot.entity.ts`
- `backend/src/database/entities/project.entity.ts`
- `backend/src/database/entities/organization.entity.ts`

**测试文件**:
- `backend/test/weakness-detection.e2e-spec.ts` (新建)

### 测试标准总结

1. **单元测试** (TDD方法):
   - WeaknessSnapshotService: 识别逻辑, 聚合逻辑
   - AssessmentEventListener: 事件处理
   - AITaskProcessor: 事件发送

2. **集成测试**:
   - WebSocket事件端到端流程
   - 数据库保存和查询

3. **E2E测试**:
   - 完整评估→识别→聚合流程
   - 多项目场景
   - 性能验证

4. **测试覆盖率要求**:
   - 核心业务逻辑: ≥90%
   - Service层: ≥85%
   - Controller层: ≥80%

### 项目结构说明

**对齐统一项目结构**:
- Service路径: `backend/src/modules/{module}/{module}.service.ts`
- Controller路径: `backend/src/modules/{module}/{module}.controller.ts`
- Entity路径: `backend/src/database/entities/{entity}.entity.ts`
- Test路径: `backend/src/modules/{module}/{module}.spec.ts`

**命名约定**:
- 文件名: kebab-case
- 类名: PascalCase
- 函数/方法: camelCase
- 接口: IPascalCase

**检测到的冲突或差异**:
- 无冲突,遵循现有Story 1.1和1.2的模式

---

## References

### 来源文档引用

- **Epic定义**: [Source: _bmad-output/epics.md#Epic 1, Story 1.3]
- **WeaknessSnapshot实体**: [Source: backend/src/database/entities/weakness-snapshot.entity.ts]
- **TasksGateway模式**: [Source: backend/src/modules/ai-tasks/gateways/tasks.gateway.ts]
- **Story 1.1完成报告**: [Source: _bmad-output/sprint-artifacts/1-1-system-automatically-creates-organization-and-associates-projects.md]
- **Story 1.2完成报告**: [Source: backend/STORY_1.2_COMPLETION_REPORT.md]

### 技术栈参考

- **NestJS Event Pattern**: https://docs.nestjs.com/techniques/events
- **TypeORM QueryBuilder**: https://typeorm.io/#/select-query-builder
- **BullMQ Pattern**: 现有项目中已使用 (参考Story 1.1)

---

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References
(待开发时填写)

### Completion Notes List
(待开发时填写)

### File List
**预计创建文件** (6个):
1. `backend/src/modules/organizations/weakness-snapshot.service.ts` - 薄弱项识别和聚合服务
2. `backend/src/modules/organizations/weakness-snapshot.service.spec.ts` - 单元测试
3. `backend/src/modules/radar/assessment-event.listener.ts` - 评估完成事件监听器
4. `backend/src/modules/radar/assessment-event.listener.spec.ts` - 单元测试
5. `backend/test/weakness-detection.e2e-spec.ts` - E2E测试

**预计修改文件** (4个):
1. `backend/src/modules/ai-tasks/processors/ai-task.processor.ts` - 添加评估完成事件发送
2. `backend/src/modules/ai-tasks/processors/ai-task.processor.spec.ts` - 添加事件发送测试
3. `backend/src/modules/organizations/organizations.controller.ts` - 添加聚合API端点
4. `backend/src/app.module.ts` - 注册事件监听器

---

**下一步**: 使用`dev-story`工作流开始TDD开发
