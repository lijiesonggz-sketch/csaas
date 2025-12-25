/**
 * 综述生成Prompt模板
 */
export const SUMMARY_GENERATION_PROMPT = `
你是一名资深IT咨询师，专注于IT标准的成熟度评估。请对以下IT标准文档进行综述（2-3页摘要）。

**输入标准文档**：
{{STANDARD_DOCUMENT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式，包含以下字段：
   {
     "title": "标准名称",
     "overview": "标准总体描述（200-300字）",
     "key_areas": [
       {
         "name": "关键领域1",
         "description": "描述（50-100字）",
         "importance": "HIGH/MEDIUM/LOW"
       },
       {
         "name": "关键领域2",
         "description": "描述",
         "importance": "HIGH/MEDIUM/LOW"
       }
     ],
     "scope": "标准适用范围",
     "key_requirements": [
       "核心要求1",
       "核心要求2"
     ],
     "compliance_level": "合规级别说明"
   }

2. **内容要求**：
   - 提炼标准的核心目标和价值主张
   - 识别5-8个关键领域（如：信息安全策略、访问控制、业务连续性等）
   - 每个关键领域包含简短描述（50-100字）和重要性评级
   - 核心要求不超过10条，每条不超过50字
   - 合规级别说明应明确（如：强制性、推荐性、可选性）

3. **风格要求**：
   - 使用专业术语，面向IT专业人士
   - 简洁明了，避免冗余
   - 保持中立客观，不加主观评价
   - 使用中文输出

**注意**：请严格输出JSON格式，不要包含任何额外的解释、注释或markdown代码块标记。
`.trim()

/**
 * 替换模板中的变量
 */
export function fillSummaryPrompt(standardDocument: string): string {
  return SUMMARY_GENERATION_PROMPT.replace('{{STANDARD_DOCUMENT}}', standardDocument)
}

/**
 * Few-Shot示例（可选，用于提高输出质量）
 */
export const SUMMARY_FEW_SHOT_EXAMPLES = [
  {
    input: 'ISO 27001标准文档摘录...',
    output: {
      title: 'ISO/IEC 27001:2013 信息安全管理体系要求',
      overview:
        'ISO 27001是国际标准化组织（ISO）发布的信息安全管理体系（ISMS）标准...',
      key_areas: [
        {
          name: '信息安全策略',
          description: '制定、审查和维护信息安全策略，确保与业务目标一致...',
          importance: 'HIGH',
        },
      ],
      scope: '适用于所有类型和规模的组织',
      key_requirements: [
        '建立和维护信息安全管理体系',
        '识别和评估信息安全风险',
      ],
      compliance_level: '强制性（ISO认证要求）',
    },
  },
]
