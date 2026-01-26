/**
 * 判断题差距分析改进措施生成Prompt模板
 * 用于基于判断题问卷的差距分析结果生成改进措施
 */

import { BinaryGapAnalysisOutput } from '../../survey/binary-gap-analyzer.service'

/**
 * 填充改进措施生成Prompt（基于判断题差距分析）
 */
export function fillBinaryActionPlanPrompt(
  gapAnalysisResult: BinaryGapAnalysisOutput,
  clusteringResult: any,
): string {
  // 格式化差距详情
  const gapDetailsText = gapAnalysisResult.gap_details
    .filter((detail) => detail.gap)
    .map((detail) => {
      return `- 聚类: ${detail.cluster_name}
  条款: ${detail.clause_id} - ${detail.clause_text}
  问题: ${detail.question_text}
  优先级: ${detail.priority}`
    })
    .join('\n')

  // 格式化差距聚类汇总
  const gapClustersText = gapAnalysisResult.gap_clusters
    .map((cluster) => {
      return `- ${cluster.cluster_name}: ${cluster.gap_clauses}/${cluster.total_clauses} 条款未满足（差距率: ${(cluster.gap_rate * 100).toFixed(1)}%）`
    })
    .join('\n')

  const prompt = `你是一名IT标准落地专家。请基于以下判断题问卷的差距分析结果，生成具体的改进措施。

**差距分析结果**：
总体合规率: ${(gapAnalysisResult.compliance_rate * 100).toFixed(1)}%
满足条款: ${gapAnalysisResult.satisfied_clauses}
差距条款: ${gapAnalysisResult.gap_clauses}

**差距聚类汇总**：
${gapClustersText}

**具体差距详情**（仅列出有差距的条款）：
${gapDetailsText}

**改进要求**：
1. 针对每个差距聚类，生成具体的改进措施
2. 每个措施应包含：
   - 措施ID（如 A001, A002）
   - 聚类名称
   - 差距条款列表
   - 优先级（基于差距率和重要性）
   - 具体行动项（3-5个）
   - 预期效果
   - 预估工作量
3. 措施要具体、可操作，避免笼统表述
4. 优先处理差距率高、重要性高的聚类

**输出格式**（严格遵循以下JSON格式）：
\`\`\`json
{
  "gap_analysis_summary": "${gapAnalysisResult.summary.overview}",
  "action_plan": [
    {
      "action_id": "A001",
      "cluster_id": "cluster_xxx",
      "cluster_name": "信息安全策略制定与维护",
      "gap_clauses": ["4.1.1", "4.1.2"],
      "priority": "HIGH",
      "action_items": [
        "起草正式的信息安全策略文档",
        "提交给管理层审批并获得正式批准",
        "建立策略文档的定期评审和更新机制（每年至少一次）",
        "将策略文档传达给全体员工并确认收到",
        "建立策略执行情况的监督检查机制"
      ],
      "expected_impact": "满足标准4.1.1和4.1.2的要求，建立正式的安全策略管理体系",
      "estimated_effort": "1-2个月",
      "responsible_department": "信息安全部 / 管理层",
      "resources_needed": {
        "personnel": ["安全主管", "法务人员", "行政助理"],
        "budget": "约5万元（含培训、文档制作）",
        "technology": ["文档管理系统", "内部通知平台"]
      },
      "risks": [
        { "risk": "管理层重视不足", "mitigation": "提供标准合规性说明和案例分析" },
        { "risk": "文档更新不及时", "mitigation": "建立定期评审机制和责任人制度" }
      ],
      "kpi_metrics": [
        { "metric": "策略文档完整性", "target": "100%", "measurement_method": "文档审查" },
        { "metric": "员工知晓率", "target": "≥90%", "measurement_method": "问卷调查" }
      ]
    }
  ],
  "implementation_timeline": {
    "quick_wins": [
      {
        "action_id": "A001",
        "description": "快速见效的措施",
        "timeline": "1个月内"
      }
    ],
    "medium_term": [
      {
        "action_id": "A002",
        "description": "中期措施",
        "timeline": "3-6个月"
      }
    ],
    "long_term": [
      {
        "action_id": "A003",
        "description": "长期措施",
        "timeline": "6-12个月"
      }
    ]
  },
  "overall_recommendations": [
    "优先改进差距率超过50%的聚类",
    "建立标准条款落实的跟踪机制",
    "定期进行内部合规性审核",
    "加强员工标准培训和意识提升"
  ]
}
\`\`\`

**重要约束**：
1. action_id必须是唯一的，格式为A001, A002, A003...
2. 严格遵循JSON格式，确保可以正确解析
3. 不要在JSON之外添加任何其他文本
4. 措施要具体、可操作，避免"完善"、"健全"等笼统表述
5. 每个措施的action_items至少包含3项，最多5项
6. kpi_metrics至少包含2项，最多4项`

  return prompt
}
