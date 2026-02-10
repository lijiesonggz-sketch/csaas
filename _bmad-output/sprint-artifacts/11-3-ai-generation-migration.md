---
epic: epic-11
story: 11-3-ai-generation-migration
status: done
---

# Story 11.3: AI Generation 页面迁移

## 用户故事

**As a** 前端开发者,
**I want** 将 AI Generation 页面从 Ant Design 迁移到 MUI,
**So that** 统一 UI 框架。

## 验收标准

### AC1: Summary 页面
**Given** 访问 /ai-generation/summary
**When** 页面加载
**Then** 所有组件使用 MUI
**And** 功能正常

### AC2: Clustering 页面
**Given** 访问 /ai-generation/clustering
**When** 页面加载
**Then** 所有组件使用 MUI
**And** 功能正常

### AC3: Matrix 页面
**Given** 访问 /ai-generation/matrix
**When** 页面加载
**Then** 所有组件使用 MUI
**And** 功能正常

### AC4: Questionnaire 页面
**Given** 访问 /ai-generation/questionnaire
**When** 页面加载
**Then** 所有组件使用 MUI
**And** 功能正常

### AC5: Action-Plan 页面
**Given** 访问 /ai-generation/action-plan
**When** 页面加载
**Then** 所有组件使用 MUI
**And** 功能正常

## 技术规范

### 修改文件

1. **frontend/app/ai-generation/summary/page.tsx**
- Ant Design Card → MUI Card
- Ant Design Button → MUI Button
- Ant Design Steps → MUI Stepper
- Ant Design message → sonner toast
- @ant-design/icons → MUI Icons

2. **frontend/app/ai-generation/clustering/page.tsx**
- Ant Design Card → MUI Card
- Ant Design Button → MUI Button
- Ant Design Steps → MUI Stepper
- Ant Design Upload → MUI 自定义上传或使用 react-dropzone
- Ant Design message → sonner toast
- @ant-design/icons → MUI Icons

3. **frontend/app/ai-generation/matrix/page.tsx**
- Ant Design Card → MUI Card
- Ant Design Button → MUI Button
- Ant Design Steps → MUI Stepper
- Ant Design message → sonner toast
- @ant-design/icons → MUI Icons

4. **frontend/app/ai-generation/questionnaire/page.tsx**
- Ant Design Card → MUI Card
- Ant Design Button → MUI Button
- Ant Design Steps → MUI Stepper
- Ant Design message → sonner toast
- @ant-design/icons → MUI Icons

5. **frontend/app/ai-generation/action-plan/page.tsx**
- Ant Design Card → MUI Card
- Ant Design Button → MUI Button
- Ant Design Steps → MUI Stepper
- Ant Design Spin → MUI CircularProgress
- Ant Design Progress → MUI LinearProgress
- Ant Design Tag → MUI Chip
- Ant Design Collapse → MUI Accordion
- Ant Design Space → MUI Stack
- Ant Design Divider → MUI Divider
- Ant Design Alert → MUI Alert
- Ant Design Timeline → MUI Timeline (或自定义)
- Ant Design Descriptions → MUI 自定义描述列表
- Ant Design Empty → MUI 自定义空状态
- Ant Design Statistic → MUI 自定义统计卡片
- Ant Design Row/Col → MUI Grid
- Ant Design message → sonner toast
- @ant-design/icons → MUI Icons

### 组件映射

| Ant Design | MUI |
|------------|-----|
| Button | Button |
| Card | Card |
| Steps | Stepper |
| Spin | CircularProgress |
| Progress | LinearProgress |
| Tag | Chip |
| Collapse | Accordion |
| Space | Stack |
| Divider | Divider |
| Alert | Alert |
| Timeline | Timeline (lab) 或自定义 |
| Descriptions | 自定义描述列表 |
| Empty | 自定义空状态 |
| Statistic | 自定义统计卡片 |
| Row/Col | Grid |
| Upload | 自定义上传组件 |
| message | sonner toast |

### 图标映射

| Ant Design Icons | MUI Icons |
|------------------|-----------|
| FileTextOutlined | Description |
| ThunderboltOutlined | FlashOn |
| CheckOutlined | CheckCircle |
| UploadOutlined | CloudUpload |
| DeleteOutlined | Delete |
| TableOutlined | TableChart |
| FormOutlined | Assignment |
| RocketOutlined | RocketLaunch |
| CheckCircleOutlined | CheckCircle |
| ClockCircleOutlined | Schedule |
| DownloadOutlined | Download |
| ArrowLeftOutlined | ArrowBack |
| BulbOutlined | Lightbulb |
| SafetyOutlined | Security |
| TeamOutlined | Groups |
| DollarOutlined | AttachMoney |
| LineChartOutlined | TrendingUp |

## 依赖组件

以下子组件也需要检查是否需要迁移：
- `frontend/components/features/DocumentUploader.tsx`
- `frontend/components/features/TaskProgressBar.tsx`
- `frontend/components/features/SummaryResultDisplay.tsx`
- `frontend/components/features/ClusteringResultDisplay.tsx`
- `frontend/components/features/MatrixResultDisplay.tsx`
- `frontend/components/features/QuestionnaireResultDisplay.tsx`
- `frontend/components/features/ActionPlanResultDisplay.tsx`

## 前置依赖

- Story 11.1 (MUI 主题配置) 必须已完成
- Story 11.2 (布局组件迁移) 必须已完成
- MUI 主题和布局组件必须已正确配置

## 测试要求

- 单元测试：验证各页面渲染
- E2E 测试：验证功能流程
- 测试所有 5 个页面的导航和交互

## Dev Agent Record

### 文件变更列表

**页面文件 (5个):**
- `frontend/app/ai-generation/summary/page.tsx` - Summary 页面 MUI 迁移
- `frontend/app/ai-generation/clustering/page.tsx` - Clustering 页面 MUI 迁移
- `frontend/app/ai-generation/matrix/page.tsx` - Matrix 页面 MUI 迁移
- `frontend/app/ai-generation/questionnaire/page.tsx` - Questionnaire 页面 MUI 迁移
- `frontend/app/ai-generation/action-plan/page.tsx` - Action Plan 页面 MUI 迁移

**组件文件 (7个):**
- `frontend/components/features/DocumentUploader.tsx` - 文档上传组件 MUI 迁移
- `frontend/components/features/TaskProgressBar.tsx` - 任务进度条组件 MUI 迁移
- `frontend/components/features/SummaryResultDisplay.tsx` - 综述结果展示组件 MUI 迁移
- `frontend/components/features/ClusteringResultDisplay.tsx` - 聚类结果展示组件 MUI 迁移
- `frontend/components/features/MatrixResultDisplay.tsx` - 矩阵结果展示组件 MUI 迁移
- `frontend/components/features/QuestionnaireResultDisplay.tsx` - 问卷结果展示组件 MUI 迁移
- `frontend/components/features/ActionPlanResultDisplay.tsx` - 改进措施结果展示组件 MUI 迁移

**测试文件 (7个):**
- `frontend/e2e/ai-generation-migration.spec.ts` - E2E 测试 (320行, 18个测试用例)
- `frontend/components/features/__tests__/SummaryResultDisplay.test.tsx` - 单元测试 (12个测试)
- `frontend/components/features/__tests__/ClusteringResultDisplay.test.tsx` - 单元测试 (7个测试)
- `frontend/components/features/__tests__/MatrixResultDisplay.test.tsx` - 单元测试
- `frontend/components/features/__tests__/QuestionnaireResultDisplay.test.tsx` - 单元测试
- `frontend/components/features/__tests__/ActionPlanResultDisplay.test.tsx` - 单元测试
- `frontend/components/features/__tests__/DocumentUploader.test.tsx` - 单元测试
- `frontend/components/features/__tests__/TaskProgressBar.test.tsx` - 单元测试

### 变更日志

**2026-02-10:**
- 完成所有 5 个 AI Generation 页面的 MUI 迁移
- 完成所有 7 个子组件的 MUI 迁移
- 创建 E2E 测试文件 (ai-generation-migration.spec.ts)
- 创建 7 个单元测试文件
- 所有 58 个单元测试通过
- 构建编译通过

### Code Review 记录

**审查日期:** 2026-02-10
**审查结果:** 通过 (2个HIGH问题已修复)
**修复内容:**
1. ✅ 修复 matrix/page.tsx 缺失 CloudUploadIcon 导入
2. ✅ 修复 questionnaire/page.tsx 缺失 CloudUploadIcon 导入

**测试统计:**
- 单元测试: 58 个通过
- E2E 测试: 18 个测试用例已创建
- 构建状态: ✅ 编译通过
