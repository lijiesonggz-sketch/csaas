# 添加新功能导航入口

## 需要更新的文件

### 1. `frontend/app/projects/[projectId]/page.tsx`

#### 更新1: 添加新步骤到 steps 数组

在 `steps` 数组中添加两个新对象（在 clustering 步骤之后，gap-analysis 步骤之后）：

```typescript
// 在 clustering 步骤之后添加（约第163行后）：
{
  id: 'standard-interpretation',
  name: '标准解读',
  icon: <MenuBook />,
  route: `/projects/${projectId}/standard-interpretation`,
  status: (taskStatuses['standard-interpretation'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
  description: '深度解读标准内容、搜索关联标准、版本比对',
},

// 在 gap-analysis 步骤之后添加（约第187行后）：
{
  id: 'quick-gap-analysis',
  name: '超简版差距分析',
  icon: <Speed />,
  route: `/projects/${projectId}/quick-gap-analysis`,
  status: (taskStatuses['quick-gap-analysis'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
  description: '快速输入现状描述，AI分析差距并生成改进措施',
},
```

#### 更新2: 更新任务类型映射

在 `computeTaskStatuses` 函数中的 `stepToTaskType` 对象中添加新映射（约第95行）：

```typescript
const stepToTaskType: Record<string, string[]> = {
  summary: ['summary'],
  clustering: ['clustering'],
  matrix: ['matrix'],
  questionnaire: ['questionnaire', 'binary_questionnaire'],  // 添加 binary_questionnaire
  'gap-analysis': ['questionnaire'],
  'action-plan': ['action_plan'],
  'standard-interpretation': ['standard_interpretation', 'standard_related_search', 'standard_version_compare'],
  'quick-gap-analysis': ['quick_gap_analysis'],
}
```

#### 更新3: 修改网格列数（可选）

将 `lg: 'repeat(4, 1fr)'` 改为 `lg: 'repeat(3, 1fr)'`，因为现在有9个步骤（原来是7个），3列会更平衡。

### 2. `frontend/components/projects/StepsTabNavigator.tsx` ⚠️ 已更新

这个文件已经成功更新！添加了：
- 图标导入：`MenuBook` 和 `Speed`
- `DEFAULT_STEPS` 数组中的两个新步骤

## 导航顺序说明

最终导航顺序（从左到右）：

1. 上传文档 (upload)
2. 综述生成 (summary)
3. 聚类分析 (clustering)
4. **标准解读 (standard-interpretation)** ⬅️ 新增
5. 成熟度矩阵 (matrix)
6. 问卷生成 (questionnaire)
7. 差距分析 (gap-analysis)
8. **超简版差距分析 (quick-gap-analysis)** ⬅️ 新增
9. 改进措施 (action-plan)

## 为什么这样设计？

1. **标准解读放在聚类分析之后**：因为聚类分析可以提供更精准的主题分类，使标准解读更有效
2. **超简版差距分析放在传统差距分析之后**：作为替代方案提供给用户，可以快速分析差距
3. **判断题问卷不需要单独入口**：它是问卷生成的一个模式，可以在问卷页面中选择
4. **判断题差距分析不需要单独入口**：它是差距分析的一个模式，可以在差距分析页面中切换

## 测试步骤

1. 访问项目工作台首页（`/projects/[projectId]`）
2. 检查是否能看到9个卡片（原来7个 + 2个新增）
3. 点击"标准解读"卡片，验证跳转到 `/projects/[projectId]/standard-interpretation`
4. 点击"超简版差距分析"卡片，验证跳转到 `/projects/[projectId]/quick-gap-analysis`
5. 在子页面顶部检查Tab导航，应该有9个标签（包括两个新增的）

## 当前状态

✅ `StepsTabNavigator.tsx` - 已更新（顶部Tab导航）
⏳ `[projectId]/page.tsx` - 需要手动更新（首页卡片导航）

请根据上述说明手动更新 `[projectId]/page.tsx` 文件。
