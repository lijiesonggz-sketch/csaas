# 问卷断点续跑功能 - 实现总结

## 功能概述

实现了问卷生成的断点续跑功能，允许用户在生成中断后继续生成剩余聚类，或重新生成特定聚类的问题。

## 实现方式：TDD（测试驱动开发）

按照TDD原则，先编写测试用例，再实现功能。

## 已完成功能

### 1. 数据库Schema ✅

**文件**: `backend/src/database/entities/ai-task.entity.ts`

新增字段：
```typescript
clusterGenerationStatus: {
  totalClusters: number
  completedClusters: string[]
  failedClusters: string[]
  pendingClusters: string[]
  clusterProgress: Record<string, {
    clusterId: string
    clusterName: string
    status: 'pending' | 'generating' | 'completed' | 'failed'
    questionsGenerated: number
    questionsExpected: number
    startedAt?: string
    completedAt?: string
    error?: string
  }>
}
```

**迁移文件**: `backend/src/database/migrations/1767797000000-AddClusterGenerationStatusColumn.ts`

### 2. 后端实现 ✅

#### 2.1 Service方法

**文件**: `backend/src/modules/ai-tasks/ai-tasks.service.ts`

新增方法：
- `getClusterGenerationStatus(taskId)` - 获取聚类生成状态
- `resumeQuestionnaireGeneration(taskId)` - 继续生成剩余聚类
- `regenerateCluster(taskId, clusterId)` - 重新生成单个聚类

#### 2.2 Controller端点

**文件**: `backend/src/modules/ai-tasks/ai-tasks.controller.ts`

新增API端点：
- `GET /ai-tasks/:id/cluster-status` - 获取聚类状态
- `POST /ai-tasks/:id/resume` - 继续生成
- `POST /ai-tasks/:id/regenerate-cluster` - 重新生成聚类

#### 2.3 Processor改进

**文件**: `backend/src/modules/ai-tasks/processors/ai-task.processor.ts`

改进内容：
- 初始化聚类生成状态
- 每个聚类生成时更新状态
- 保存最终状态到数据库

**文件**: `backend/src/modules/ai-generation/generators/questionnaire.generator.ts`

改进内容：
- 添加`progressCallback`参数
- 传递`currentClusterId`用于状态跟踪
- 在每个聚类生成时发送进度更新

### 3. 前端实现 ✅

#### 3.1 API客户端

**文件**: `frontend/lib/api/ai-tasks.ts`

新增方法：
- `getClusterGenerationStatus(taskId)`
- `resumeQuestionnaireGeneration(taskId)`
- `regenerateCluster(taskId, clusterId)`

#### 3.2 进度显示组件

**文件**: `frontend/components/features/QuestionnaireProgressDisplay.tsx`

功能：
- 显示总进度百分比和进度条
- 显示聚类统计（已完成/待生成/失败）
- 列出所有聚类及其状态
- 提供"继续生成"按钮
- 为每个聚类提供"重新生成"按钮
- 响应式布局（移动端/桌面端）

#### 3.3 页面集成

**文件**: `frontend/app/projects/[projectId]/questionnaire/page.tsx`

改进：
- 检测部分完成状态
- 显示进度组件
- 支持查看部分结果
- 自动加载聚类状态

### 4. 测试用例 ✅

#### 4.1 后端测试

**文件**: `backend/test/questionnaire-resume.spec.ts`

测试覆盖：
- 继续生成功能
- 单聚类重新生成
- 状态管理
- 集成场景

#### 4.2 前端测试

**文件**: `frontend/components/features/__tests__/QuestionnaireProgressDisplay.test.tsx`

测试覆盖：
- 进度显示
- 聚类状态列表
- 按钮功能
- UI/UX细节

## 功能特点

### 断点续跑
- ✅ 检测部分完成的任务
- ✅ 显示完成进度（已完成X/Y聚类）
- ✅ 一键继续生成剩余聚类
- ✅ 跳过已完成的聚类
- ✅ 重试失败的聚类

### 单聚类重新生成
- ✅ 为每个聚类提供独立的重新生成按钮
- ✅ 替换已存在的问题（保持5题）
- ✅ 不影响其他聚类

### 用户体验
- ✅ 清晰的进度可视化
- ✅ 实时WebSocket进度更新
- ✅ 详细的错误信息显示
- ✅ 预估剩余时间
- ✅ 响应式设计（支持移动端）

## API使用示例

### 获取聚类状态
```typescript
const status = await AITasksAPI.getClusterGenerationStatus(taskId)
// 返回: { totalClusters, completedClusters, failedClusters, pendingClusters, clusterProgress }
```

### 继续生成
```typescript
const result = await AITasksAPI.resumeQuestionnaireGeneration(taskId)
// 返回: { newTaskId, clustersToGenerate, message }
```

### 重新生成单个聚类
```typescript
const result = await AITasksAPI.regenerateCluster(taskId, clusterId)
// 返回: { newTaskId, clusterName, message }
```

## 数据流程

```
1. 用户创建问卷任务
   ↓
2. Processor初始化聚类状态
   ↓
3. 逐个生成聚类，更新状态
   ↓
4. 如果中断（失败/超时）：
   - 已完成的聚类保存到completedClusters
   - 失败的聚类保存到failedClusters
   - 待生成的聚类保存到pendingClusters
   ↓
5. 页面显示部分完成状态
   ↓
6. 用户点击"继续生成"或"重新生成"
   ↓
7. 创建新任务，从断点继续
   ↓
8. 完成所有聚类
```

## 注意事项

1. **任务优先级**：
   - 继续生成任务优先级 +1
   - 重新生成任务优先级 +2

2. **状态同步**：
   - 每个聚类生成完成后立即更新状态
   - 支持实时WebSocket推送

3. **数据一致性**：
   - 重新生成会替换该聚类的5道题
   - 保持questionId的唯一性

4. **错误处理**：
   - 失败聚类会标记错误信息
   - 支持重试失败的聚类

## 下一步优化建议

1. **批量操作**：
   - 支持选择多个聚类批量重新生成
   - 支持跳过特定聚类

2. **智能重试**：
   - 自动重试失败的聚类
   - 根据错误类型调整重试策略

3. **性能优化**：
   - 并发生成多个聚类
   - 缓存聚类状态

4. **增强可视化**：
   - 显示每个聚类的生成时间
   - 添加生成趋势图

## 测试

运行测试：
```bash
# 后端测试
cd backend
npm test questionnaire-resume

# 前端测试
cd frontend
npm test QuestionnaireProgressDisplay
```

## 验收标准

✅ 部分完成的任务显示进度
✅ 可以继续生成剩余聚类
✅ 可以重新生成单个聚类
✅ 进度实时更新
✅ 错误信息清晰显示
✅ 所有测试通过

---

**TDD原则**: 先写测试，再写代码，最后重构。所有功能都经过了测试验证。
