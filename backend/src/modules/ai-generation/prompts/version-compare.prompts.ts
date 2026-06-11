/**
 * 版本比对 Prompt（程序化对齐后的 AI 批量分析）
 */

export interface ModifiedPairInput {
  clause_id: string
  old_text: string
  new_text: string
}

export interface AddedDeletedInput {
  added: Array<{ clause_id: string; text: string }>
  deleted: Array<{ clause_id: string; text: string }>
}

/** 单侧文本超长截断 */
export function truncateClauseForPrompt(text: string, maxLength = 1500): string {
  if (!text || text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}…（已截断，原文${text.length}字符）`
}

/**
 * 变更条款对批量分析 prompt
 * 只分析给定对，clause_id 必须原样回显
 */
export function fillModifiedPairsBatchPrompt(
  pairs: ModifiedPairInput[],
  standardName: string,
): string {
  let prompt = `你是一名IT标准版本比对专家。以下是《${standardName}》新旧版本中**同一条款**的两版文本，请逐对分析变更。\n\n`

  pairs.forEach((pair, index) => {
    prompt += `【变更对 ${index + 1}】条款编号：${pair.clause_id}\n`
    prompt += `旧版文本：${truncateClauseForPrompt(pair.old_text)}\n`
    prompt += `新版文本：${truncateClauseForPrompt(pair.new_text)}\n\n`
  })

  prompt += '**输出格式**（严格遵循，不要输出JSON以外的文本）：\n'
  prompt += '```json\n'
  prompt += '{\n  "results": [\n    {\n'
  prompt += '      "clause_id": "与输入完全一致的条款编号",\n'
  prompt += '      "change_type": "MINOR或MAJOR",\n'
  prompt += '      "change_summary": "一句话概括变更内容（50字内）",\n'
  prompt += '      "impact": "对已实施企业的影响（80字内）",\n'
  prompt += '      "migration_guide": "迁移建议（80字内）"\n'
  prompt += '    }\n  ]\n}\n'
  prompt += '```\n\n'
  prompt += '**约束**：\n'
  prompt += `1. results必须恰好包含${pairs.length}项，clause_id原样回显\n`
  prompt += '2. MAJOR=义务增减/数值变化/适用范围变化；MINOR=措辞调整、表述优化\n'
  prompt += '3. 只分析给定文本，不要推测未提供的内容\n'

  return prompt
}

/**
 * 新增/删除条款批量影响分析 prompt
 */
export function fillAddedDeletedBatchPrompt(
  input: AddedDeletedInput,
  standardName: string,
): string {
  let prompt = `你是一名IT标准版本比对专家。《${standardName}》新版本相比旧版本有以下新增和删除的条款，请逐条分析影响。\n\n`

  if (input.added.length > 0) {
    prompt += '**新增条款**：\n'
    input.added.forEach((item, index) => {
      prompt += `【新增 ${index + 1}】${item.clause_id}：${truncateClauseForPrompt(item.text, 1000)}\n`
    })
    prompt += '\n'
  }

  if (input.deleted.length > 0) {
    prompt += '**删除条款**：\n'
    input.deleted.forEach((item, index) => {
      prompt += `【删除 ${index + 1}】${item.clause_id}：${truncateClauseForPrompt(item.text, 1000)}\n`
    })
    prompt += '\n'
  }

  prompt += '**输出格式**（严格遵循，不要输出JSON以外的文本）：\n'
  prompt += '```json\n{\n'
  prompt +=
    '  "added": [{"clause_id": "原样回显", "impact": "影响说明(80字内)", "action_required": "需采取的行动(80字内)"}],\n'
  prompt +=
    '  "deleted": [{"clause_id": "原样回显", "impact": "影响说明(80字内)", "alternative": "替代方案或后续处理(80字内)"}]\n'
  prompt += '}\n```\n\n'
  prompt += `**约束**：added恰好${input.added.length}项，deleted恰好${input.deleted.length}项，clause_id原样回显。\n`

  return prompt
}

/**
 * 总体摘要 prompt（程序化统计 + 各批变更摘要 → 总结与迁移建议）
 */
export function fillCompareSummaryPrompt(input: {
  oldName: string
  newName: string
  stats: {
    added: number
    modified: number
    deleted: number
    renumbered: number
    unchanged: number
  }
  changeSummaries: string[]
}): string {
  let prompt = `你是一名IT标准版本比对专家。请基于以下比对统计与变更摘要，生成总体结论与迁移建议。\n\n`
  prompt += `旧版本：${input.oldName}\n新版本：${input.newName}\n\n`
  prompt += `**程序化比对统计**：新增${input.stats.added}条，修改${input.stats.modified}条，删除${input.stats.deleted}条，重编号${input.stats.renumbered}条，未变${input.stats.unchanged}条。\n\n`

  if (input.changeSummaries.length > 0) {
    prompt += '**主要变更摘要**：\n'
    input.changeSummaries.slice(0, 30).forEach((summary, index) => {
      prompt += `${index + 1}. ${summary}\n`
    })
    prompt += '\n'
  }

  prompt += '**输出格式**（严格遵循）：\n'
  prompt += '```json\n{\n'
  prompt += '  "comparison_summary": "总体变化概述（150字内）",\n'
  prompt += '  "migration_recommendations": ["迁移建议1", "迁移建议2", "迁移建议3"]\n'
  prompt += '}\n```\n\n'
  prompt += '**约束**：migration_recommendations至少3条、至多6条，每条80字内，可执行。\n'

  return prompt
}

/**
 * 小文档整文直比 prompt（ai_fallback 模式，无截断）
 */
export function fillFullDocComparePrompt(
  oldVersion: { name: string; content: string },
  newVersion: { name: string; content: string },
): string {
  let prompt = '你是一名IT标准版本比对专家。请比对两个版本的差异，识别新增、修改、删除的内容。\n\n'
  prompt += `**旧版本**：${oldVersion.name}\n${oldVersion.content}\n\n`
  prompt += `**新版本**：${newVersion.name}\n${newVersion.content}\n\n`
  prompt += '**输出格式**（严格遵循以下JSON格式，不要输出JSON以外的文本）：\n'
  prompt += '```json\n{\n'
  prompt +=
    '  "version_info": {"old_version": "旧版本号", "new_version": "新版本号", "comparison_summary": "总体变化概述"},\n'
  prompt +=
    '  "added_clauses": [{"clause_id": "条款编号", "clause_text": "条款内容", "impact": "影响", "action_required": "行动"}],\n'
  prompt +=
    '  "modified_clauses": [{"clause_id": "条款编号", "old_text": "旧文本", "new_text": "新文本", "change_type": "MINOR或MAJOR", "impact": "影响", "migration_guide": "迁移建议"}],\n'
  prompt +=
    '  "deleted_clauses": [{"clause_id": "条款编号", "old_text": "旧文本", "impact": "影响", "alternative": "替代方案"}],\n'
  prompt += '  "migration_recommendations": ["建议1", "建议2", "建议3"]\n'
  prompt += '}\n```\n'

  return prompt
}
