/**
 * 判断题问卷生成Prompt模板
 * 用于基于聚类结果生成判断题问卷（有/没有）
 */

import { ClusteringGenerationOutput } from '../generators/clustering.generator'

/**
 * 填充判断题问卷生成Prompt
 */
export function fillBinaryQuestionnairePrompt(
  clusteringResult: ClusteringGenerationOutput,
): string {
  // 将聚类结果格式化为文本
  const categoriesText = JSON.stringify(clusteringResult.categories, null, 2)

  const prompt = `你是一名IT标准调研专家。请基于以下聚类结果生成判断题问卷。

**聚类结果**：
\`\`\`
${categoriesText}
\`\`\`

**问卷要求**：
1. 为每个聚类中的每个条款生成一道判断题
2. 问题格式："组织是否具备以下能力：[条款要求]？"
3. 答案选项：
   - A. 有（完全满足条款要求）
   - B. 没有（不满足或部分满足条款要求）
4. 确保覆盖所有条款，不遗漏
5. 问题语言要简洁明了，避免使用技术术语
6. 在guidance字段提供详细的判断指引，帮助用户准确判断

**输出格式**（严格遵循以下JSON格式）：
\`\`\`json
{
  "questionnaire": [
    {
      "question_id": "Q001",
      "cluster_id": "cluster_1_1",
      "cluster_name": "信息安全策略制定与维护",
      "category_name": "安全管理",
      "clause_id": "4.1.1",
      "clause_text": "制定信息安全策略，由管理层批准...",
      "question_text": "组织是否制定了由管理层批准的正式信息安全策略文档？",
      "expected_answer": true,
      "guidance": "如果组织有正式的、经过批准的书面策略文档，选择'有'；否则选择'没有'"
    },
    {
      "question_id": "Q002",
      "cluster_id": "cluster_1_2",
      "cluster_name": "安全组织和职责",
      "category_name": "安全管理",
      "clause_id": "4.1.2",
      "clause_text": "建立信息安全组织架构，明确安全职责...",
      "question_text": "组织是否建立了明确的信息安全组织架构和职责分工？",
      "expected_answer": true,
      "guidance": "如果有明确的安全组织架构（如安全委员会、安全部门）和职责分工，选择'有'；否则选择'没有'"
    }
  ],
  "questionnaire_metadata": {
    "total_questions": 50,
    "coverage_map": {
      "cluster_1_1": 5,
      "cluster_1_2": 4
    },
    "categories_summary": [
      {
        "category_name": "安全管理",
        "total_questions": 20,
        "clusters_count": 5
      }
    ]
  }
}
\`\`\`

**重要约束**：
1. question_id必须是唯一的，格式为Q001, Q002, Q003...
2. cluster_id和cluster_name必须与聚类结果中的ID和名称一致
3. clause_text要引用聚类结果中的原始条款文本
4. expected_answer应该是true（表示"有"是期望的正确答案）
5. guidance要具体实用，给出明确的判断标准
6. 严格遵循JSON格式，确保可以正确解析
7. 不要在JSON之外添加任何其他文本`

  return prompt
}

/**
 * 填充判断题问卷生成Prompt（简化版，用于token限制情况）
 */
export function fillBinaryQuestionnairePromptSimple(
  clusteringResult: ClusteringGenerationOutput,
  maxClusters?: number,
): string {
  // 如果指定了最大聚类数，只处理前N个聚类
  let categories = clusteringResult.categories
  if (maxClusters && categories.length > maxClusters) {
    categories = categories.slice(0, maxClusters)
  }

  // 简化的聚类结果文本（只包含必要信息）
  const categoriesText = categories
    .map((cat) => {
      const clustersSummary = cat.clusters
        .map((cluster) => {
          const clausesCount = cluster.clauses?.length || 0
          return `    - ${cluster.name}: ${clausesCount}个条款`
        })
        .join('\n')

      return `  - ${cat.name}:\n${clustersSummary}`
    })
    .join('\n')

  const prompt = `你是一名IT标准调研专家。请基于以下聚类结构生成判断题问卷。

**聚类结构**：
${categoriesText}

**问卷要求**：
1. 为每个聚类中的每个条款生成一道判断题
2. 问题格式："组织是否具备以下能力：[条款要求]？"
3. 答案选项：A. 有 / B. 没有
4. 确保覆盖所有条款

**输出格式**：
\`\`\`json
{
  "questionnaire": [
    {
      "question_id": "Q001",
      "cluster_id": "cluster_id",
      "cluster_name": "聚类名称",
      "category_name": "分类名称",
      "clause_id": "条款ID",
      "clause_text": "条款内容",
      "question_text": "组织是否...？",
      "expected_answer": true,
      "guidance": "判断指引"
    }
  ],
  "questionnaire_metadata": {
    "total_questions": 数字,
    "coverage_map": {
      "cluster_id": 题目数量
    }
  }
}
\`\`\`

请按照聚类结构为每个条款生成判断题，确保JSON格式正确。`

  return prompt
}
