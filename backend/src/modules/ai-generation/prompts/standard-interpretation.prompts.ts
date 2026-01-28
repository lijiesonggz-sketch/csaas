/**
 * 标准解读Prompt模板
 * 用于单一标准的深度解读
 */

/**
 * 标准解读输入接口
 */
export interface StandardInterpretationInput {
  standardDocument: {
    id: string
    name: string
    content: string
  }
  interpretationMode?: 'basic' | 'detailed' | 'enterprise' // 解读模式：基础/详细/企业级
  temperature?: number
  maxTokens?: number
}

/**
 * 填充标准解读Prompt（全面优化版）
 */
export function fillStandardInterpretationPrompt(
  standardDocument: { id: string; name: string; content: string },
  interpretationMode: 'basic' | 'detailed' | 'enterprise' = 'enterprise',
): string {
  // 所有模式都使用完整文档，让AI根据模式决定输出详细程度
  let prompt =
    '你是一名资深IT标准咨询专家，拥有20年企业合规咨询经验。请为以下标准提供全面、深入、可操作的解读，目标用户是企业合规负责人和咨询师。\n\n'

  prompt += '**标准文档**：\n'
  prompt += `**标准名称**：${standardDocument.name}\n\n`
  prompt += `**标准内容**（完整文档，共${standardDocument.content.length}字符）：\n${standardDocument.content}\n\n`

  // 根据模式设置解读深度
  const modeConfig = {
    basic: {
      description: '快速概览模式',
      focusArea: '核心条款（10-15个最重要的条款）',
      includeRiskMatrix: false,
      includeRoadmap: false,
      includeChecklists: false,
      includeEvidenceTemplates: false,
      riskDetail: false,
    },
    detailed: {
      description: '全面解读模式',
      focusArea: '主要条款（20-30个主要条款）',
      includeRiskMatrix: false,
      includeRoadmap: false,
      includeChecklists: false,
      includeEvidenceTemplates: false,
      riskDetail: true,
    },
    enterprise: {
      description: '企业级深度模式',
      focusArea: '所有条款（30-60个所有条款，不得遗漏）',
      includeRiskMatrix: true,
      includeRoadmap: true,
      includeChecklists: true,
      includeEvidenceTemplates: true,
      riskDetail: true,
    },
  }

  const config = modeConfig[interpretationMode]

  prompt += `**解读模式**：${config.description}\n`
  prompt += `**关注范围**：${config.focusArea}\n\n`

  prompt += '**解读深度要求**（每个条款必须包含6个维度）：\n'
  prompt += '1. **What（是什么）**：条款的完整要求和含义\n'
  prompt += '2. **Why（为什么）**：条款存在的目的和价值\n'
  prompt += '3. **How（怎么做）**：具体的实施步骤和方法\n'
  prompt += '4. **Risk（风险）**：不合规或实施不当的风险\n'
  prompt += '5. **Evidence（证据）**：如何证明已符合（文档/系统/记录）\n'
  prompt += '6. **Tip（技巧）**：实施中的最佳实践和避坑指南\n\n'

  prompt += '**条款覆盖要求**：\n'
  if (interpretationMode === 'basic') {
    prompt += '- 选择**10-15个最重要、最核心的条款**进行解读\n'
    prompt += '- 优先选择强制性要求、高风险领域\n'
    prompt += '- 可以略过次要条款\n'
  } else if (interpretationMode === 'detailed') {
    prompt += '- 解读**20-30个主要条款**，覆盖所有重要内容\n'
    prompt += '- 按章节顺序组织，涵盖所有主要章节\n'
    prompt += '- 不要遗漏重要条款\n'
  } else {
    prompt += '- 【核心要求】必须完整解读标准中的**所有主要条款**，不要遗漏任何条款\n'
    prompt += '- 按章节顺序组织（第4章、第5章、第6章、第7章等），涵盖所有章节\n'
    prompt += '- 每个条款必须包含**完整的条款原文**，不能只是总结或概括\n'
    prompt +=
      '- 如果标准有30个条款，就解读30个；如果有50个条款，就解读50个；如果有60个，就解读60个\n'
    prompt += '- **宁可覆盖全面，不可遗漏**！宁多勿少！\n'
  }
  prompt += '- key_requirements数组必须包含根据模式指定的所有要求项\n\n'

  prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
  prompt += '```json\n'
  prompt += '{\n'
  prompt += '  "overview": {\n'
  prompt += '    "background": "标准制定背景和修订历史",\n'
  prompt += '    "scope": "适用范围和对象",\n'
  prompt += '    "core_objectives": ["核心目标1", "核心目标2"],\n'
  prompt += '    "target_audience": ["目标受众1", "目标受众2"]'

  if (interpretationMode === 'enterprise') {
    prompt += ',\n    "key_changes": "与前一版本的主要变化（如有）"'
  }

  prompt += '\n  },\n'
  prompt += '  "key_terms": [\n'
  prompt += '    {\n'
  prompt += '      "term": "术语名称",\n'
  prompt += '      "definition": "简短定义",\n'
  prompt += '      "explanation": "详细解释和实际应用场景",\n'
  if (interpretationMode !== 'basic') {
    prompt += '      "examples": ["应用示例1", "应用示例2"]\n'
  } else {
    prompt += '      "examples": []\n'
  }
  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "key_requirements": [\n'
  prompt += '    {\n'
  prompt += '      "clause_id": "条款编号"'

  // 收集需要添加的字段
  const reqFields = []

  if (interpretationMode !== 'basic') {
    reqFields.push('\n      "chapter": "所属章节（如：第4章 术语和定义）"')
  }

  if (interpretationMode === 'enterprise') {
    reqFields.push(
      '\n      "clause_full_text": "【重要】条款的完整原文，必须逐字逐句包含标准中的所有内容"',
    )
  }

  if (interpretationMode !== 'basic') {
    reqFields.push('\n      "clause_summary": "条款内容的一句话总结"')
  }

  // 添加所有字段（用逗号分隔）
  if (reqFields.length > 0) {
    reqFields.forEach((field, idx) => {
      prompt += ',' + field
    })
  }
  prompt += ',\n'

  prompt += '      "interpretation": {\n'
  prompt += '        "what": "条款要求的具体内容"'
  if (interpretationMode !== 'basic') {
    prompt += ',\n        "why": "为什么需要这个条款"'
  }
  prompt += ',\n        "how": "如何满足条款要求"\n'
  prompt += '      }'

  // 收集需要添加的对象级字段
  const objFields = []

  if (interpretationMode !== 'basic') {
    objFields.push(
      '\n      "compliance_criteria": {\n        "must_have": ["必须有的文档/系统/流程"]',
    )
    if (interpretationMode === 'enterprise') {
      objFields.push(',\n        "should_have": ["建议有的内容"]')
    }
    objFields.push(',\n        "evidence_required": ["需要的证据清单"]')
    objFields.push(',\n        "assessment_method": "如何评估符合性"\n      }')
  }

  if (config.riskDetail || interpretationMode === 'enterprise') {
    objFields.push('\n      "risk_assessment": {')
    if (interpretationMode === 'enterprise') {
      objFields.push(
        '\n        "non_compliance_risks": [{\n          "risk": "风险描述",\n          "consequence": "不合规的后果",\n          "probability": "高/中/低",\n          "mitigation": "缓解措施"\n        }]',
      )
    }
    if (interpretationMode === 'enterprise') {
      objFields.push(
        ',\n        "implementation_risks": [{\n          "risk": "实施风险",\n          "consequence": "可能的问题",\n          "prevention": "预防措施"\n        }]',
      )
    }
    objFields.push('\n      }')
  }

  if (objFields.length > 0) {
    objFields.forEach((field) => {
      prompt += ',' + field
    })
  }

  // 最后一个字段：priority及相关字段
  if (interpretationMode !== 'basic') {
    prompt += ',\n      "priority": "HIGH"'
    prompt += ',\n      "estimated_effort": "预估工期（如：2-4周）"'
    if (interpretationMode === 'enterprise') {
      prompt += ',\n      "implementation_order": 1'
      prompt += ',\n      "dependencies": ["依赖的其他条款编号"]'
    }
    prompt += ',\n      "best_practices": ["最佳实践1", "最佳实践2"]'
    prompt += ',\n      "common_mistakes": ["常见错误1", "常见错误2"]'
    prompt += '\n    }'
  } else {
    prompt += ',\n      "priority": "HIGH"\n    }'
  }

  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "implementation_guidance": {\n'
  prompt += '    "preparation": ["准备步骤1", "准备步骤2"],\n'
  if (interpretationMode !== 'basic') {
    prompt += '    "implementation_steps": [\n'
    prompt += '      {\n'
    prompt += '        "phase": "阶段名称",\n'
    prompt += '        "order": 1,\n'
    if (interpretationMode === 'enterprise') {
      prompt += '        "duration": "预估时长",\n'
      prompt += '        "objectives": ["阶段目标1", "阶段目标2"],\n'
    }
    prompt += '        "steps": ["具体步骤1", "具体步骤2"],\n'
    if (interpretationMode === 'enterprise') {
      prompt += '        "deliverables": ["交付物1", "交付物2"]\n'
    }
    prompt += '      }\n'
    prompt += '    ],\n'
  }
  prompt += '    "best_practices": ["最佳实践1", "最佳实践2"],\n'
  prompt += '    "common_pitfalls": ["常见误区1", "常见误区2"],\n'
  prompt += '    "timeline_estimate": "总体预估时间",\n'

  if (interpretationMode === 'enterprise') {
    prompt += '    "checklists": {\n'
    prompt += '      "document_checklist": ["□ 文档1", "□ 文档2"],\n'
    prompt += '      "system_checklist": ["□ 系统1", "□ 系统2"],\n'
    prompt += '      "process_checklist": ["□ 流程1", "□ 流程2"],\n'
    prompt += '      "interview_preparation": ["□ 访谈准备1", "□ 访谈准备2"]\n'
    prompt += '    },\n'
    prompt += '    "evidence_templates": [\n'
    prompt += '      {\n'
    prompt += '        "clause": "条款编号",\n'
    prompt += '        "evidence_type": "证据类型（文档/系统/记录）",\n'
    prompt += '        "description": "证据说明",\n'
    prompt += '        "sample_reference": "参考样例"\n'
    prompt += '      }\n'
    prompt += '    ],\n'
  }

  if (interpretationMode !== 'basic') {
    prompt += '    "resource_requirements": {\n'
    prompt += '      "team": "团队配置要求",\n'
    prompt += '      "budget": "预算估算",\n'
    prompt += '      "tools": "需要的工具平台"\n'
    prompt += '    }\n'
  } else {
    prompt += '    "resource_requirements": "简要说明资源需求"\n'
  }

  prompt += '  }\n'

  if (interpretationMode === 'enterprise') {
    prompt += ',\n  "risk_matrix": {\n'
    prompt += '    "high_risk_clauses": ["高风险条款编号列表"],\n'
    prompt += '    "common_failures": [\n'
    prompt += '      {\n'
    prompt += '        "clause": "条款编号",\n'
    prompt += '        "failure_point": "常见失败点",\n'
    prompt += '        "consequence": "后果",\n'
    prompt += '        "mitigation": "改进建议"\n'
    prompt += '      }\n'
    prompt += '    ],\n'
    prompt += '    "audit_focus_areas": ["评审重点关注区域"]\n'
    prompt += '  },\n'
    prompt += '  "implementation_roadmap": {\n'
    prompt += '    "phase_1_foundation": {\n'
    prompt += '      "name": "基础建设阶段",\n'
    prompt += '      "duration": "1-3个月",\n'
    prompt += '      "clauses": ["条款编号列表"],\n'
    prompt += '      "focus": "阶段重点",\n'
    prompt += '      "deliverables": ["交付物"]\n'
    prompt += '    },\n'
    prompt += '    "phase_2_digitalization": {\n'
    prompt += '      "name": "数字化阶段",\n'
    prompt += '      "duration": "3-6个月",\n'
    prompt += '      "clauses": ["条款编号列表"],\n'
    prompt += '      "focus": "阶段重点",\n'
    prompt += '      "deliverables": ["交付物"]\n'
    prompt += '    },\n'
    prompt += '    "phase_3_automation": {\n'
    prompt += '      "name": "自动化阶段",\n'
    prompt += '      "duration": "6-12个月",\n'
    prompt += '      "clauses": ["条款编号列表"],\n'
    prompt += '      "focus": "阶段重点",\n'
    prompt += '      "deliverables": ["交付物"]\n'
    prompt += '    },\n'
    prompt += '    "phase_4_optimization": {\n'
    prompt += '      "name": "持续优化阶段",\n'
    prompt += '      "duration": "12个月+",\n'
    prompt += '      "clauses": ["条款编号列表"],\n'
    prompt += '      "focus": "阶段重点",\n'
    prompt += '      "deliverables": ["交付物"]\n'
    prompt += '    }\n'
    prompt += '  }\n'
  }

  prompt += '}\n'
  prompt += '```\n\n'

  prompt += '**重要约束**（必须严格遵守）：\n'
  prompt += '1. 【必须】严格遵循JSON格式，不要在JSON之外添加任何其他文本\n'

  if (interpretationMode === 'enterprise') {
    prompt +=
      '2. 【必须】key_requirements必须包含标准中的**所有主要条款**（30-60个），不要遗漏任何条款\n'
    prompt +=
      '3. 【必须】每个条款的clause_full_text必须包含**完整的条款原文**，逐字逐句，不能省略或简化\n'
  } else if (interpretationMode === 'detailed') {
    prompt += '2. 【必须】key_requirements必须包含**20-30个主要条款**，覆盖所有重要内容\n'
  } else {
    prompt += '2. 【必须】key_requirements必须包含**10-15个最重要的核心条款**\n'
  }

  prompt += '4. 【必须】所有字段都必须填写，不要留空或使用null\n'
  prompt += '5. 严格按照解读模式的要求，包含或排除相应字段\n\n'

  prompt += '请按照以上要求进行专业、全面、深入的解读。'

  return prompt
}

/**
 * 关联标准搜索输入接口
 */
export interface RelatedStandardSearchInput {
  interpretationTaskId: string
  standardDocument: {
    id: string
    name: string
    content: string
  }
  interpretationResult?: any // 标准解读结果（可选）
  temperature?: number
  maxTokens?: number
}

/**
 * 填充关联标准搜索Prompt（一次性处理模式 - 降级处理）
 */
export function fillRelatedStandardSearchPrompt(
  standardDocument: { id: string; name: string; content: string },
  interpretationResult?: any,
): string {
  let prompt =
    '你是一名IT标准关联专家。请为以下标准的每个主要条款搜索关联的国家标准（GB）和行业标准。\n\n'

  prompt += '**目标标准**：\n'
  prompt += standardDocument.name + '\n\n'

  // 如果提供了解读结果，使用其关键要求
  if (interpretationResult && interpretationResult.key_requirements) {
    prompt += '**主要条款**：\n'
    interpretationResult.key_requirements.forEach((req: any) => {
      prompt += '- ' + req.clause_id + ' ' + req.clause_text + '\n'
    })
    prompt += '\n'
  }

  // 始终使用完整的标准内容作为上下文（不再降级为前3000字符）
  prompt += '**标准内容（完整文档）**：\n'
  prompt += `标准名称：${standardDocument.name}\n`
  prompt += `标准长度：${standardDocument.content.length} 字符\n\n`
  prompt += standardDocument.content + '\n\n'

  prompt += '**搜索要求**：\n'
  prompt += '1. 为每个条款搜索相关的GB标准（国家标准）\n'
  prompt += '2. 为每个条款搜索相关的行业标准（如金融、医疗、教育等）\n'
  prompt += '3. 标注关联类型（引用/补充/冲突/协同）\n'
  prompt += '4. 优先搜索最新版本的标准\n\n'

  prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
  prompt += '```json\n'
  prompt += '{\n'
  prompt += '  "related_standards": [\n'
  prompt += '    {\n'
  prompt += '      "clause_id": "条款编号",\n'
  prompt += '      "clause_text": "条款内容",\n'
  prompt += '      "related_standards": [\n'
  prompt += '        {\n'
  prompt += '          "standard_code": "GB/T 22239-2019",\n'
  prompt += '          "standard_name": "标准名称",\n'
  prompt += '          "relation_type": "REFERENCE",\n'
  prompt += '          "relevance_score": 0.9,\n'
  prompt += '          "description": "关联说明"\n'
  prompt += '        }\n'
  prompt += '      ]\n'
  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "summary": {\n'
  prompt += '    "total_related_standards": 15,\n'
  prompt += '    "national_standards_count": 8,\n'
  prompt += '    "industry_standards_count": 7,\n'
  prompt += '    "top_relations": ["引用最多标准的条款"]\n'
  prompt += '  }\n'
  prompt += '}\n'
  prompt += '```\n\n'

  prompt += '**重要约束**：\n'
  prompt += '1. 严格遵循JSON格式\n'
  prompt += '2. relation_type使用REFERENCE/SUPPLEMENT/CONFLICT/SYNERGY\n'
  prompt += '3. relevance_score范围0-1\n'
  prompt += '4. 每个条款至少关联1个标准，最多5个\n\n'

  prompt += '请按照以上要求进行关联标准搜索。'

  return prompt
}

/**
 * 填充单条款关联标准搜索Prompt（逐条处理模式 - 推荐）
 */
export function fillRelatedStandardSearchForClausePrompt(
  standardDocument: { id: string; name: string; content: string },
  clause: any,
): string {
  let prompt = '你是一名IT标准关联专家。请为以下单个条款搜索关联的国家标准（GB）和行业标准。\n\n'

  prompt += '**目标标准**：\n'
  prompt += `标准名称：${standardDocument.name}\n`
  prompt += `标准长度：${standardDocument.content.length} 字符\n\n`

  prompt += '**当前条款**：\n'
  prompt += `条款编号：${clause.clause_id}\n`
  prompt += `条款内容：${clause.clause_text || clause.clause_summary || ''}\n`
  if (clause.interpretation) {
    if (typeof clause.interpretation === 'string') {
      prompt += `条款解读：${clause.interpretation}\n`
    } else if (typeof clause.interpretation === 'object') {
      prompt += `条款解读：\n`
      prompt += `- What（是什么）：${clause.interpretation.what || 'N/A'}\n`
      prompt += `- Why（为什么）：${clause.interpretation.why || 'N/A'}\n`
      prompt += `- How（怎么做）：${clause.interpretation.how || 'N/A'}\n`
    }
  }
  prompt += '\n'

  // 提供完整标准内容作为上下文
  prompt += '**标准完整内容（作为上下文参考）**：\n'
  prompt += '```\n'
  prompt += standardDocument.content + '\n'
  prompt += '```\n\n'

  prompt += '**搜索要求**：\n'
  prompt += '1. 仅为当前条款搜索相关的GB标准（国家标准）\n'
  prompt += '2. 搜索相关的行业标准（如金融、医疗、教育、政务等）\n'
  prompt += '3. 标注关联类型（引用/补充/冲突/协同）\n'
  prompt += '4. 优先搜索最新版本的标准\n'
  prompt += '5. 至少找到1个关联标准，最多5个\n\n'

  prompt += '**关联类型说明**：\n'
  prompt += '- REFERENCE（引用）：目标标准被当前条款直接引用\n'
  prompt += '- SUPPLEMENT（补充）：目标标准对当前条款有补充说明\n'
  prompt += '- CONFLICT（冲突）：目标标准与当前条款存在冲突\n'
  prompt += '- SYNERGY（协同）：目标标准与当前条款相互协同配合\n\n'

  prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
  prompt += '```json\n'
  prompt += '{\n'
  prompt += '  "related_standards": [\n'
  prompt += '    {\n'
  prompt += '      "standard_code": "GB/T 22239-2019",\n'
  prompt += '      "standard_name": "信息安全技术 网络安全等级保护基本要求",\n'
  prompt += '      "relation_type": "REFERENCE",\n'
  prompt += '      "relevance_score": 0.95,\n'
  prompt += '      "description": "该条款直接引用了GB/T 22239-2019中关于安全等级划分的要求"\n'
  prompt += '    }\n'
  prompt += '  ]\n'
  prompt += '}\n'
  prompt += '```\n\n'

  prompt += '**重要约束**：\n'
  prompt += '1. 【必须】严格遵循JSON格式，不要添加任何其他文本\n'
  prompt += '2. 【必须】relation_type使用REFERENCE/SUPPLEMENT/CONFLICT/SYNERGY之一\n'
  prompt += '3. 【必须】relevance_score为0-1之间的数值，保留2位小数\n'
  prompt += '4. 【必须】至少返回1个关联标准，最多返回5个\n'
  prompt += '5. 【必须】description字段详细说明关联原因（30-100字）\n\n'

  prompt += '请按照以上要求进行关联标准搜索。'

  return prompt
}

/**
 * 批量解读输入接口（两阶段模式）
 */
export interface BatchInterpretationInput {
  clauses: Array<{
    clause_id: string
    clause_full_text: string
    chapter?: string
  }>
  standardDocument: {
    id: string
    name: string
  }
  interpretationMode?: 'basic' | 'detailed' | 'enterprise'
  totalClauseCount?: number // 总条款数量（用于进度显示）
  currentBatchIndex?: number // 当前批次索引（从1开始）
  totalBatches?: number // 总批次数
}

/**
 * 填充批量解读Prompt（两阶段模式 - 阶段2）
 * 将已提取的条款清单分批进行解读
 */
export function fillBatchInterpretationPrompt(
  input: BatchInterpretationInput,
  interpretationMode: 'basic' | 'detailed' | 'enterprise' = 'enterprise',
): string {
  let prompt =
    '你是一名资深IT标准咨询专家，拥有20年企业合规咨询经验。请对以下条款清单进行**逐条完整解读**。\n\n'

  prompt += `**标准名称**：${input.standardDocument.name}\n\n`

  // 批次信息（用于上下文）
  if (input.totalBatches && input.currentBatchIndex) {
    prompt += `**批次信息**：当前第 ${input.currentBatchIndex}/${input.totalBatches} 批\n`
    prompt += `**本批条款数**：${input.clauses.length} 条\n`
    if (input.totalClauseCount) {
      prompt += `**总条款数**：${input.totalClauseCount} 条\n\n`
    } else {
      prompt += '\n'
    }
  }

  prompt += '**待解读条款清单**：\n\n'
  input.clauses.forEach((clause, index) => {
    prompt += `【条款 ${index + 1}】\n`
    prompt += `- **条款编号**：${clause.clause_id}\n`
    if (clause.chapter) {
      prompt += `- **所属章节**：${clause.chapter}\n`
    }
    prompt += `- **条款原文**：\n${clause.clause_full_text}\n\n`
  })

  // 根据模式设置解读深度
  const modeConfig = {
    basic: {
      description: '快速解读模式',
      detailLevel: '简洁明了，重点突出',
    },
    detailed: {
      description: '详细解读模式',
      detailLevel: '全面细致，深入分析',
    },
    enterprise: {
      description: '企业级深度模式',
      detailLevel: '极度详尽，面面俱到',
    },
  }

  const config = modeConfig[interpretationMode]
  prompt += `**解读模式**：${config.description}\n`
  prompt += `**解读深度**：${config.detailLevel}\n\n`

  prompt += '**核心要求**：\n'
  prompt += '1. 【必须】为**上述每个条款**提供完整的解读，不得遗漏任何条款\n'
  prompt += '2. 【必须】保持条款的原始顺序，不要重新排序\n'
  prompt += '3. 【必须】每个条款必须包含以下维度：\n'
  prompt += '   - **What（是什么）**：条款要求的具体内容\n'
  prompt += '   - **Why（为什么）**：条款存在的目的和价值\n'
  prompt += '   - **How（怎么做）**：具体的实施步骤和方法\n'

  if (interpretationMode !== 'basic') {
    prompt += '   - **合规标准**（compliance_criteria）：\n'
    prompt += '     - must_have：必须有的文档/系统/流程\n'
    if (interpretationMode === 'enterprise') {
      prompt += '     - should_have：建议有的内容\n'
    }
    prompt += '     - evidence_required：需要的证据清单\n'
    prompt += '     - assessment_method：如何评估符合性\n'
  }

  if (interpretationMode === 'enterprise') {
    prompt += '   - **风险评估**（risk_assessment）：\n'
    prompt += '     - non_compliance_risks：不合规的风险\n'
    prompt += '     - implementation_risks：实施风险\n'
  }

  prompt += '   - **优先级**（priority）：HIGH/MEDIUM/LOW\n'
  if (interpretationMode !== 'basic') {
    prompt += '   - **预估工期**（estimated_effort）：如"2-4周"\n'
    prompt += '   - **最佳实践**（best_practices）：实施建议\n'
    prompt += '   - **常见错误**（common_mistakes）：避坑指南\n'
  }
  prompt += '\n'

  prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
  prompt += '```json\n'
  prompt += '{\n'
  prompt += '  "key_requirements": [\n'

  // 生成第一个条款的完整示例
  const firstClause = input.clauses[0]
  prompt += '    {\n'
  prompt += `      "clause_id": "${firstClause.clause_id}",\n`
  if (interpretationMode !== 'basic') {
    prompt += `      "chapter": "${firstClause.chapter || 'N/A'}",\n`
    prompt += `      "clause_full_text": "${firstClause.clause_full_text.substring(0, 50)}...",\n`
    prompt += `      "clause_summary": "条款一句话总结",\n`
  }
  prompt += '      "interpretation": {\n'
  prompt += '        "what": "条款要求的具体内容",\n'
  if (interpretationMode !== 'basic') {
    prompt += '        "why": "为什么需要这个条款",\n'
  }
  prompt += '        "how": "如何满足条款要求"\n'
  prompt += '      }'

  if (interpretationMode !== 'basic') {
    prompt += ',\n'
    prompt += '      "compliance_criteria": {\n'
    prompt += '        "must_have": ["必须1", "必须2"],\n'
    if (interpretationMode === 'enterprise') {
      prompt += '        "should_have": ["建议1", "建议2"],\n'
    }
    prompt += '        "evidence_required": ["证据1", "证据2"],\n'
    prompt += '        "assessment_method": "评估方法说明"\n'
    prompt += '      }'
  }

  if (interpretationMode === 'enterprise') {
    prompt += ',\n'
    prompt += '      "risk_assessment": {\n'
    prompt += '        "non_compliance_risks": [{\n'
    prompt += '          "risk": "风险描述",\n'
    prompt += '          "consequence": "后果",\n'
    prompt += '          "probability": "高/中/低",\n'
    prompt += '          "mitigation": "缓解措施"\n'
    prompt += '        }],\n'
    prompt += '        "implementation_risks": [{\n'
    prompt += '          "risk": "实施风险",\n'
    prompt += '          "consequence": "问题",\n'
    prompt += '          "prevention": "预防措施"\n'
    prompt += '        }]\n'
    prompt += '      }'
  }

  prompt += ',\n'
  prompt += '      "priority": "HIGH"'
  if (interpretationMode !== 'basic') {
    prompt += ',\n'
    prompt += '      "estimated_effort": "2-4周",\n'
    prompt += '      "best_practices": ["最佳实践1", "最佳实践2"],\n'
    prompt += '      "common_mistakes": ["常见错误1", "常见错误2"]'
  }
  prompt += '\n    }'

  // 如果有多个条款，添加省略号
  if (input.clauses.length > 1) {
    prompt += ',\n'
    prompt += '    {\n'
    prompt += '      "clause_id": "条款编号2",\n'
    prompt += '      ...\n'
    prompt += '    }\n'
    if (input.clauses.length > 2) {
      prompt += '    // ... 更多条款 ...\n'
    }
  }

  prompt += '  ]\n'
  prompt += '}\n'
  prompt += '```\n\n'

  prompt += '**重要约束**（必须严格遵守）：\n'
  prompt += `1. 【必须】key_requirements数组必须包含上述全部${input.clauses.length}个条款的解读\n`
  prompt += '2. 【必须】严格按照JSON格式输出，不要添加任何JSON之外的文本\n'
  prompt += '3. 【必须】每个clause_id必须与输入中的条款编号完全一致\n'
  prompt += '4. 【必须】所有字段都必须填写，不要留空或使用null\n'
  if (interpretationMode === 'enterprise') {
    prompt += '5. 【必须】提供详细、全面、深入的解读，适合企业级应用\n'
  }
  prompt += '\n'

  prompt += '请按照以上要求，对上述条款清单进行专业解读。'

  return prompt
}

/**
 * 版本比对输入接口
 */
export interface VersionCompareInput {
  oldVersion: {
    id: string
    name: string
    content: string
  }
  newVersion: {
    id: string
    name: string
    content: string
  }
  temperature?: number
  maxTokens?: number
}

/**
 * 填充版本比对Prompt
 */
export function fillVersionComparePrompt(
  oldVersion: { id: string; name: string; content: string },
  newVersion: { id: string; name: string; content: string },
): string {
  let prompt = '你是一名IT标准版本比对专家。请比对两个版本的差异，识别新增、修改、删除的内容。\n\n'

  prompt += '**旧版本**：\n'
  prompt += oldVersion.name + '\n\n'
  prompt += oldVersion.content.substring(0, 8000) + '\n\n'

  prompt += '**新版本**：\n'
  prompt += newVersion.name + '\n\n'
  prompt += newVersion.content.substring(0, 8000) + '\n\n'

  prompt += '**比对要求**：\n'
  prompt += '1. 识别新增的条款（新版本有，旧版本没有）\n'
  prompt += '2. 识别修改的条款（两个版本都有，但内容不同）\n'
  prompt += '3. 识别删除的条款（旧版本有，新版本没有）\n'
  prompt += '4. 分析变更的影响和实施建议\n\n'

  prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
  prompt += '```json\n'
  prompt += '{\n'
  prompt += '  "version_info": {\n'
  prompt += '    "old_version": "旧版本号",\n'
  prompt += '    "new_version": "新版本号",\n'
  prompt += '    "comparison_summary": "总体变化概述"\n'
  prompt += '  },\n'
  prompt += '  "added_clauses": [\n'
  prompt += '    {\n'
  prompt += '      "clause_id": "条款编号",\n'
  prompt += '      "clause_text": "条款内容",\n'
  prompt += '      "impact": "影响说明",\n'
  prompt += '      "action_required": "需要采取的行动"\n'
  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "modified_clauses": [\n'
  prompt += '    {\n'
  prompt += '      "clause_id": "条款编号",\n'
  prompt += '      "old_text": "旧版本文本",\n'
  prompt += '      "new_text": "新版本文本",\n'
  prompt += '      "change_type": "MINOR/MAJOR",\n'
  prompt += '      "impact": "影响说明",\n'
  prompt += '      "migration_guide": "迁移建议"\n'
  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "deleted_clauses": [\n'
  prompt += '    {\n'
  prompt += '      "clause_id": "条款编号",\n'
  prompt += '      "old_text": "旧版本文本",\n'
  prompt += '      "impact": "影响说明",\n'
  prompt += '      "alternative": "替代方案"\n'
  prompt += '    }\n'
  prompt += '  ],\n'
  prompt += '  "statistics": {\n'
  prompt += '    "total_added": 5,\n'
  prompt += '    "total_modified": 12,\n'
  prompt += '    "total_deleted": 3,\n'
  prompt += '    "change_percentage": 0.15\n'
  prompt += '  },\n'
  prompt += '  "migration_recommendations": [\n'
  prompt += '    "迁移建议1",\n'
  prompt += '    "迁移建议2"\n'
  prompt += '  ]\n'
  prompt += '}\n'
  prompt += '```\n\n'

  prompt += '**重要约束**：\n'
  prompt += '1. 严格遵循JSON格式\n'
  prompt += '2. 不要在JSON之外添加任何其他文本\n'
  prompt += '3. change_type使用MINOR/MAJOR\n'
  prompt += '4. migration_recommendations至少包含3条建议\n\n'

  prompt += '请按照以上要求进行版本比对。'

  return prompt
}
