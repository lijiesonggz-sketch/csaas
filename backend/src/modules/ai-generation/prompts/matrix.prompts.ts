/**
 * 成熟度矩阵生成 Prompt 模板
 *
 * 目标：基于聚类结果生成5级成熟度矩阵
 * 输入：聚类分析结果（categories + clusters）
 * 输出：5级成熟度 × N个聚类的完整矩阵
 */

const MATRIX_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于成熟度模型设计。请基于以下聚类结果生成成熟度矩阵。

**输入聚类结果**：
{{CLUSTERING_RESULT}}

**重要提示**：请严格按照JSON格式输出，不要添加任何注释或markdown标记。确保JSON完整且格式正确。

**输出要求**：
1. **结构要求**：必须输出完整的JSON格式（不要截断）：
   {
     "matrix": [
       {
         "cluster_id": "cluster_1_1",
         "cluster_name": "信息安全策略制定与维护",
         "levels": {
           "level_1": {
             "name": "初始级",
             "description": "信息安全策略管理处于临时性、混乱状态。没有正式的安全策略文档，或仅有口头约定。安全工作依赖个人经验和英雄主义，缺乏系统性管理。",
             "key_practices": [
               "没有正式的信息安全策略文档",
               "安全要求依靠口头传达",
               "缺乏管理层对安全策略的正式批准流程"
             ]
           },
           "level_2": {
             "name": "可重复级",
             "description": "已建立基本的安全策略文档，但流程尚未标准化。策略的制定和发布存在一定流程，但执行依赖特定人员，缺乏系统化管理。",
             "key_practices": [
               "已制定基本的信息安全策略文档",
               "策略经过管理层审批",
               "策略已传达给相关人员，但传达方式不系统"
             ]
           },
           "level_3": {
             "name": "已定义级",
             "description": "安全策略管理流程已标准化和文档化。策略的制定、审批、发布、传达和评审都有明确的流程和责任人，形成完整的管理闭环。",
             "key_practices": [
               "安全策略制定流程已标准化并文档化",
               "建立了策略定期评审机制（如每年评审一次）",
               "策略传达覆盖所有员工和相关外部方",
               "有明确的策略版本管理和更新记录"
             ]
           },
           "level_4": {
             "name": "可管理级",
             "description": "安全策略管理流程可度量和监控。建立了策略执行效果的评估指标，能够定期监测策略落实情况，并基于数据驱动进行策略优化。",
             "key_practices": [
               "建立了策略执行效果的量化指标",
               "定期收集和分析策略落实情况的数据",
               "基于评审结果和合规要求主动更新策略",
               "策略与组织风险管理体系深度整合"
             ]
           },
           "level_5": {
             "name": "优化级",
             "description": "安全策略管理持续改进和自动化。策略的制定、发布、监控和更新形成自动化闭环，能够自适应组织变化和外部威胁环境，持续优化策略有效性。",
             "key_practices": [
               "策略管理流程高度自动化（如策略发布、版本控制）",
               "基于威胁情报和行业最佳实践持续优化策略",
               "策略与组织战略目标深度对齐并持续调整",
               "建立策略有效性的闭环反馈和持续改进机制"
             ]
           }
         }
       }
     ],
     "maturity_model_description": "本成熟度模型基于CMMI（能力成熟度模型集成）的5级成熟度理念，结合IT安全管理最佳实践设计。模型从初始级的临时性管理逐步提升至优化级的持续改进，帮助组织系统化提升IT安全管理能力。"
   }

2. **成熟度定义**（必须严格遵守）：
   - **Level 1（初始级）**：临时性、混乱、个人英雄主义。流程不稳定，依赖个人能力，结果不可预测。
   - **Level 2（可重复级）**：基本流程建立，能够重复执行。但流程尚未标准化，依赖特定人员。
   - **Level 3（已定义级）**：流程标准化、文档化。有明确的流程、角色、责任，形成完整管理闭环。
   - **Level 4（可管理级）**：流程可度量、可监控。建立量化指标，基于数据驱动持续改进。
   - **Level 5（优化级）**：持续改进、自动化。流程高度优化，能自适应变化，持续创新。

3. **内容要求**：
   - **覆盖所有聚类**：每个输入的cluster必须对应matrix中的一项
   - **5个级别完整性**：每个cluster必须有5个成熟度级别（level_1到level_5）
   - **关键实践数量**：每个级别包含3-5个关键实践（key_practices）
   - **描述具体性**：
     * description字段必须详细描述该级别的管理状态（100-200字）
     * 描述需要体现从低到高的渐进性（Level 1→Level 5逐步提升）
     * key_practices必须是具体、可操作、可验证的实践（每条20-50字）

4. **逻辑连贯性**：
   - **渐进关系**：Level N+1必须在Level N的基础上提升（不能跳跃或倒退）
   - **差异明显**：相邻级别之间必须有清晰的能力差异
   - **实践合理**：key_practices必须符合该级别的能力定位
   - **术语一致**：同一个cluster的5个级别使用一致的术语和表述风格

5. **特殊要求**：
   - 如果cluster的risk_level为HIGH，则Level 1和Level 2的description应强调风险暴露
   - 如果cluster的importance为HIGH，则Level 4和Level 5应强调战略价值
   - 聚类的description（输入）应作为理解该聚类内涵的参考，确保矩阵内容与聚类主题契合

**注意**：
- 请严格输出JSON格式，确保每个聚类都有5个完整的成熟度级别
- 不要遗漏任何输入的cluster
- 确保JSON格式正确，可以被直接解析
- level_1到level_5的key必须完全一致，不要使用其他命名（如level1、Level_1等）
`

/**
 * 填充矩阵生成Prompt模板
 * @param clusteringResult 聚类分析结果
 * @returns 填充后的Prompt
 */
export function fillMatrixPrompt(clusteringResult: any): string {
  // 将聚类结果格式化为易读的文本
  const formattedClusters = formatClusteringResultForPrompt(clusteringResult)

  return MATRIX_PROMPT_TEMPLATE.replace('{{CLUSTERING_RESULT}}', formattedClusters)
}

/**
 * 格式化聚类结果用于Prompt
 * @param clusteringResult 聚类分析结果
 * @returns 格式化的文本
 */
function formatClusteringResultForPrompt(clusteringResult: any): string {
  const { categories } = clusteringResult

  let formatted = ''

  for (const category of categories) {
    formatted += `\n### ${category.name}\n`
    formatted += `说明：${category.description}\n\n`

    for (const cluster of category.clusters || []) {
      formatted += `**聚类ID**: ${cluster.id}\n`
      formatted += `**聚类名称**: ${cluster.name}\n`
      formatted += `**聚类描述**: ${cluster.description}\n`
      formatted += `**重要性**: ${cluster.importance}\n`
      formatted += `**风险等级**: ${cluster.risk_level}\n`
      formatted += `**包含条款数量**: ${cluster.clauses?.length || 0}\n`
      formatted += `\n---\n\n`
    }
  }

  return formatted
}

/**
 * 单聚类成熟度生成 Prompt 模板
 *
 * 优化：分批次生成，每次只处理一个聚类
 * 重点：成熟度描述必须包含原始文档条目的明确要求
 */
const SINGLE_CLUSTER_MATRIX_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于成熟度模型设计。请为以下聚类生成5级成熟度定义。

**聚类信息**：
{{CLUSTER_INFO}}

**原始文档条目**（该聚类包含的所有标准条款）：
{{CLAUSES}}

**重要提示**：
1. **成熟度描述必须包含原始文档条目中的明确要求**
2. 原始条目是该聚类的核心依据，成熟度级别应体现这些条目的实施深度
3. 不要泛泛而谈，要结合具体条目内容
4. 请严格按照JSON格式输出，不要添加任何注释或markdown标记

**输出要求**：
1. **结构要求**：必须输出完整的JSON格式：
   {
     "cluster_id": "cluster_1_1",
     "cluster_name": "信息安全策略制定与维护",
     "levels": {
       "level_1": {
         "name": "初始级",
         "description": "信息安全策略管理处于临时性、混乱状态。**原始条目要求：** {{引用具体条目}} **现状：** 没有正式的安全策略文档，或仅有口头约定...",
         "key_practices": [
           "没有正式的信息安全策略文档（对应条目2.1.1要求）",
           "安全要求依靠口头传达",
           "缺乏管理层对安全策略的正式批准流程（对应条目2.1.2要求）"
         ]
       },
       "level_2": { ... },
       "level_3": { ... },
       "level_4": { ... },
       "level_5": { ... }
     }
   }

2. **成熟度定义**（必须严格遵守CMMI 5级模型）：
   - **Level 1（初始级）**：临时性、混乱、个人英雄主义。**原始条目完全未实施或仅口头约定。**
   - **Level 2（可重复级）**：基本流程建立，能够重复执行。**原始条目部分实施，但流程未标准化。**
   - **Level 3（已定义级）**：流程标准化、文档化。**原始条目全面实施，形成完整管理闭环。**
   - **Level 4（可管理级）**：流程可度量、可监控。**原始条目实施效果可量化评估。**
   - **Level 5（优化级）**：持续改进、自动化。**原始条目实施自动化，持续优化。**

3. **内容要求**：
   - **description字段（150-250字）**：
     * 第一部分：明确引用原始文档条目的核心要求（用**原始条目要求：**标注）
     * 第二部分：描述该级别下这些要求的实施状态（用**现状：**标注）
     * 第三部分：说明该级别的管理特征
   - **key_practices（3-5个）**：
     * 每个实践必须明确对应原始条目的某个要求
     * 格式：实践描述 + （对应条目X.X.X要求）
     * 实践必须具体、可操作、可验证

4. **逻辑连贯性**：
   - **渐进关系**：Level N+1必须在Level N的基础上提升
   - **差异明显**：相邻级别之间必须有清晰的能力差异
   - **条目覆盖**：5个级别加起来必须覆盖所有原始条目的要求

5. **特殊要求**：
   - 风险等级HIGH：Level 1和Level 2强调风险暴露
   - 重要性HIGH：Level 4和Level 5强调战略价值
   - 原始条目是核心依据，不要脱离条目内容泛泛而谈

**注意**：
- 必须严格输出JSON格式
- level_1到level_5的key必须完全一致
- description必须引用原始条目
- key_practices必须标注对应条目
`

/**
 * 填充单聚类矩阵生成Prompt模板
 * @param cluster 单个聚类（包含clauses）
 * @returns 填充后的Prompt
 */
export function fillSingleClusterMatrixPrompt(cluster: any): string {
  // 格式化聚类信息
  let clusterInfo = `聚类ID：${cluster.id}\n`
  clusterInfo += `聚类名称：${cluster.name}\n`
  clusterInfo += `聚类描述：${cluster.description}\n`
  clusterInfo += `重要性：${cluster.importance}\n`
  clusterInfo += `风险等级：${cluster.risk_level}\n`

  // 格式化原始条目
  let clausesText = ''
  if (cluster.clauses && Array.isArray(cluster.clauses)) {
    clausesText += `共${cluster.clauses.length}个条款：\n\n`
    cluster.clauses.forEach((clause: any, index: number) => {
      clausesText += `【条目${index + 1}】\n`
      clausesText += `来源文档：${clause.source_document_name}\n`
      clausesText += `条款编号：${clause.clause_id}\n`
      clausesText += `条款内容：${clause.clause_text}\n`
      clausesText += `归类理由：${clause.rationale}\n`
      clausesText += `\n---\n\n`
    })
  } else {
    clausesText = '（无原始条目数据）'
  }

  return SINGLE_CLUSTER_MATRIX_PROMPT_TEMPLATE
    .replace('{{CLUSTER_INFO}}', clusterInfo)
    .replace('{{CLAUSES}}', clausesText)
}
