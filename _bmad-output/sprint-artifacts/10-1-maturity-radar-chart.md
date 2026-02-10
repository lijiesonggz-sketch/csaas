---
epic: epic-10
story: 10-1-maturity-radar-chart
status: done
---

# Story 10.1: 成熟度雷达图组件

## 用户故事

**As a** 项目经理,
**I want** 在差距分析页面看到成熟度雷达图,
**So that** 直观了解各维度的成熟度分布。

## 验收标准

### AC1: 雷达图组件
**Given** 差距分析数据已加载
**When** 查看成熟度分析结果
**Then** 显示雷达图，展示各维度成熟度等级（0-5 分）
**And** 雷达图包含 6 个维度：战略与治理、技术架构、流程与管理、人员能力、安全与合规、创新与文化

### AC2: 数据绑定
**Given** 成熟度分析结果数据
**When** 雷达图渲染
**Then** 正确显示每个维度的当前分值和满分（5分）
**And** 数据变化时雷达图自动更新

### AC3: 视觉样式
**Given** 雷达图已渲染
**When** 查看图表
**Then** 使用渐变色填充区域 (使用 Ant Design 主题色：#1890ff 到 #52c41a 的渐变)
**And** 显示维度标签 (使用 14px 字体，颜色 #333)
**And** 响应式适配不同屏幕尺寸
**And** 图表区域有适当的边距 (margin: 24px)

### AC4: 页面集成
**Given** 访问差距分析页面
**When** 页面加载完成
**Then** 在成熟度分析区域显示雷达图
**And** 在改进行动计划页面显示当前 vs 目标雷达图对比

## 技术规范

### 使用库

- **recharts** - 已安装，使用 RadarChart 组件
  - 需要导入的组件：`RadarChart`, `Radar`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `ResponsiveContainer`, `Legend`
  - 参考文档：https://recharts.org/en-US/api/RadarChart

### Recharts 配置示例

```typescript
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend
} from 'recharts';

// 基础配置
<ResponsiveContainer width="100%" height={400}>
  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="name" />
    <PolarRadiusAxis angle={30} domain={[0, 5]} />
    <Radar
      name="当前成熟度"
      dataKey="value"
      stroke="#8884d8"
      fill="#8884d8"
      fillOpacity={0.6}
    />
    <Legend />
  </RadarChart>
</ResponsiveContainer>
```

### 新建文件

1. **frontend/components/features/MaturityRadarChart.tsx**
   - Props 接口：`data: { name: string; value: number; fullMark: number }[]`
   - 使用 Recharts RadarChart
   - 支持自定义颜色和尺寸
   - **响应式实现**：使用 ResponsiveContainer 自动适应容器宽度
   - **尺寸配置**：
     - 桌面端 (≥1024px): height=400px, outerRadius="80%"
     - 平板端 (768px-1023px): height=350px, outerRadius="70%"
     - 移动端 (<768px): height=300px, outerRadius="60%"

### 修改文件

1. **frontend/app/projects/[projectId]/gap-analysis/page.tsx**
   - 导入 MaturityRadarChart 组件
   - 在成熟度分析结果区域添加雷达图展示

2. **frontend/app/projects/[projectId]/action-plan/page.tsx**
   - 添加当前 vs 目标雷达图对比视图

### 数据结构

```typescript
interface MaturityRadarData {
  name: string;      // 维度名称
  value: number;     // 当前分值 (0-5)
  fullMark: number;  // 满分 5
}

// 6个雷达图维度定义
const RADAR_DIMENSIONS = [
  '战略与治理',
  '技术架构',
  '流程与管理',
  '人员能力',
  '安全与合规',
  '创新与文化'
] as const;

// 从 MaturityAnalysisResult 转换
// 注意：dimensionMaturity 中的 dimension 是聚类分组，需要映射到6个雷达维度
const mapToRadarData = (
  dimensionMaturity: Array<{
    dimension: string;  // 如 "技术架构", "流程规范"
    clusterCount: number;
    maturityLevel: number;
    grade: string;
  }>
): MaturityRadarData[] => {
  // 按维度名称分组计算平均成熟度
  const dimensionMap = new Map<string, number[]>();

  dimensionMaturity.forEach(d => {
    const values = dimensionMap.get(d.dimension) || [];
    values.push(d.maturityLevel);
    dimensionMap.set(d.dimension, values);
  });

  // 生成雷达图数据
  return RADAR_DIMENSIONS.map(name => {
    const values = dimensionMap.get(name) || [3]; // 默认3分
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      name,
      value: Number(avgValue.toFixed(2)),
      fullMark: 5
    };
  });
};
```

## 测试要求

### 单元测试 (frontend/components/features/__tests__/MaturityRadarChart.test.tsx)
- 验证雷达图组件正确渲染，包含 6 个维度
- 验证数据绑定正确，数值显示精度为 2 位小数
- 验证空数据状态显示占位符
- 验证自定义颜色属性生效

### 集成测试 (Gap Analysis 页面)
- 验证 gap-analysis 页面正确导入并显示雷达图
- 验证数据从 API 响应到图表的完整流程
- 验证数据更新时图表自动刷新

### 视觉测试
- 确认响应式布局在 320px、768px、1024px、1920px 宽度下正常显示
- 确认渐变色填充区域视觉效果符合设计规范
- 确认维度标签清晰可读，无重叠

### E2E 测试 (可选)
- 验证用户上传问卷后雷达图正确显示分析结果
- 验证雷达图与改进行动计划页面的数据一致性

## 文件清单

### 新建文件
- `frontend/components/features/MaturityRadarChart.tsx` - 成熟度雷达图组件
- `frontend/components/features/__tests__/MaturityRadarChart.test.tsx` - 单元测试

### 修改文件
- `frontend/app/projects/[projectId]/gap-analysis/page.tsx` - 集成雷达图到差距分析页面
- `frontend/app/projects/[projectId]/action-plan/page.tsx` - 集成雷达图对比到行动计划页面
- `frontend/jest.setup.js` - 添加 ResizeObserver mock

## 开发记录

### 实现说明
1. **MaturityRadarChart 组件**：使用 recharts 的 RadarChart 实现了响应式雷达图，支持：
   - 6个维度数据展示（战略与治理、技术架构、流程与管理、人员能力、安全与合规、创新与文化）
   - 当前 vs 目标成熟度对比模式
   - 空数据状态显示 Ant Design Empty 占位符
   - 自定义高度、颜色等属性
   - 响应式布局（使用 ResponsiveContainer）

2. **数据映射工具**：`mapToRadarData` 函数将后端返回的 dimensionMaturity 数据转换为雷达图所需格式

3. **页面集成**：
   - gap-analysis 页面：在总体成熟度卡片后添加雷达图展示
   - action-plan 页面：在改进措施结果上方添加当前 vs 目标雷达图对比

### 代码审查修复 (Review Fixes)
1. **渐变色填充** - 使用 SVG `<linearGradient>` 实现从 `#1890ff` 到 `#52c41a` 的渐变填充
2. **响应式布局** - 实现窗口大小监听，根据断点自动调整高度和半径：
   - 桌面端 (≥1024px): height=400px, outerRadius="80%"
   - 平板端 (768px-1023px): height=350px, outerRadius="70%"
   - 移动端 (<768px): height=300px, outerRadius="60%"
3. **除零保护** - 在 `mapToRadarData` 中添加 `values.length > 0` 检查
4. **测试增强** - 添加数据变化自动更新测试和四舍五入精度测试

### 测试结果
- 单元测试：50个测试全部通过（新增3个测试）
- 整体测试：411个测试通过（60个失败为预存在问题，与本故事无关）
- TypeScript 类型检查：新文件无错误
- 构建状态：编译成功

### 验收标准检查
- [x] AC1: 雷达图组件 - 包含6个维度，使用 recharts 实现
- [x] AC2: 数据绑定 - 正确显示每个维度的分值，精度为2位小数，数据变化自动更新
- [x] AC3: 视觉样式 - 使用渐变色填充（#1890ff 到 #52c41a），响应式适配，边距 24px
- [x] AC4: 页面集成 - gap-analysis 和 action-plan 页面均已集成
