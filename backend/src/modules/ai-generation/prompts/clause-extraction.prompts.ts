/**
 * 条款提取Prompt模板
 * 用于从标准文档中提取完整的条款清单
 */

/**
 * 条款提取输入接口
 */
export interface ClauseExtractionInput {
  standardDocument: {
    id: string
    name: string
    content: string
  }
  expectedClauseCount?: number // 可选：期望的条款数量（用于验证）
  temperature?: number
  maxTokens?: number
}

/**
 * 单个条款结构
 */
export interface Clause {
  clause_id: string
  clause_full_text: string
  chapter?: string
}

/**
 * 条款提取输出接口
 */
export interface ClauseExtractionOutput {
  total_clauses: number
  clauses: Clause[]
  extraction_metadata: {
    document_length: number
    extraction_method: string
    confidence: number
  }
}

/**
 * 填充条款提取Prompt
 */
export function fillClauseExtractionPrompt(
  standardDocument: { id: string; name: string; content: string },
  expectedClauseCount?: number,
): string {
  let prompt = `你是一名IT标准文档分析专家。请从以下标准文档中提取**所有条款的完整清单**。\n\n`

  prompt += `**标准名称**：${standardDocument.name}\n`
  prompt += `**标准长度**：${standardDocument.content.length} 字符\n\n`

  prompt += `**标准内容**：\n${standardDocument.content}\n\n`

  prompt += `**任务要求**：\n`
  prompt += `1. 【核心要求】提取标准中的**所有条款**，不得遗漏任何条款\n`
  prompt += `2. 【必须】提取**所有层级**的条款，包括：\n`
  prompt += `   - 一级条款（如：第4条、第四条）\n`
  prompt += `   - 二级条款（如：4.1、4.2、5.1、6.1）\n`
  prompt += `   - 三级条款（如：4.2.1、4.2.2）\n`
  prompt += `   - 章节条款（如：第4章、第五章）\n`
  prompt += `   【重要】不要遗漏任何层级的条款！\n`
  prompt += `3. 【必须】对于每个条款，必须提供：\n`
  prompt += `   - clause_id：条款编号（如"第四条"、"4.1"、"4.2"、"第5章"、"第4.2.1条"等）\n`
  prompt += `   - clause_full_text：条款的完整原文（逐字逐句，不能省略任何内容）\n`
  prompt += `   - chapter（可选）：所属章节名称，如果有\n\n`

  if (expectedClauseCount) {
    prompt += `**预期条款数量**：${expectedClauseCount}条\n`
    prompt += `【重要】提取的条款总数必须等于${expectedClauseCount}，不能多也不能少！\n\n`
  } else {
    prompt += `**预期条款数量**：请完整提取所有条款，确保不遗漏\n\n`
  }

  prompt += `**输出格式**（严格遵循以下JSON格式）：\n\n`
  prompt += `{\n`
  prompt += `  "total_clauses": ${expectedClauseCount || '实际条款总数'},\n`
  prompt += `  "clauses": [\n`
  prompt += `    {\n`
  prompt += `      "clause_id": "第四条",\n`
  prompt += `      "clause_full_text": "第四条 网络安全等级保护应坚持...\n完整条款原文...",\n`
  prompt += `      "chapter": "第二章 术语和定义"\n`
  prompt += `    },\n`
  prompt += `    {\n`
  prompt += `      "clause_id": "4.1",\n`
  prompt += `      "clause_full_text": "4.1 安全技术要求应包括...\n完整条款原文...",\n`
  prompt += `      "chapter": "第四章 安全技术要求"\n`
  prompt += `    },\n`
  prompt += `    ...\n`
  prompt += `  ]\n`
  prompt += `}\n\n`

  prompt += `**重要约束**：\n`
  prompt += `1. 【必须】严格遵循JSON格式，不要在JSON之外添加任何其他文本\n`
  prompt += `2. 【必须】clauses数组必须包含标准中的**所有条款**，不要遗漏任何一个\n`
  prompt += `3. 【必须】每个条款的clause_full_text必须完整，不能截断，必须包含该条款的所有内容\n`
  prompt += `4. 【必须】clause_id必须准确反映条款在原文中的编号格式\n`
  if (expectedClauseCount) {
    prompt += `5. 【必须】total_clauses必须等于${expectedClauseCount}\n`
  }
  prompt += `6. 【必须】输出的JSON必须格式正确，可以被JSON.parse()直接解析\n\n`

  prompt += `请按照以上要求提取条款清单。`

  return prompt
}

/**
 * 填充条款补全Prompt
 * 当正则表达式检测到缺失条款时，用于提取特定条款的原文
 */
export function fillClauseCompletionPrompt(
  documentContent: string,
  missingClauseIds: string[],
): string {
  let prompt = `你是一名IT标准文档分析专家。请从以下标准文档中提取**指定条款**的完整原文。\n\n`

  prompt += `**标准内容**：\n${documentContent}\n\n`

  prompt += `**需要提取的条款**：\n`
  missingClauseIds.forEach((clauseId, idx) => {
    prompt += `${idx + 1}. ${clauseId}\n`
  })
  prompt += `\n`

  prompt += `**任务要求**：\n`
  prompt += `1. 【核心要求】为上述每个条款提取**完整的原文内容**\n`
  prompt += `2. 【必须】每个条款必须提供：\n`
  prompt += `   - clause_id：条款编号（与输入一致）\n`
  prompt += `   - clause_full_text：条款的完整原文（从条款编号开始，到下一个条款编号之前的所有内容）\n\n`

  prompt += `**输出格式**（严格遵循以下JSON格式）：\n\n`
  prompt += `{\n`
  prompt += `  "clauses": [\n`
  prompt += `    {\n`
  prompt += `      "clause_id": "第四条",\n`
  prompt += `      "clause_full_text": "第四条 完整原文内容..."\n`
  prompt += `    },\n`
  prompt += `    {\n`
  prompt += `      "clause_id": "4.1",\n`
  prompt += `      "clause_full_text": "4.1 完整原文内容..."\n`
  prompt += `    }\n`
  prompt += `  ]\n`
  prompt += `}\n\n`

  prompt += `**重要约束**：\n`
  prompt += `1. 【必须】只提取指定的${missingClauseIds.length}个条款，不要提取其他条款\n`
  prompt += `2. 【必须】clause_full_text必须包含该条款的所有内容，不能截断\n`
  prompt += `3. 【必须】严格按照JSON格式输出\n\n`

  prompt += `请按照以上要求提取指定条款的原文。`

  return prompt
}
