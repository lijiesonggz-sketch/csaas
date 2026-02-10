---
epic: epic-11
story: 11-4-features-migration
status: done
---

# Story 11.4: Features 组件迁移（剩余 Ant Design 组件）

## 用户故事

**As a** 前端开发者,
**I want** 将 Features 目录下剩余使用 Ant Design 的组件迁移到 MUI，并统一图标库为 MUI Icons,
**So that** 统一 UI 框架，为 Story 11-6 清理 Ant Design 依赖做准备。

## 背景与上下文

Story 11-3 已完成以下 7 个组件的 MUI 迁移：
- DocumentUploader.tsx
- TaskProgressBar.tsx
- SummaryResultDisplay.tsx
- ClusteringResultDisplay.tsx
- MatrixResultDisplay.tsx
- QuestionnaireResultDisplay.tsx
- ActionPlanResultDisplay.tsx

本 Story 处理 `frontend/components/features/` 目录下**剩余**仍使用 Ant Design 的组件，以及使用 lucide-react 图标的组件（需统一为 MUI Icons）。

## 前置依赖

- [x] Story 11-1 (MUI 主题配置) - 已完成
- [x] Story 11-2 (布局组件迁移) - 已完成
- [x] Story 11-3 (AI Generation 页面迁移) - 已完成

## 验收标准

### AC1: MaturityRadarChart 组件迁移
**Given** 查看 `MaturityRadarChart.tsx` 组件
**When** 检查实现代码
**Then** 所有 Ant Design 导入（`Card`, `Empty` from `antd`; `RadarChartOutlined` from `@ant-design/icons`）已替换为 MUI 对应组件
**And** recharts 图表功能保持不变
**And** 组件渲染正常，无控制台错误

### AC2: MissingClausesHandler 组件迁移
**Given** 查看 `MissingClausesHandler.tsx` 组件
**When** 检查实现代码
**Then** 所有 Ant Design 导入（`Card`, `Select`, `Button`, `Modal`, `Form`, `Input`, `Space`, `Alert`, `Tag`, `Divider`; `PlusOutlined`, `CheckCircleOutlined`, `ExclamationCircleOutlined`）已替换为 MUI 对应组件
**And** 缺失条款分配功能正常
**And** 模态框交互正常

### AC3: GapAnalysisReport 组件迁移
**Given** 查看 `GapAnalysisReport.tsx` 组件
**When** 检查实现代码
**Then** 所有 Ant Design 导入（`Card`, `Tag`, `Statistic`, `Row`, `Col`, `Descriptions`, `Divider`, `Progress`, `Table`; 8个 `@ant-design/icons`）已替换为 MUI 对应组件
**And** 报告展示和打印/PDF导出功能正常

### AC4: BinaryGapAnalysisResultDisplay 组件迁移
**Given** 查看 `BinaryGapAnalysisResultDisplay.tsx` 组件
**When** 检查实现代码
**Then** 所有 Ant Design 导入（`Card`, `Collapse`, `Tag`, `Button`, `Progress`, `Row`, `Col`, `Statistic`, `Alert`, `List`, `Space`, `Divider`, `Descriptions`, `message`; 多个 `@ant-design/icons`）已替换为 MUI 对应组件
**And** 判断题差距分析结果展示正常

### AC5: Simple*Display 系列组件图标统一
**Given** 查看以下 5 个 Simple*Display 组件：
- `SimpleSummaryDisplay.tsx`
- `SimpleClusteringDisplay.tsx`
- `SimpleMatrixDisplay.tsx`
- `SimpleQuestionnaireDisplay.tsx`
- `SimpleActionPlanDisplay.tsx`
**When** 检查实现代码
**Then** 所有 `lucide-react` 图标导入已替换为 `@mui/icons-material` 对应图标
**And** Tailwind CSS 样式保持不变（不需要迁移为 MUI sx）
**And** 组件渲染和数据展示正常

### AC6: QuestionnaireProgressDisplay 组件图标统一
**Given** 查看 `QuestionnaireProgressDisplay.tsx` 组件
**When** 检查实现代码
**Then** 所有 `lucide-react` 图标导入已替换为 `@mui/icons-material` 对应图标
**And** 进度显示功能正常

### AC7: 零 Ant Design / lucide-react 残留
**Given** 在 `frontend/components/features/` 目录下执行搜索
**When** 搜索 `from 'antd'`、`from '@ant-design/icons'`、`from 'lucide-react'`
**Then** 搜索结果为零（仅 `__tests__/` 目录中的 mock 除外）

## 技术规范

### 第一类：Ant Design 完整迁移（4 个组件）

#### 1. `frontend/components/features/MaturityRadarChart.tsx`
**当前依赖：** `antd` (Card, Empty), `@ant-design/icons` (RadarChartOutlined)
**迁移映射：**
| Ant Design | MUI |
|------------|-----|
| Card | Card + CardContent + CardHeader |
| Empty | 自定义空状态（Box + Typography） |
| RadarChartOutlined | RadarIcon 或 InsightsIcon from @mui/icons-material |

**注意：** recharts 库保持不变，仅替换外层容器和空状态组件。

#### 2. `frontend/components/features/MissingClausesHandler.tsx`
**当前依赖：** `antd` (Card, Select, Button, Modal, Form, Input, Space, Alert, Tag, Divider), `@ant-design/icons` (PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined)
**迁移映射：**
| Ant Design | MUI |
|------------|-----|
| Card | Card + CardContent |
| Select | Select 或 Autocomplete |
| Button | Button |
| Modal | Dialog + DialogTitle + DialogContent + DialogActions |
| Form | 原生 form + TextField |
| Input | TextField |
| Space | Stack |
| Alert | Alert |
| Tag | Chip |
| Divider | Divider |
| PlusOutlined | AddIcon |
| CheckCircleOutlined | CheckCircleIcon |
| ExclamationCircleOutlined | WarningIcon |

#### 3. `frontend/components/features/GapAnalysisReport.tsx`
**当前依赖：** `antd` (Card, Tag, Statistic, Row, Col, Descriptions, Divider, Progress, Table), `@ant-design/icons` (FileTextOutlined, BarChartOutlined, FallOutlined, RiseOutlined, TrophyOutlined, BulbOutlined, CalendarOutlined, CheckCircleOutlined)
**迁移映射：**
| Ant Design | MUI |
|------------|-----|
| Card | Card + CardContent + CardHeader |
| Tag | Chip |
| Statistic | 自定义统计卡片（Box + Typography） |
| Row/Col | Grid |
| Descriptions | Table 或自定义描述列表 |
| Divider | Divider |
| Progress | LinearProgress |
| Table | Table + TableHead + TableBody + TableRow + TableCell |
| FileTextOutlined | DescriptionIcon |
| BarChartOutlined | BarChartIcon |
| FallOutlined | TrendingDownIcon |
| RiseOutlined | TrendingUpIcon |
| TrophyOutlined | EmojiEventsIcon |
| BulbOutlined | LightbulbIcon |
| CalendarOutlined | CalendarTodayIcon |
| CheckCircleOutlined | CheckCircleIcon |

#### 4. `frontend/components/features/BinaryGapAnalysisResultDisplay.tsx`
**当前依赖：** `antd` (Card, Collapse, Tag, Button, Progress, Row, Col, Statistic, Alert, List, Space, Divider, Descriptions, message), `@ant-design/icons` (多个)
**迁移映射：**
| Ant Design | MUI |
|------------|-----|
| Card | Card + CardContent + CardHeader |
| Collapse | Accordion + AccordionSummary + AccordionDetails |
| Tag | Chip |
| Button | Button |
| Progress | LinearProgress |
| Row/Col | Grid |
| Statistic | 自定义统计卡片 |
| Alert | Alert |
| List | List + ListItem + ListItemText |
| Space | Stack |
| Divider | Divider |
| Descriptions | 自定义描述列表 |
| message | sonner toast |

### 第二类：lucide-react 图标替换（6 个组件）

这些组件使用 Tailwind CSS + lucide-react 图标，不涉及 Ant Design。仅需替换图标库。

#### 5. `frontend/components/features/SimpleSummaryDisplay.tsx`
**当前图标：** FileText, CheckCircle2, AlertCircle, TrendingUp from lucide-react
**替换为：** DescriptionIcon, CheckCircleIcon, ErrorIcon, TrendingUpIcon from @mui/icons-material
**注意：** Tailwind CSS className 样式保持不变，仅调整图标组件的 className → sx 属性（如 `className="w-5 h-5"` → `sx={{ width: 20, height: 20 }}`）

#### 6. `frontend/components/features/SimpleClusteringDisplay.tsx`
**当前图标：** CheckCircle2, AlertTriangle, FileText, TrendingUp from lucide-react
**替换为：** CheckCircleIcon, WarningIcon, DescriptionIcon, TrendingUpIcon from @mui/icons-material

#### 7. `frontend/components/features/SimpleMatrixDisplay.tsx`
**当前图标：** Grid3x3, TrendingUp, CheckCircle2 from lucide-react
**替换为：** GridOnIcon, TrendingUpIcon, CheckCircleIcon from @mui/icons-material

#### 8. `frontend/components/features/SimpleQuestionnaireDisplay.tsx`
**当前图标：** ClipboardList, CheckCircle2, XCircle, AlertTriangle from lucide-react
**替换为：** AssignmentIcon, CheckCircleIcon, CancelIcon, WarningIcon from @mui/icons-material

#### 9. `frontend/components/features/SimpleActionPlanDisplay.tsx`
**当前图标：** ListTodo, TrendingUp, Clock, Users, Target from lucide-react
**替换为：** FormatListBulletedIcon, TrendingUpIcon, AccessTimeIcon, GroupIcon, TrackChangesIcon from @mui/icons-material

#### 10. `frontend/components/features/QuestionnaireProgressDisplay.tsx`
**当前图标：** CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle from lucide-react
**替换为：** CheckCircleIcon, CancelIcon, AccessTimeIcon, RefreshIcon, ErrorIcon from @mui/icons-material

## 任务分解

### Task 1: MaturityRadarChart 组件迁移
- [ ] 1.1 替换 `antd` Card → MUI Card/CardContent/CardHeader
- [ ] 1.2 替换 `antd` Empty → 自定义空状态组件
- [ ] 1.3 替换 `@ant-design/icons` RadarChartOutlined → MUI InsightsIcon
- [ ] 1.4 验证 recharts 图表渲染正常
- [ ] 1.5 更新/创建单元测试

### Task 2: MissingClausesHandler 组件迁移
- [ ] 2.1 替换 Card, Button, Alert, Tag, Divider, Space → MUI 对应组件
- [ ] 2.2 替换 Modal → MUI Dialog 系列组件
- [ ] 2.3 替换 Form + Input → TextField
- [ ] 2.4 替换 Select → MUI Select 或 Autocomplete
- [ ] 2.5 替换 @ant-design/icons → MUI Icons
- [ ] 2.6 验证缺失条款分配和模态框交互功能
- [ ] 2.7 更新/创建单元测试

### Task 3: GapAnalysisReport 组件迁移
- [ ] 3.1 替换 Card, Tag, Divider → MUI 对应组件
- [ ] 3.2 替换 Statistic → 自定义统计卡片
- [ ] 3.3 替换 Row/Col → MUI Grid
- [ ] 3.4 替换 Descriptions → 自定义描述列表或 MUI Table
- [ ] 3.5 替换 Progress → MUI LinearProgress
- [ ] 3.6 替换 Table → MUI Table 系列组件
- [ ] 3.7 替换 @ant-design/icons (8个) → MUI Icons
- [ ] 3.8 验证报告展示和打印功能
- [ ] 3.9 更新/创建单元测试

### Task 4: BinaryGapAnalysisResultDisplay 组件迁移
- [ ] 4.1 替换 Card, Tag, Button, Alert, Divider, Space → MUI 对应组件
- [ ] 4.2 替换 Collapse → MUI Accordion 系列
- [ ] 4.3 替换 Progress → MUI LinearProgress
- [ ] 4.4 替换 Row/Col → MUI Grid
- [ ] 4.5 替换 Statistic → 自定义统计卡片
- [ ] 4.6 替换 List → MUI List 系列
- [ ] 4.7 替换 Descriptions → 自定义描述列表
- [ ] 4.8 替换 message → sonner toast
- [ ] 4.9 替换 @ant-design/icons → MUI Icons
- [ ] 4.10 验证差距分析结果展示正常
- [ ] 4.11 更新/创建单元测试

### Task 5: Simple*Display 系列图标替换（5 个组件）
- [ ] 5.1 SimpleSummaryDisplay.tsx: lucide-react → MUI Icons
- [ ] 5.2 SimpleClusteringDisplay.tsx: lucide-react → MUI Icons
- [ ] 5.3 SimpleMatrixDisplay.tsx: lucide-react → MUI Icons
- [ ] 5.4 SimpleQuestionnaireDisplay.tsx: lucide-react → MUI Icons
- [ ] 5.5 SimpleActionPlanDisplay.tsx: lucide-react → MUI Icons
- [ ] 5.6 调整图标尺寸属性（className → sx 或 fontSize）
- [ ] 5.7 验证所有 5 个组件渲染正常

### Task 6: QuestionnaireProgressDisplay 图标替换
- [ ] 6.1 替换 lucide-react 图标 → MUI Icons
- [ ] 6.2 调整图标尺寸属性
- [ ] 6.3 验证进度显示功能正常

### Task 7: 验证与清理
- [ ] 7.1 在 features 目录搜索确认零 antd/lucide-react 残留
- [ ] 7.2 运行 TypeScript 编译检查 (`npx tsc --noEmit`)
- [ ] 7.3 运行所有相关单元测试
- [ ] 7.4 运行相关 E2E 测试（如有）

## 修改文件清单

### 生产代码文件（10 个）

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `frontend/components/features/MaturityRadarChart.tsx` | 修改 | antd → MUI |
| `frontend/components/features/MissingClausesHandler.tsx` | 修改 | antd → MUI |
| `frontend/components/features/GapAnalysisReport.tsx` | 修改 | antd → MUI |
| `frontend/components/features/BinaryGapAnalysisResultDisplay.tsx` | 修改 | antd → MUI |
| `frontend/components/features/SimpleSummaryDisplay.tsx` | 修改 | lucide-react → MUI Icons |
| `frontend/components/features/SimpleClusteringDisplay.tsx` | 修改 | lucide-react → MUI Icons |
| `frontend/components/features/SimpleMatrixDisplay.tsx` | 修改 | lucide-react → MUI Icons |
| `frontend/components/features/SimpleQuestionnaireDisplay.tsx` | 修改 | lucide-react → MUI Icons |
| `frontend/components/features/SimpleActionPlanDisplay.tsx` | 修改 | lucide-react → MUI Icons |
| `frontend/components/features/QuestionnaireProgressDisplay.tsx` | 修改 | lucide-react → MUI Icons |

### 测试文件（预计 4-6 个）

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `frontend/components/features/__tests__/MaturityRadarChart.test.tsx` | 修改 | 更新测试以匹配 MUI 组件 |
| `frontend/components/features/__tests__/GapAnalysisReport.test.tsx` | 修改 | 更新测试以匹配 MUI 组件 |
| `frontend/components/features/__tests__/BinaryGapAnalysisResultDisplay.test.tsx` | 新建 | 单元测试 |
| `frontend/components/features/__tests__/MissingClausesHandler.test.tsx` | 新建 | 单元测试 |

## 测试要求

- 单元测试：验证所有 10 个组件渲染正常
- 单元测试：验证关键交互功能（MissingClausesHandler 的模态框、BinaryGapAnalysisResultDisplay 的折叠面板等）
- 编译验证：`npx tsc --noEmit` 通过
- 残留检查：features 目录下无 antd/lucide-react 导入

## 风险与注意事项

1. **GapAnalysisReport 组件较复杂**：包含打印/PDF导出功能，迁移时需确保打印样式不受影响
2. **BinaryGapAnalysisResultDisplay 组件较大**：包含大量 Ant Design 组件，迁移工作量较大
3. **MUI Icons 尺寸差异**：lucide-react 使用 `className="w-5 h-5"` 控制尺寸，MUI Icons 使用 `fontSize` 或 `sx` 属性，需注意视觉一致性
4. **Form 迁移**：Ant Design Form 有内置验证，迁移到 MUI 需要手动处理表单状态

## Dev Agent Record

### 文件变更列表
（开发完成后填写）

### 变更日志
（开发完成后填写）

### Code Review 记录

**审查日期：** 2026-02-10
**审查结果：** PASS（所有 HIGH/MEDIUM 问题已修复）
**测试结果：** 17 个测试套件，267 个测试全部通过

#### 发现的问题及修复

| # | 严重性 | 文件 | 行号 | 描述 | 状态 |
|---|--------|------|------|------|------|
| 1 | HIGH | TaskProgressBar.tsx | 28-34 | 回调函数在渲染期间直接调用，违反 React 规则，可能导致无限重渲染 | 已修复：移入 useEffect |
| 2 | HIGH | SimpleSummaryDisplay.tsx | 30 | JSON.parse 无 try-catch，无效数据会导致组件崩溃 | 已修复：添加 try-catch 和错误 UI |
| 3 | HIGH | MissingClausesHandler.tsx | 290 | fetch 请求缺少 Authorization header，API 调用无认证 | 已修复：添加 Bearer token |
| 4 | MEDIUM | MissingClausesHandler.tsx | 314,318 | 使用原生 alert() 而非 toast，与项目其他组件不一致 | 已修复：替换为 sonner toast |
| 5 | MEDIUM | BinaryGapAnalysisResultDisplay.tsx | 22-28 | 5 个未使用的导入（Accordion 系列、ExpandMoreIcon、ListItemText、ListItemIcon） | 已修复：移除未使用导入 |
| 6 | MEDIUM | QuestionnaireProgressDisplay.tsx | 3 | 未使用的导入（React、useEffect） | 已修复：移除未使用导入 |
| 7 | MEDIUM | SimpleSummaryDisplay.tsx | 10 | 未使用的导入（ErrorIcon） | 已修复：移除未使用导入 |
| 8 | MEDIUM | MaturityRadarChart.tsx | 110,120 | 注释仍引用 "Ant Design 主题色" | 已修复：更新注释 |
| 9 | LOW | SimpleActionPlanDisplay.tsx | 10,12 | 图标选择与 Story 规范略有差异（ScheduleIcon vs AccessTimeIcon, GpsFixedIcon vs TrackChangesIcon），功能等价 | 保留 |
| 10 | LOW | BinaryGapAnalysisResultDisplay.tsx | 112-114 | 硬编码 Ant Design 色值（#52c41a, #faad14, #f5222d），建议后续使用 MUI theme palette | 保留 |
