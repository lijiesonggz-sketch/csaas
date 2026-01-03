/**
 * 落地措施生成 Prompt 模板 (基于成熟度分析和差距分析)
 *
 * 输入：成熟度分析结果 + 差距分析结果 + 目标成熟度
 * 输出：针对每个聚类的具体改进措施
 */

/**
 * 为单个聚类生成改进措施的Prompt
 */
export function generateClusterMeasurePrompt(clusterGapData: {
  cluster_name: string
  cluster_id: string
  current_level: number
  target_level: number
  gap: number
  priority: string
  suggested_measure_count: number
  improvement_urgency: string
  question_details: Array<{
    question_text: string
    score: number
    level: number
    selected_option_text: string
  }>
}): string {
  return `你是一名资深数据安全治理专家,专注于帮助企业提升数据安全成熟度。请基于以下聚类的差距分析,生成具体、可执行的改进措施。

**聚类信息**:
- 聚类名称: ${clusterGapData.cluster_name}
- 聚类ID: ${clusterGapData.cluster_id}
- 当前成熟度: ${clusterGapData.current_level.toFixed(2)} 分
- 目标成熟度: ${clusterGapData.target_level.toFixed(1)} 分
- 成熟度差距: ${clusterGapData.gap.toFixed(2)} 分
- 改进优先级: ${clusterGapData.priority} (${clusterGapData.improvement_urgency})
- 需要生成措施数量: ${clusterGapData.suggested_measure_count} 条

**该聚类下的问题得分情况**:
${clusterGapData.question_details
  .map(
    (q, idx) =>
      `${idx + 1}. ${q.question_text}
   选择: ${q.selected_option_text}
   得分: ${q.score}/5 (Level ${q.level})`,
  )
  .join('\n\n')}

---

**输出要求**:

请严格按照以下JSON格式输出 **${clusterGapData.suggested_measure_count}条** 改进措施:

{
  "measures": [
    {
      "title": "措施标题（简明扼要，15字以内）",
      "description": "措施的详细描述，说明为什么需要这项措施、它将解决什么问题（80-150字）",
      "implementation_steps": [
        {
          "stepNumber": 1,
          "title": "步骤标题",
          "description": "详细说明该步骤的具体操作和注意事项（50-100字）",
          "duration": "预计耗时（如：2周、1个月）"
        },
        {
          "stepNumber": 2,
          "title": "...",
          "description": "...",
          "duration": "..."
        }
      ],
      "timeline": "总体时间线（如：3-6个月、短期内、1年）",
      "responsible_department": "负责部门（如：数据安全部、IT部门、法务部）",
      "expected_improvement": 0.5,
      "resources_needed": {
        "budget": "预算估算（如：20-30万元、中等投入）",
        "personnel": ["所需人员1", "所需人员2"],
        "technology": ["所需技术/工具1", "所需技术/工具2"],
        "training": "培训需求描述"
      },
      "dependencies": {
        "prerequisiteMeasures": [],
        "externalDependencies": ["外部依赖1", "外部依赖2"]
      },
      "risks": [
        {
          "risk": "潜在风险描述",
          "mitigation": "风险缓解措施"
        }
      ],
      "kpi_metrics": [
        {
          "metric": "KPI指标名称",
          "target": "目标值（如：90%、<2小时）",
          "measurementMethod": "测量方法"
        }
      ]
    }
  ]
}

**生成措施的关键原则**:

1. **针对性强**:
   - 必须基于上述问题得分情况,针对低分项(≤3分)制定改进措施
   - 引用具体的问题,说明该措施将如何提升相关问题的得分

2. **优先级排序**:
   - 将最紧迫、影响最大的措施排在前面
   - ${clusterGapData.priority === 'high' ? '该聚类为高优先级,措施应聚焦于快速提升基础能力' : clusterGapData.priority === 'medium' ? '该聚类为中优先级,措施应注重系统化改进' : '该聚类为低优先级,措施可以是优化性质的'}

3. **具体可执行**:
   - 每条措施包含3-5个具体实施步骤
   - 步骤要有清晰的时间线和负责人
   - 避免"加强xxx管理"之类的空洞建议

4. **现实可行**:
   - 考虑企业的资源约束(人力、预算、技术能力)
   - 给出合理的时间估算(不要过于乐观)
   - 提供快速见效的措施(Quick Wins)

5. **依赖关系**:
   - 如果某措施依赖其他措施先完成,在dependencies中说明
   - 标注需要外部支持(如管理层批准、外部咨询)

6. **风险评估**:
   - 识别实施过程中可能遇到的主要风险(2-3个)
   - 提供具体的缓解措施

7. **可度量**:
   - 为每条措施设置2-3个KPI指标
   - KPI要具体、可测量、可达成

**示例**:

如果问题"您的组织是否建立了数据分类分级体系？"得分为1分(Level 1),那么应该生成类似这样的措施:

{
  "title": "建立数据分类分级管理体系",
  "description": "当前组织缺乏系统的数据分类分级体系,导致无法针对不同敏感度的数据实施差异化保护。本措施旨在建立符合行业标准和监管要求的数据分类分级制度,为后续的数据安全管理工作提供基础。",
  "implementation_steps": [
    {
      "stepNumber": 1,
      "title": "组建数据分类分级工作组",
      "description": "成立由数据安全负责人牵头,业务部门、IT部门、法务部门参与的跨部门工作组。明确各方职责,制定项目计划和时间表。",
      "duration": "1周"
    },
    {
      "stepNumber": 2,
      "title": "调研行业标准和监管要求",
      "description": "研究《数据安全法》《个人信息保护法》等法律法规要求,参考GB/T 35273、ISO 27001等标准,结合行业最佳实践,制定适合本组织的分类分级标准。",
      "duration": "2-3周"
    },
    {
      "stepNumber": 3,
      "title": "识别和梳理数据资产",
      "description": "全面盘点组织内的数据资产,包括业务数据、用户数据、系统数据等。形成数据资产清单,为分类分级提供基础数据。",
      "duration": "4-6周"
    },
    {
      "stepNumber": 4,
      "title": "制定分类分级规则并试点",
      "description": "基于调研结果,制定数据分类分级规则(如公开、内部、敏感、高敏感四级)。选择1-2个业务场景进行试点,验证规则的可行性和有效性。",
      "duration": "3-4周"
    },
    {
      "stepNumber": 5,
      "title": "全面推广和持续优化",
      "description": "在试点成功基础上,全面推广数据分类分级工作。建立定期评审机制,根据业务变化和监管要求持续优化分类分级规则。",
      "duration": "2-3个月"
    }
  ],
  "timeline": "6个月",
  "responsible_department": "数据安全部(牵头)、IT部门、业务部门、法务部",
  "expected_improvement": 2.5,
  "resources_needed": {
    "budget": "30-50万元(包含外部咨询、工具采购、培训费用)",
    "personnel": ["数据安全专家1-2名", "业务分析师2-3名", "IT技术人员2名"],
    "technology": ["数据资产管理工具", "数据分类标签系统"],
    "training": "需对全员进行数据分类分级培训,重点培训数据处理人员"
  },
  "dependencies": {
    "prerequisiteMeasures": [],
    "externalDependencies": ["获得管理层批准和资源支持", "可能需要外部咨询公司协助"]
  },
  "risks": [
    {
      "risk": "业务部门配合度不高,数据盘点困难",
      "mitigation": "获得管理层支持,将数据分类分级纳入各部门KPI考核;提供便捷的数据上报工具和模板"
    },
    {
      "risk": "分类标准过于复杂,执行成本高",
      "mitigation": "采用简化的四级分类标准,避免过度细分;提供自动化工具辅助分类"
    }
  ],
  "kpi_metrics": [
    {
      "metric": "数据资产分类覆盖率",
      "target": "≥90%",
      "measurementMethod": "统计已分类数据资产占总数据资产的比例"
    },
    {
      "metric": "分类准确率",
      "target": "≥85%",
      "measurementMethod": "定期抽查,由专家评估分类结果的准确性"
    },
    {
      "metric": "数据处理人员培训完成率",
      "target": "100%",
      "measurementMethod": "统计参加培训并通过考核的人员比例"
    }
  ]
}

---

**重要提示**:
1. **严格按照JSON格式输出**,不要添加markdown代码块标记(如\`\`\`json或\`\`\`)
2. **不要添加任何注释、说明文字或额外内容**,只输出纯JSON对象
3. 确保所有字符串用双引号包裹,不要使用单引号
4. 确保生成 **${clusterGapData.suggested_measure_count}条** 措施
5. 每条措施必须包含3-5个implementation_steps
6. expected_improvement的总和应接近差距值(${clusterGapData.gap.toFixed(2)})
7. 措施之间要有逻辑顺序,基础措施排在前面,高级措施排在后面
8. 确保JSON格式完全合法,不要有尾随逗号、未引号的属性名等常见错误
9. **特别注意**：
   - risks 必须是数组: "risks": [{"risk": "...", "mitigation": "..."}]
   - kpi_metrics 必须是数组: "kpi_metrics": [{"metric": "...", "target": "...", "measurementMethod": "..."}]
   - 不要忘记写 "risks": 和 "kpi_metrics": 这些键名
   - 每个数组元素之间用逗号分隔,最后一个元素后面不要有逗号
10. **输出前请检查**：
    - 所有 { 都有对应的 }
    - 所有 [ 都有对应的 ]
    - 所有字符串都用双引号
    - 所有对象字段之间用逗号分隔
    - 数组的最后一个元素后面不要有逗号

现在请开始生成 **${clusterGapData.suggested_measure_count}条** 改进措施,输出纯JSON(不要有任何其他文字):
`
}

/**
 * 生成措施优化和验证的Prompt
 * 用于三模型一致性检查后的优化
 */
export function generateMeasureOptimizationPrompt(
  originalMeasure: any,
  clusterInfo: { cluster_name: string; gap: number },
): string {
  return `请优化以下改进措施,确保其具体性、可行性和完整性:

**聚类**: ${clusterInfo.cluster_name}
**成熟度差距**: ${clusterInfo.gap.toFixed(2)}

**原始措施**:
${JSON.stringify(originalMeasure, null, 2)}

**优化要求**:
1. 检查implementation_steps是否足够详细和可执行
2. 确认resources_needed的预算和人员估算是否合理
3. 验证kpi_metrics是否具体可度量
4. 补充遗漏的risks和dependencies
5. 优化description,使其更加简洁明了

请输出优化后的完整JSON对象(格式与原始措施相同):
`
}

/**
 * 生成措施排序和路线图规划的Prompt
 */
export function generateImplementationRoadmapPrompt(
  allMeasures: any[],
  targetTimeline: string,
): string {
  return `请基于以下所有改进措施,生成一个分阶段的实施路线图:

**所有措施**:
${JSON.stringify(allMeasures, null, 2)}

**目标完成时间**: ${targetTimeline}

**输出要求**:

生成一个三阶段的实施路线图,按照以下JSON格式:

{
  "roadmap": {
    "phase_1": {
      "name": "第一阶段 - 基础建设与快速见效",
      "timeframe": "0-3个月",
      "priority": "高优先级,紧急且重要",
      "measure_ids": ["measure_id_1", "measure_id_2", ...],
      "goals": ["阶段目标1", "阶段目标2"],
      "key_deliverables": ["交付物1", "交付物2"]
    },
    "phase_2": {
      "name": "第二阶段 - 系统化改进",
      "timeframe": "3-6个月",
      "priority": "中优先级,重要但不紧急",
      "measure_ids": [...],
      "goals": [...],
      "key_deliverables": [...]
    },
    "phase_3": {
      "name": "第三阶段 - 持续优化",
      "timeframe": "6-12个月",
      "priority": "优化提升",
      "measure_ids": [...],
      "goals": [...],
      "key_deliverables": [...]
    }
  },
  "critical_path": ["按依赖关系排序的关键措施ID"],
  "parallel_tracks": [
    {
      "track_name": "可并行推进的工作轨道1",
      "measure_ids": [...]
    }
  ]
}

**排序原则**:
1. 有依赖关系的措施,被依赖的排在前面
2. 高优先级措施优先安排
3. Quick Wins(时间短、见效快)优先安排在第一阶段
4. 每个阶段的措施数量要平衡,避免某阶段过载
5. 考虑资源约束,避免同时进行过多措施

请输出完整的JSON:
`
}
