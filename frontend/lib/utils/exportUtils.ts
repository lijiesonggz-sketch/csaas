/**
 * 导出工具函数
 * 支持导出 Excel 和 Word 格式
 */

import * as XLSX from 'xlsx'
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TableOfContents,
  convertInchesToTwip,
  Packer,
} from 'docx'
import { saveAs } from 'file-saver'

/**
 * 导出标准解读结果到 Excel
 */
export function exportStandardInterpretationToExcel(data: any, filename?: string) {
  const workbook = XLSX.utils.book_new()

  // 辅助函数：设置列宽（注意：标准xlsx库不支持写入样式如自动换行）
  const setColumnWidths = (sheet: any, colWidths: number[]) => {
    if (colWidths.length > 0) {
      sheet['!cols'] = colWidths.map(width => ({ wch: width }))
    }
  }

  // 1. 概述 Sheet
  const overviewData = [
    ['概述'],
    ['制定背景', data.overview?.background || ''],
    ['适用范围', data.overview?.scope || ''],
    ['核心目标', (data.overview?.core_objectives || []).join('\n')], // 使用\n手动换行
    ['目标受众', (data.overview?.target_audience || []).join('\n')],
  ]
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)
  setColumnWidths(overviewSheet, [15, 80])
  XLSX.utils.book_append_sheet(workbook, overviewSheet, '概述')

  // 2. 关键术语 Sheet
  const termsData = [
    ['关键术语'],
    ['术语名称', '定义', '详细解释'],
    ...(data.key_terms || []).map((term: any) => [
      term.term,
      term.definition,
      term.explanation,
    ]),
  ]
  const termsSheet = XLSX.utils.aoa_to_sheet(termsData)
  setColumnWidths(termsSheet, [20, 40, 60])
  XLSX.utils.book_append_sheet(workbook, termsSheet, '关键术语')

  // 3. 关键要求 Sheet
  const requirementsData = [
    ['关键要求'],
    [
      '条款编号',
      '条款原文',
      '条款解读',
      '合规标准',
      '优先级',
    ],
    ...(data.key_requirements || []).map((req: any) => {
      // 直接使用 clause_full_text 或 clause_text，避免重复
      let displayContent = ''

      if (req.clause_full_text && req.clause_full_text.trim().length > 0) {
        displayContent = req.clause_full_text.trim()
      } else if (req.clause_text && req.clause_text.trim().length > 0) {
        displayContent = req.clause_text.trim()
      } else if (req.clause_summary && req.clause_summary.trim().length > 0) {
        displayContent = `${req.clause_id} ${req.clause_summary.trim()}`
      } else {
        displayContent = req.clause_id
      }

      // 处理解读：可能是字符串或对象
      let interpretationText = ''
      if (typeof req.interpretation === 'string') {
        interpretationText = req.interpretation
      } else if (typeof req.interpretation === 'object' && req.interpretation !== null) {
        const interp = req.interpretation
        const parts = []
        if (interp.what) parts.push(`是什么:\n${interp.what}`) // 使用\n换行
        if (interp.why) parts.push(`为什么:\n${interp.why}`)
        if (interp.how) parts.push(`怎么做:\n${interp.how}`)
        interpretationText = parts.join('\n\n')
      }

      // 处理 compliance_criteria 的两种类型：string[] 或 ComplianceCriteriaDetail 对象
      let criteriaText = ''
      if (Array.isArray(req.compliance_criteria)) {
        criteriaText = req.compliance_criteria.join('\n') // 使用\n换行
      } else if (typeof req.compliance_criteria === 'object' && req.compliance_criteria !== null) {
        // ComplianceCriteriaDetail 对象类型
        const criteria = req.compliance_criteria
        const parts = []
        if (criteria.must_have && criteria.must_have.length > 0) {
          parts.push(`必须具备:\n${criteria.must_have.join('\n')}`)
        }
        if (criteria.should_have && criteria.should_have.length > 0) {
          parts.push(`建议具备:\n${criteria.should_have.join('\n')}`)
        }
        if (criteria.evidence_required && criteria.evidence_required.length > 0) {
          parts.push(`所需证据:\n${criteria.evidence_required.join('\n')}`)
        }
        if (criteria.assessment_method) {
          parts.push(`评估方法:\n${criteria.assessment_method}`)
        }
        criteriaText = parts.join('\n\n')
      }

      return [
        req.clause_id,
        displayContent,
        interpretationText,
        criteriaText,
        req.priority,
      ]
    }),
  ]
  const requirementsSheet = XLSX.utils.aoa_to_sheet(requirementsData)
  setColumnWidths(requirementsSheet, [12, 60, 50, 50, 10])
  XLSX.utils.book_append_sheet(workbook, requirementsSheet, '关键要求')

  // 4. 实施指引 Sheet
  const implementationData = [
    ['实施指引'],
    ['准备工作', (data.implementation_guidance?.preparation || []).join('\n')],
    [],
    ['实施步骤'],
    ...(data.implementation_guidance?.implementation_steps || []).flatMap(
      (step: any) => [
        [step.phase, (step.steps || []).join('\n')],
        [''],
      ],
    ),
    [],
    ['最佳实践', (data.implementation_guidance?.best_practices || []).join('\n')],
    [],
    ['常见误区', (data.implementation_guidance?.common_pitfalls || []).join('\n')],
    [],
    ['预估时间', data.implementation_guidance?.timeline_estimate || ''],
    [],
    ['所需资源', data.implementation_guidance?.resource_requirements || ''],
  ]
  const implementationSheet = XLSX.utils.aoa_to_sheet(implementationData)
  setColumnWidths(implementationSheet, [20, 80])
  XLSX.utils.book_append_sheet(workbook, implementationSheet, '实施指引')

  // 5. 检查清单 Sheet
  const checklists = data.implementation_guidance?.checklists
  if (checklists) {
    const checklistData = [
      ['检查清单'],
      [],
      ['文档检查清单'],
      ...(checklists.document_checklist || []).map((item: string) => ['•', item]),
      [],
      ['系统检查清单'],
      ...(checklists.system_checklist || []).map((item: string) => ['•', item]),
      [],
      ['流程检查清单'],
      ...(checklists.process_checklist || []).map((item: string) => ['•', item]),
      [],
      ['访谈准备清单'],
      ...(checklists.interview_preparation || []).map((item: string) => ['•', item]),
    ]
    const checklistSheet = XLSX.utils.aoa_to_sheet(checklistData)
    setColumnWidths(checklistSheet, [5, 80])
    XLSX.utils.book_append_sheet(workbook, checklistSheet, '检查清单')
  }

  // 6. 证据模板 Sheet
  if (Array.isArray(data.implementation_guidance?.evidence_templates) && data.implementation_guidance.evidence_templates.length > 0) {
    const evidenceData = [
      ['证据模板'],
      ['条款', '证据类型', '说明', '参考示例'],
      ...data.implementation_guidance.evidence_templates.map((template: any) => [
        template.clause || '未指定',
        template.evidence_type || '无',
        template.description || '无',
        template.sample_reference || '无',
      ]),
    ]
    const evidenceSheet = XLSX.utils.aoa_to_sheet(evidenceData)
    setColumnWidths(evidenceSheet, [15, 20, 50, 50])
    XLSX.utils.book_append_sheet(workbook, evidenceSheet, '证据模板')
  }

  // 7. 风险矩阵 Sheet
  if (data.risk_matrix) {
    const riskData = [
      ['风险矩阵'],
      [],
      ['高风险条款'],
      ...(data.risk_matrix.high_risk_clauses || []).map((clause: string) => ['•', clause]),
      [],
      ['常见失败点'],
      ['条款', '失败点', '后果', '缓解措施'],
      ...(data.risk_matrix.common_failures || []).map((failure: any) => [
        failure.clause || '未指定',
        failure.failure_point || '无',
        failure.consequence || '无',
        failure.mitigation || '无',
      ]),
      [],
      ['审核关注点'],
      ...(data.risk_matrix.audit_focus_areas || []).map((area: string) => ['•', area]),
    ]
    const riskSheet = XLSX.utils.aoa_to_sheet(riskData)
    setColumnWidths(riskSheet, [5, 60, 40, 40, 40])
    XLSX.utils.book_append_sheet(workbook, riskSheet, '风险矩阵')
  }

  // 8. 实施路径规划 Sheet
  if (data.implementation_roadmap) {
    const roadmapData = [
      ['实施路径规划'],
      ['阶段', '阶段名称', '时间周期', '重点', '涉及条款', '交付物'],
      ...(data.implementation_roadmap.phase_1_foundation ? [[
        '1',
        data.implementation_roadmap.phase_1_foundation.name || '',
        data.implementation_roadmap.phase_1_foundation.duration || '',
        data.implementation_roadmap.phase_1_foundation.focus || '',
        (data.implementation_roadmap.phase_1_foundation.clauses || []).join('\n') || '',
        (data.implementation_roadmap.phase_1_foundation.deliverables || []).join('\n') || '',
      ]] : []),
      ...(data.implementation_roadmap.phase_2_digitalization ? [[
        '2',
        data.implementation_roadmap.phase_2_digitalization.name || '',
        data.implementation_roadmap.phase_2_digitalization.duration || '',
        data.implementation_roadmap.phase_2_digitalization.focus || '',
        (data.implementation_roadmap.phase_2_digitalization.clauses || []).join('\n') || '',
        (data.implementation_roadmap.phase_2_digitalization.deliverables || []).join('\n') || '',
      ]] : []),
      ...(data.implementation_roadmap.phase_3_automation ? [[
        '3',
        data.implementation_roadmap.phase_3_automation.name || '',
        data.implementation_roadmap.phase_3_automation.duration || '',
        data.implementation_roadmap.phase_3_automation.focus || '',
        (data.implementation_roadmap.phase_3_automation.clauses || []).join('\n') || '',
        (data.implementation_roadmap.phase_3_automation.deliverables || []).join('\n') || '',
      ]] : []),
      ...(data.implementation_roadmap.phase_4_optimization ? [[
        '4',
        data.implementation_roadmap.phase_4_optimization.name || '',
        data.implementation_roadmap.phase_4_optimization.duration || '',
        data.implementation_roadmap.phase_4_optimization.focus || '',
        (data.implementation_roadmap.phase_4_optimization.clauses || []).join('\n') || '',
        (data.implementation_roadmap.phase_4_optimization.deliverables || []).join('\n') || '',
      ]] : []),
    ]
    const roadmapSheet = XLSX.utils.aoa_to_sheet(roadmapData)
    setColumnWidths(roadmapSheet, [8, 25, 15, 40, 40, 60])
    XLSX.utils.book_append_sheet(workbook, roadmapSheet, '实施路径规划')
  }

  // 生成文件并下载
  XLSX.writeFile(workbook, filename || '标准解读.xlsx')
}

/**
 * 导出标准解读结果到 Word
 */
export async function exportStandardInterpretationToWord(
  data: any,
  filename?: string,
) {
  // 创建段落辅助函数，统一字体大小
  const createParagraph = (text: string, options?: {
    bold?: boolean
    heading?: HeadingLevel
    alignment?: AlignmentType
    size?: number
  }) => {
    return new Paragraph({
      text,
      ...options,
      children: options ? [new TextRun({
        text,
        bold: options?.bold,
        size: options?.size || 24, // 统一使用24磅（12pt）
      })] : undefined,
    })
  }

  const createParagraphWithRuns = (runs: {
    text: string
    bold?: boolean
    size?: number
    color?: string
  }[], options?: {
    spacing?: { before?: number; after?: number }
    indent?: { firstLine?: number }
  }) => {
    return new Paragraph({
      children: runs.map(run => new TextRun({
        text: run.text,
        bold: run.bold || false,
        size: run.size || 24, // 统一使用24磅（12pt）
        color: run.color,
      })),
      ...options,
    })
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: '标准解读报告',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),

          // 概述
          new Paragraph({
            text: '一、概述',
            heading: HeadingLevel.HEADING_2,
          }),
          createParagraphWithRuns([
            { text: '制定背景：', bold: true },
            { text: data.overview?.background || '无' },
          ]),
          createParagraphWithRuns([
            { text: '适用范围：', bold: true },
            { text: data.overview?.scope || '无' },
          ]),
          createParagraphWithRuns([
            { text: '核心目标：', bold: true },
            { text: (data.overview?.core_objectives || []).join('; ') || '无' },
          ]),
          createParagraphWithRuns([
            { text: '目标受众：', bold: true },
            { text: (data.overview?.target_audience || []).join('; ') || '无' },
          ]),

          // 关键术语
          new Paragraph({
            text: '二、关键术语',
            heading: HeadingLevel.HEADING_2,
          }),
          ...(data.key_terms || []).map(
            (term: any) => createParagraphWithRuns([
              { text: `${term.term}：`, bold: true },
              { text: term.definition || '无定义' },
            ]),
          ),

          // 关键要求
          new Paragraph({
            text: '三、关键要求',
            heading: HeadingLevel.HEADING_2,
          }),
          // 将每个条款的所有内容聚合在一起
          ...(data.key_requirements || []).flatMap((req: any) => {
            // 直接使用 clause_full_text 或 clause_text，它们通常已包含完整信息
            // 如果这两个字段为空，才使用 clause_id + clause_summary
            let clauseDisplay = ''
            let clauseContent = ''

            if (req.clause_full_text && req.clause_full_text.trim().length > 0) {
              // clause_full_text 通常已包含条款ID和完整内容
              clauseDisplay = req.clause_full_text.trim()
              clauseContent = clauseDisplay // 用于后续判断
            } else if (req.clause_text && req.clause_text.trim().length > 0) {
              clauseDisplay = req.clause_text.trim()
              clauseContent = clauseDisplay
            } else if (req.clause_summary && req.clause_summary.trim().length > 0) {
              // clause_summary 可能不包含条款ID，需要拼接
              clauseDisplay = `${req.clause_id} ${req.clause_summary.trim()}`
              clauseContent = req.clause_summary.trim()
            } else {
              // 兜底：只显示条款ID
              clauseDisplay = req.clause_id
              clauseContent = ''
            }

            // 处理 interpretation 字段（可能是字符串或对象）
            let interpretationText = ''
            if (typeof req.interpretation === 'string') {
              interpretationText = req.interpretation
            } else if (typeof req.interpretation === 'object' && req.interpretation !== null) {
              const interp = req.interpretation
              const parts = []
              if (interp.what) parts.push(`是什么：${interp.what}`)
              if (interp.why) parts.push(`为什么：${interp.why}`)
              if (interp.how) parts.push(`怎么做：${interp.how}`)
              interpretationText = parts.join('\n')
            }

            // 处理 compliance_criteria 的两种类型：string[] 或 ComplianceCriteriaDetail 对象
            let criteriaText = ''
            if (Array.isArray(req.compliance_criteria)) {
              criteriaText = req.compliance_criteria.join('; ')
            } else if (typeof req.compliance_criteria === 'object' && req.compliance_criteria !== null) {
              // ComplianceCriteriaDetail 对象类型
              const criteria = req.compliance_criteria
              const parts = []
              if (criteria.must_have && criteria.must_have.length > 0) {
                parts.push(`必须具备: ${criteria.must_have.join('; ')}`)
              }
              if (criteria.should_have && criteria.should_have.length > 0) {
                parts.push(`建议具备: ${criteria.should_have.join('; ')}`)
              }
              if (criteria.evidence_required && criteria.evidence_required.length > 0) {
                parts.push(`所需证据: ${criteria.evidence_required.join('; ')}`)
              }
              if (criteria.assessment_method) {
                parts.push(`评估方法: ${criteria.assessment_method}`)
              }
              criteriaText = parts.join('\n')
            }

            // 返回该条款的所有内容段落，聚合在一起
            return [
              // 条款标题（只有条款ID加粗，内容不加粗）
              new Paragraph({
                children: [
                  new TextRun({
                    text: clauseDisplay,
                    bold: false, // 条款内容不加粗
                    size: 24, // 统一24磅
                  }),
                  new TextRun({
                    text: ` [${req.priority || '中'}]`,
                    color: 'FF0000', // 红色
                    bold: true, // 优先级标签加粗
                    size: 24,
                  }),
                ],
                spacing: { before: 200, after: 100 },
              }),
              // 解读
              new Paragraph({
                children: [
                  new TextRun({
                    text: '解读：',
                    bold: true,
                    size: 24,
                  }),
                  new TextRun({
                    text: interpretationText || '无解读',
                    bold: false,
                    size: 24,
                  }),
                ],
                indent: { firstLine: 200 },
              }),
              // 合规标准
              new Paragraph({
                children: [
                  new TextRun({
                    text: '合规标准：',
                    bold: true,
                    size: 24,
                  }),
                  new TextRun({
                    text: criteriaText || '无',
                    bold: false,
                    size: 24,
                  }),
                ],
                indent: { firstLine: 200 },
                spacing: { after: 200 },
              }),
            ]
          }),

          // 实施指引
          new Paragraph({
            text: '四、实施指引',
            heading: HeadingLevel.HEADING_2,
          }),
          createParagraphWithRuns([
            { text: '准备工作：', bold: true },
            { text: (data.implementation_guidance?.preparation || []).join('\n') || '无' },
          ]),
          new Paragraph({
            text: '实施步骤',
            heading: HeadingLevel.HEADING_3,
          }),
          ...(data.implementation_guidance?.implementation_steps || []).flatMap(
            (step: any) => [
              createParagraphWithRuns([
                { text: step.phase, bold: true },
              ]),
              ...step.steps.map((s: string) => new Paragraph({
                children: [new TextRun({ text: `  • ${s}`, size: 24 })],
              })),
            ],
          ),
          createParagraphWithRuns([
            { text: '最佳实践：', bold: true },
            { text: (data.implementation_guidance?.best_practices || []).join('\n') || '无' },
          ]),
          createParagraphWithRuns([
            { text: '常见误区：', bold: true },
            { text: (data.implementation_guidance?.common_pitfalls || []).join('\n') || '无' },
          ]),
          createParagraphWithRuns([
            { text: '预估时间：', bold: true },
            { text: data.implementation_guidance?.timeline_estimate || '无' },
          ]),
          createParagraphWithRuns([
            { text: '所需资源：', bold: true },
            { text: data.implementation_guidance?.resource_requirements || '无' },
          ]),

          // 检查清单 (来自 implementation_guidance.checklists)
          new Paragraph({
            text: '五、检查清单',
            heading: HeadingLevel.HEADING_2,
          }),
          // 文档检查清单
          createParagraphWithRuns([{ text: '文档检查清单：', bold: true }]),
          ...(data.implementation_guidance?.checklists?.document_checklist || []).map((item: string) =>
            createParagraphWithRuns([{ text: `  • ${item}` }]),
          ),
          // 系统检查清单
          createParagraphWithRuns([{ text: '系统检查清单：', bold: true }], { spacing: { before: 100 } }),
          ...(data.implementation_guidance?.checklists?.system_checklist || []).map((item: string) =>
            createParagraphWithRuns([{ text: `  • ${item}` }]),
          ),
          // 流程检查清单
          createParagraphWithRuns([{ text: '流程检查清单：', bold: true }], { spacing: { before: 100 } }),
          ...(data.implementation_guidance?.checklists?.process_checklist || []).map((item: string) =>
            createParagraphWithRuns([{ text: `  • ${item}` }]),
          ),
          // 访谈准备清单
          createParagraphWithRuns([{ text: '访谈准备清单：', bold: true }], { spacing: { before: 100 } }),
          ...(data.implementation_guidance?.checklists?.interview_preparation || []).map((item: string) =>
            createParagraphWithRuns([{ text: `  • ${item}` }]),
          ),

          // 证据模板 (来自 implementation_guidance.evidence_templates)
          new Paragraph({
            text: '六、证据模板',
            heading: HeadingLevel.HEADING_2,
          }),
          ...(data.implementation_guidance?.evidence_templates || []).map((template: any) => [
            createParagraphWithRuns([
              { text: `条款：${template.clause || '未指定'}`, bold: true },
            ], { spacing: { before: 100 } }),
            createParagraphWithRuns([
              { text: `  证据类型：${template.evidence_type || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  说明：${template.description || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  参考示例：${template.sample_reference || '无'}` },
            ], { spacing: { after: 100 } }),
          ]).flat(),

          // 风险矩阵 (顶级字段 risk_matrix)
          new Paragraph({
            text: '七、风险矩阵',
            heading: HeadingLevel.HEADING_2,
          }),
          // 高风险条款
          createParagraphWithRuns([{ text: '高风险条款：', bold: true }]),
          ...(data.risk_matrix?.high_risk_clauses || []).map((clause: string) =>
            createParagraphWithRuns([{ text: `  • ${clause}` }]),
          ),
          // 常见失败点
          createParagraphWithRuns([{ text: '常见失败点：', bold: true }], { spacing: { before: 100 } }),
          ...(data.risk_matrix?.common_failures || []).map((failure: any) => [
            createParagraphWithRuns([
              { text: `  条款：${failure.clause || '未指定'}`, bold: true },
            ], { spacing: { before: 50 } }),
            createParagraphWithRuns([{ text: `    失败点：${failure.failure_point || '无'}` }]),
            createParagraphWithRuns([{ text: `    后果：${failure.consequence || '无'}` }]),
            createParagraphWithRuns([{ text: `    缓解措施：${failure.mitigation || '无'}` }], { spacing: { after: 100 } }),
          ]).flat(),
          // 审核关注点
          createParagraphWithRuns([{ text: '审核关注点：', bold: true }], { spacing: { before: 100 } }),
          ...(data.risk_matrix?.audit_focus_areas || []).map((area: string) =>
            createParagraphWithRuns([{ text: `  • ${area}` }]),
          ),

          // 实施路径规划 (顶级字段 implementation_roadmap)
          new Paragraph({
            text: '八、实施路径规划',
            heading: HeadingLevel.HEADING_2,
          }),
          // 阶段1
          ...(data.implementation_roadmap?.phase_1_foundation ? [
            createParagraphWithRuns([
              { text: '阶段1：', bold: true },
              { text: data.implementation_roadmap.phase_1_foundation.name || '', bold: false },
            ], { spacing: { before: 100 } }),
            createParagraphWithRuns([
              { text: `  时长：${data.implementation_roadmap.phase_1_foundation.duration || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  重点：${data.implementation_roadmap.phase_1_foundation.focus || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  涉及条款：${(data.implementation_roadmap.phase_1_foundation.clauses || []).join(', ') || '无'}` },
            ]),
            createParagraphWithRuns([{ text: '  交付物：', bold: true }]),
            ...(data.implementation_roadmap.phase_1_foundation.deliverables || []).map((item: string) =>
              createParagraphWithRuns([{ text: `    • ${item}` }]),
            ),
          ] : []),
          // 阶段2
          ...(data.implementation_roadmap?.phase_2_digitalization ? [
            createParagraphWithRuns([
              { text: '阶段2：', bold: true },
              { text: data.implementation_roadmap.phase_2_digitalization.name || '', bold: false },
            ], { spacing: { before: 100 } }),
            createParagraphWithRuns([
              { text: `  时长：${data.implementation_roadmap.phase_2_digitalization.duration || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  重点：${data.implementation_roadmap.phase_2_digitalization.focus || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  涉及条款：${(data.implementation_roadmap.phase_2_digitalization.clauses || []).join(', ') || '无'}` },
            ]),
            createParagraphWithRuns([{ text: '  交付物：', bold: true }]),
            ...(data.implementation_roadmap.phase_2_digitalization.deliverables || []).map((item: string) =>
              createParagraphWithRuns([{ text: `    • ${item}` }]),
            ),
          ] : []),
          // 阶段3
          ...(data.implementation_roadmap?.phase_3_automation ? [
            createParagraphWithRuns([
              { text: '阶段3：', bold: true },
              { text: data.implementation_roadmap.phase_3_automation.name || '', bold: false },
            ], { spacing: { before: 100 } }),
            createParagraphWithRuns([
              { text: `  时长：${data.implementation_roadmap.phase_3_automation.duration || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  重点：${data.implementation_roadmap.phase_3_automation.focus || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  涉及条款：${(data.implementation_roadmap.phase_3_automation.clauses || []).join(', ') || '无'}` },
            ]),
            createParagraphWithRuns([{ text: '  交付物：', bold: true }]),
            ...(data.implementation_roadmap.phase_3_automation.deliverables || []).map((item: string) =>
              createParagraphWithRuns([{ text: `    • ${item}` }]),
            ),
          ] : []),
          // 阶段4
          ...(data.implementation_roadmap?.phase_4_optimization ? [
            createParagraphWithRuns([
              { text: '阶段4：', bold: true },
              { text: data.implementation_roadmap.phase_4_optimization.name || '', bold: false },
            ], { spacing: { before: 100 } }),
            createParagraphWithRuns([
              { text: `  时长：${data.implementation_roadmap.phase_4_optimization.duration || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  重点：${data.implementation_roadmap.phase_4_optimization.focus || '无'}` },
            ]),
            createParagraphWithRuns([
              { text: `  涉及条款：${(data.implementation_roadmap.phase_4_optimization.clauses || []).join(', ') || '无'}` },
            ]),
            createParagraphWithRuns([{ text: '  交付物：', bold: true }]),
            ...(data.implementation_roadmap.phase_4_optimization.deliverables || []).map((item: string) =>
              createParagraphWithRuns([{ text: `    • ${item}` }]),
            ),
          ] : []),
        ],
      },
    ],
  })

  // 生成 Blob 并下载
  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename || '标准解读.docx')
}

/**
 * 导出关联标准搜索结果到 Excel
 */
export function exportRelatedStandardsToExcel(data: any, filename?: string) {
  const workbook = XLSX.utils.book_new()

  // 关联标准列表
  const standardsData = [
    ['关联标准列表'],
    [
      '条款编号',
      '条款内容',
      '标准编号',
      '标准名称',
      '关联类型',
      '相关度',
      '关联说明',
    ],
    ...(data.related_standards || []).flatMap((clause: any) =>
      (clause.related_standards || []).map((std: any) => [
        clause.clause_id,
        clause.clause_text,
        std.standard_code,
        std.standard_name,
        std.relation_type,
        std.relevance_score,
        std.description,
      ]),
    ),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(standardsData)
  XLSX.utils.book_append_sheet(workbook, sheet, '关联标准')

  // 汇总信息
  if (data.summary) {
    const summaryData = [
      ['汇总信息'],
      ['总关联标准数', data.summary.total_related_standards],
      ['国家标准数', data.summary.national_standards_count],
      ['行业标准数', data.summary.industry_standards_count],
      [''],
      ['关联最多的条款', ...(data.summary.top_relations || [])],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总')
  }

  XLSX.writeFile(workbook, filename || '关联标准搜索.xlsx')
}

/**
 * 导出关联标准搜索结果到 Word
 */
export async function exportRelatedStandardsToWord(
  data: any,
  filename?: string,
) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: '关联标准搜索报告',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),

          // 汇总信息
          new Paragraph({
            text: '一、汇总信息',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '总关联标准数：',
                bold: true,
              }),
              new TextRun(`${data.summary?.total_related_standards || 0}`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '国家标准数：',
                bold: true,
              }),
              new TextRun(`${data.summary?.national_standards_count || 0}`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '行业标准数：',
                bold: true,
              }),
              new TextRun(`${data.summary?.industry_standards_count || 0}`),
            ],
          }),

          // 关联标准详情
          new Paragraph({
            text: '二、关联标准详情',
            heading: HeadingLevel.HEADING_2,
          }),
          ...(data.related_standards || []).flatMap((clause: any) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${clause.clause_id} - ${clause.clause_text}`,
                  bold: true,
                }),
              ],
            }),
            ...(clause.related_standards || []).flatMap((std: any) => {
              const relationTypeLabels: Record<string, string> = {
                REFERENCE: '引用',
                SUPPLEMENT: '补充',
                CONFLICT: '冲突',
                SYNERGY: '协同',
              }
              return [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${std.standard_code} - ${std.standard_name}`,
                      bold: true,
                    }),
                    new TextRun(` [${relationTypeLabels[std.relation_type] || std.relation_type}]`),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '相关度：',
                      bold: true,
                    }),
                    new TextRun(`${(std.relevance_score * 100).toFixed(0)}%`),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '说明：',
                      bold: true,
                    }),
                    new TextRun(std.description),
                  ],
                }),
                new Paragraph(''), // 空行分隔
              ]
            }),
          ]),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename || '关联标准搜索.docx')
}

/**
 * 导出版本比对结果到 Excel
 */
export function exportVersionCompareToExcel(data: any, filename?: string) {
  const workbook = XLSX.utils.book_new()

  // 版本信息
  const versionInfo = [
    ['版本信息'],
    ['旧版本', data.version_info?.old_version || ''],
    ['新版本', data.version_info?.new_version || ''],
    ['总体变化概述', data.version_info?.comparison_summary || ''],
    [],
    ['统计信息'],
    ['新增条款数', data.statistics?.total_added || 0],
    ['修改条款数', data.statistics?.total_modified || 0],
    ['删除条款数', data.statistics?.total_deleted || 0],
    ['变化比例', `${((data.statistics?.change_percentage || 0) * 100).toFixed(1)}%`],
  ]
  const infoSheet = XLSX.utils.aoa_to_sheet(versionInfo)
  XLSX.utils.book_append_sheet(workbook, infoSheet, '版本信息')

  // 新增条款
  if (data.added_clauses && data.added_clauses.length > 0) {
    const addedData = [
      ['新增条款'],
      ['条款编号', '条款内容', '影响', '需要采取的行动'],
      ...data.added_clauses.map((clause: any) => [
        clause.clause_id,
        clause.clause_text,
        clause.impact,
        clause.action_required,
      ]),
    ]
    const addedSheet = XLSX.utils.aoa_to_sheet(addedData)
    XLSX.utils.book_append_sheet(workbook, addedSheet, '新增条款')
  }

  // 修改条款
  if (data.modified_clauses && data.modified_clauses.length > 0) {
    const modifiedData = [
      ['修改条款'],
      [
        '条款编号',
        '旧版本文本',
        '新版本文本',
        '变更类型',
        '影响',
        '迁移建议',
      ],
      ...data.modified_clauses.map((clause: any) => [
        clause.clause_id,
        clause.old_text,
        clause.new_text,
        clause.change_type,
        clause.impact,
        clause.migration_guide,
      ]),
    ]
    const modifiedSheet = XLSX.utils.aoa_to_sheet(modifiedData)
    XLSX.utils.book_append_sheet(workbook, modifiedSheet, '修改条款')
  }

  // 删除条款
  if (data.deleted_clauses && data.deleted_clauses.length > 0) {
    const deletedData = [
      ['删除条款'],
      ['条款编号', '旧版本文本', '影响', '替代方案'],
      ...data.deleted_clauses.map((clause: any) => [
        clause.clause_id,
        clause.old_text,
        clause.impact,
        clause.alternative,
      ]),
    ]
    const deletedSheet = XLSX.utils.aoa_to_sheet(deletedData)
    XLSX.utils.book_append_sheet(workbook, deletedSheet, '删除条款')
  }

  // 迁移建议
  if (data.migration_recommendations && data.migration_recommendations.length > 0) {
    const migrationData = [
      ['迁移建议'],
      ...data.migration_recommendations.map((rec: string, i: number) => [i + 1, rec]),
    ]
    const migrationSheet = XLSX.utils.aoa_to_sheet(migrationData)
    XLSX.utils.book_append_sheet(workbook, migrationSheet, '迁移建议')
  }

  XLSX.writeFile(workbook, filename || '版本比对.xlsx')
}

/**
 * 导出版本比对结果到 Word
 */
export async function exportVersionCompareToWord(data: any, filename?: string) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: '标准版本比对报告',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),

          // 版本信息
          new Paragraph({
            text: '一、版本信息',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '旧版本：',
                bold: true,
              }),
              new TextRun(data.version_info?.old_version || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '新版本：',
                bold: true,
              }),
              new TextRun(data.version_info?.new_version || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '总体变化概述：',
                bold: true,
              }),
              new TextRun(data.version_info?.comparison_summary || ''),
            ],
          }),

          // 统计信息
          new Paragraph({
            text: '二、统计信息',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '新增条款：',
                bold: true,
              }),
              new TextRun(`${data.statistics?.total_added || 0} 条`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '修改条款：',
                bold: true,
              }),
              new TextRun(`${data.statistics?.total_modified || 0} 条`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '删除条款：',
                bold: true,
              }),
              new TextRun(`${data.statistics?.total_deleted || 0} 条`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '变化比例：',
                bold: true,
              }),
              new TextRun(`${((data.statistics?.change_percentage || 0) * 100).toFixed(1)}%`),
            ],
          }),

          // 新增条款
          ...(data.added_clauses && data.added_clauses.length > 0
            ? [
                new Paragraph({
                  text: '三、新增条款',
                  heading: HeadingLevel.HEADING_2,
                }),
                ...data.added_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${clause.clause_id} - ${clause.clause_text}`,
                          bold: true,
                        }),
                      ],
                    }),
                ),
                ...data.added_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '影响：',
                          bold: true,
                        }),
                        new TextRun(clause.impact),
                      ],
                    }),
                ),
                ...data.added_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '行动要求：',
                          bold: true,
                        }),
                        new TextRun(clause.action_required),
                      ],
                    }),
                ),
                new Paragraph(''),
              ]
            : []),

          // 修改条款
          ...(data.modified_clauses && data.modified_clauses.length > 0
            ? [
                new Paragraph({
                  text: '四、修改条款',
                  heading: HeadingLevel.HEADING_2,
                }),
                ...data.modified_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${clause.clause_id} - ${clause.change_type}`,
                          bold: true,
                          color: clause.change_type === 'MAJOR' ? 'FF0000' : 'FFA500',
                        }),
                      ],
                    }),
                ),
                ...data.modified_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '旧版本：',
                          bold: true,
                        }),
                        new TextRun(clause.old_text),
                      ],
                    }),
                ),
                ...data.modified_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '新版本：',
                          bold: true,
                        }),
                        new TextRun(clause.new_text),
                      ],
                    }),
                ),
                ...data.modified_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '影响：',
                          bold: true,
                        }),
                        new TextRun(clause.impact),
                      ],
                    }),
                ),
                ...data.modified_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '迁移建议：',
                          bold: true,
                        }),
                        new TextRun(clause.migration_guide),
                      ],
                    }),
                ),
                new Paragraph(''),
              ]
            : []),

          // 删除条款
          ...(data.deleted_clauses && data.deleted_clauses.length > 0
            ? [
                new Paragraph({
                  text: '五、删除条款',
                  heading: HeadingLevel.HEADING_2,
                }),
                ...data.deleted_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: clause.clause_id,
                          bold: true,
                        }),
                      ],
                    }),
                ),
                ...data.deleted_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '内容：',
                          bold: true,
                        }),
                        new TextRun(clause.old_text),
                      ],
                    }),
                ),
                ...data.deleted_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '影响：',
                          bold: true,
                        }),
                        new TextRun(clause.impact),
                      ],
                    }),
                ),
                ...data.deleted_clauses.map(
                  (clause: any) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '替代方案：',
                          bold: true,
                        }),
                        new TextRun(clause.alternative),
                      ],
                    }),
                ),
                new Paragraph(''),
              ]
            : []),

          // 迁移建议
          ...(data.migration_recommendations && data.migration_recommendations.length > 0
            ? [
                new Paragraph({
                  text: '六、迁移建议',
                  heading: HeadingLevel.HEADING_2,
                }),
                ...data.migration_recommendations.map(
                  (rec: string, i: number) =>
                    new Paragraph(`${i + 1}. ${rec}`),
                ),
              ]
            : []),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename || '版本比对.docx')
}
