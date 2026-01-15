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

  // 1. 概述 Sheet
  const overviewData = [
    ['概述'],
    ['制定背景', data.overview?.background || ''],
    ['适用范围', data.overview?.scope || ''],
    ['核心目标', (data.overview?.core_objectives || []).join('; ')],
    ['目标受众', (data.overview?.target_audience || []).join('; ')],
  ]
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)
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
    ...(data.key_requirements || []).map((req: any) => [
      req.clause_id,
      req.clause_text,
      req.interpretation,
      (req.compliance_criteria || []).join('; '),
      req.priority,
    ]),
  ]
  const requirementsSheet = XLSX.utils.aoa_to_sheet(requirementsData)
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
        [''], // 空行分隔
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
  XLSX.utils.book_append_sheet(workbook, implementationSheet, '实施指引')

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
          new Paragraph({
            children: [
              new TextRun({
                text: '制定背景：',
                bold: true,
              }),
              new TextRun(data.overview?.background || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '适用范围：',
                bold: true,
              }),
              new TextRun(data.overview?.scope || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '核心目标：',
                bold: true,
              }),
              new TextRun((data.overview?.core_objectives || []).join('; ')),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '目标受众：',
                bold: true,
              }),
              new TextRun((data.overview?.target_audience || []).join('; ')),
            ],
          }),

          // 关键术语
          new Paragraph({
            text: '二、关键术语',
            heading: HeadingLevel.HEADING_2,
          }),
          ...(data.key_terms || []).map(
            (term: any) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${term.term}：`,
                    bold: true,
                  }),
                  new TextRun(term.definition),
                ],
              }),
          ),

          // 关键要求
          new Paragraph({
            text: '三、关键要求',
            heading: HeadingLevel.HEADING_2,
          }),
          ...(data.key_requirements || []).map(
            (req: any) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${req.clause_id} ${req.clause_text}`,
                    bold: true,
                  }),
                  new TextRun({
                    text: ` [${req.priority}]`,
                    color: 'FF0000',
                  }),
                ],
              }),
          ),
          ...(data.key_requirements || []).map(
            (req: any) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: '解读：',
                    bold: true,
                  }),
                  new TextRun(req.interpretation),
                ],
              }),
          ),
          ...(data.key_requirements || []).map(
            (req: any) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: '合规标准：',
                    bold: true,
                  }),
                  new TextRun((req.compliance_criteria || []).join('; ')),
                ],
              }),
          ),

          // 实施指引
          new Paragraph({
            text: '四、实施指引',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '准备工作：',
                bold: true,
              }),
              new TextRun((data.implementation_guidance?.preparation || []).join('\n')),
            ],
          }),
          new Paragraph({
            text: '实施步骤',
            heading: HeadingLevel.HEADING_3,
          }),
          ...(data.implementation_guidance?.implementation_steps || []).flatMap(
            (step: any) => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: step.phase,
                    bold: true,
                  }),
                ],
              }),
              ...step.steps.map((s: string) => new Paragraph(`  • ${s}`)),
            ],
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: '最佳实践：',
                bold: true,
              }),
              new TextRun((data.implementation_guidance?.best_practices || []).join('\n')),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '常见误区：',
                bold: true,
              }),
              new TextRun((data.implementation_guidance?.common_pitfalls || []).join('\n')),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '预估时间：',
                bold: true,
              }),
              new TextRun(data.implementation_guidance?.timeline_estimate || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '所需资源：',
                bold: true,
              }),
              new TextRun(data.implementation_guidance?.resource_requirements || ''),
            ],
          }),
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
