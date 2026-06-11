/**
 * 多标准交叉分析 Prompt
 * 主题关系判定（冲突/重叠/互补）+ 就高基线生成
 */

export interface ThemeForAnalysis {
  theme_id: string
  theme_name: string
  requirements_by_document: Array<{
    document_id: string
    document_name: string
    clauses: Array<{ clause_id: string; clause_text: string }>
  }>
}

function truncateText(text: string, maxLength = 600): string {
  if (!text || text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}…`
}

/**
 * 主题关系批量分析 prompt
 */
export function fillThemeRelationBatchPrompt(
  themes: ThemeForAnalysis[],
  documentNames: string[],
): string {
  let prompt =
    '你是一名企业合规专家，正在分析多个监管机构发布的标准/管理办法对同一主题的要求差异。\n\n'
  prompt += `**涉及标准**：${documentNames.join('、')}\n\n`
  prompt += '以下每个主题列出了各标准的相关条款，请逐主题判定要求之间的关系并生成统一执行基线。\n\n'

  themes.forEach((theme, index) => {
    prompt += `【主题 ${index + 1}】theme_id: ${theme.theme_id}，主题名称：${theme.theme_name}\n`
    theme.requirements_by_document.forEach((docReq) => {
      prompt += `- 《${docReq.document_name}》：\n`
      docReq.clauses.forEach((clause) => {
        prompt += `  - ${clause.clause_id}：${truncateText(clause.clause_text)}\n`
      })
    })
    prompt += '\n'
  })

  prompt += '**关系判定标准**：\n'
  prompt += '- CONFLICT（冲突）：同一事项的要求互斥或数值矛盾（如留存期限6个月 vs 12个月）\n'
  prompt += '- OVERLAP（重叠）：各标准要求实质相同，可合并执行\n'
  prompt += '- COMPLEMENT（互补）：角度不同但可叠加执行，互不矛盾\n\n'
  prompt +=
    '**基线规则**：就高/就严执行；存在无法调和的冲突时在 implementation_notes 标注"需监管确认"。\n\n'

  prompt += '**输出格式**（严格遵循，不要输出JSON以外的文本）：\n'
  prompt += '```json\n{\n  "themes": [\n    {\n'
  prompt += '      "theme_id": "与输入完全一致",\n'
  prompt += '      "relation": "CONFLICT或OVERLAP或COMPLEMENT",\n'
  prompt += '      "relation_rationale": "判定理由（80字内）",\n'
  prompt +=
    '      "document_positions": [{"document_id": "文档ID", "summary": "该标准对此主题的要求摘要（60字内）"}],\n'
  prompt +=
    '      "conflict_points": [{"aspect": "冲突点（如留存期限）", "severity": "HIGH或MEDIUM或LOW", "positions": [{"document_id": "文档ID", "position": "该标准的立场"}]}],\n'
  prompt +=
    '      "unified_baseline": {"requirement": "就高执行的统一要求（120字内）", "strictest_source_document_id": "最严标准的文档ID", "implementation_notes": "落地说明（80字内）"}\n'
  prompt += '    }\n  ]\n}\n```\n\n'
  prompt += '**约束**：\n'
  prompt += `1. themes必须恰好包含全部主题，theme_id原样回显\n`
  prompt += '2. conflict_points仅在relation=CONFLICT时填写，否则为空数组\n'
  prompt += '3. 基线必须可执行、可核验，不要写空话\n'

  return prompt
}

/**
 * 合规基线汇总 prompt
 */
export function fillBaselineSummaryPrompt(input: {
  documentNames: string[]
  stats: { total: number; conflict: number; overlap: number; complement: number; unique: number }
  conflictThemes: Array<{ theme_name: string; rationale: string }>
}): string {
  let prompt = '你是一名企业合规专家。多标准交叉分析已完成，请生成企业合规基线要点清单。\n\n'
  prompt += `**涉及标准**：${input.documentNames.join('、')}\n`
  prompt += `**统计**：共${input.stats.total}个主题，冲突${input.stats.conflict}个，重叠${input.stats.overlap}个，互补${input.stats.complement}个，单一标准独有${input.stats.unique}个。\n\n`

  if (input.conflictThemes.length > 0) {
    prompt += '**冲突主题**：\n'
    input.conflictThemes.slice(0, 15).forEach((theme, index) => {
      prompt += `${index + 1}. ${theme.theme_name}：${theme.rationale}\n`
    })
    prompt += '\n'
  }

  prompt += '**输出格式**（严格遵循）：\n'
  prompt += '```json\n{\n  "baseline_summary": ["基线要点1", "基线要点2", "基线要点3"]\n}\n```\n\n'
  prompt += '**约束**：5-10条要点，每条100字内，按优先级排序，冲突项优先，体现"就高执行"原则。\n'

  return prompt
}
