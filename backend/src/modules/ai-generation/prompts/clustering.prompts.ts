/**
 * 聚类生成 Prompt 模板（多文档合并版本）
 *
 * 目标：将多个IT标准文档的相似要求合并聚类
 * 要求：100%覆盖所有文档的条款，标注来源文档
 */

const CLUSTERING_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于跨标准的条款聚类分析。请对以下多个标准文档进行智能聚类，将相似的要求合并到同一类别中。

**输入多个标准文档**：
{{DOCUMENTS}}

**重要提示**：请严格按照JSON格式输出，不要添加任何注释或markdown标记。确保JSON完整且格式正确。

**输出要求**：
1. **结构要求**：必须输出完整的JSON格式（不要截断）：
   {
     "clusters": [
       {
         "id": "cluster_1",
         "name": "信息安全策略",
         "description": "组织层面的安全策略制定和管理",
         "clauses": [
           {
             "source_document_id": "doc_iso27001",
             "source_document_name": "ISO 27001:2022",
             "clause_id": "5.1.1",
             "clause_text": "建立信息安全策略（原文摘要，不超过100字）",
             "rationale": "核心策略条款"
           },
           {
             "source_document_id": "doc_djbh",
             "source_document_name": "等保2.0",
             "clause_id": "7.1.2.1",
             "clause_text": "制定安全策略文档（原文摘要）",
             "rationale": "与ISO 5.1.1相似，都要求建立安全策略"
           }
         ],
         "importance": "HIGH",
         "risk_level": "HIGH"
       }
     ],
     "clustering_logic": "整体聚类逻辑说明（200-300字，说明如何识别跨文档的相似要求）",
     "coverage_summary": {
       "by_document": {
         "doc_iso27001": {
           "total_clauses": 93,
           "clustered_clauses": 93,
           "missing_clause_ids": []
         },
         "doc_djbh": {
           "total_clauses": 80,
           "clustered_clauses": 78,
           "missing_clause_ids": ["7.3.5", "8.2.1"]
         }
       },
       "overall": {
         "total_clauses": 173,
         "clustered_clauses": 171,
         "coverage_rate": 0.988
       }
     }
   }

2. **聚类要求**：
   - 生成8-12个聚类类别（不要太多，确保JSON能够完整输出）
   - **跨文档合并相似要求**：如果多个文档有相似的条款（如ISO 27001的"建立安全策略"和等保2.0的"制定安全策略"），应该归入同一个聚类
   - 每个聚类包含来自不同文档的相关条款
   - 确保**100%覆盖**所有文档的所有条款
   - 避免条款交叉重复（每个条款只能出现在一个聚类中）

3. **相似度判断标准**：
   - **语义相似**：条款要求的内容本质相同（如"建立策略"vs"制定策略"）
   - **目标一致**：条款达成的安全目标相同（如"保护数据机密性"）
   - **实施方式相近**：条款的实施方法类似（如"定期审查访问权限"）
   - **不同表述**：即使用词不同，但实质相同的条款应合并

4. **逻辑要求**：
   - 每个条款必须说明为什么归入此类别（rationale字段，20-50字）
   - 对于来自不同文档的条款，rationale需要说明它们的相似性
   - 识别高风险条款（涉及安全、合规、法律责任的条款标记为HIGH）
   - importance和risk_level必须是以下值之一：HIGH, MEDIUM, LOW

5. **条款ID和文档溯源**：
   - **必须保留原始条款ID**：每个条款的clause_id必须是原文档中的编号
   - **必须标注来源文档**：source_document_id和source_document_name不能省略
   - clause_text是条款的简短摘要（不超过100字），帮助理解条款内容

6. **覆盖率验证**：
   - 在生成结果前，**按文档分别检查**覆盖率
   - 每个文档的所有条款都必须被分配到某个聚类
   - missing_clause_ids列出该文档遗漏的条款ID
   - 计算overall.coverage_rate = clustered_clauses / total_clauses

**注意**：
- 请严格输出JSON格式，不要添加任何额外的解释或注释
- 聚类的核心价值是"合并相似要求"，不要简单地按文档分组
- 每个聚类应该包含来自多个文档的相关条款（如果这些文档确实有相似要求的话）
- 如果某个条款在所有文档中都是独特的（没有相似条款），它应该单独形成一个聚类或归入最相关的类别`

/**
 * 填充聚类Prompt模板（多文档版本）
 * @param documents 多个标准文档
 * @returns 填充后的Prompt
 */
export function fillClusteringPrompt(
  documents: Array<{ id: string; name: string; content: string }>,
): string {
  // 格式化文档列表
  const documentsText = documents
    .map(
      (doc, index) =>
        `**文档${index + 1} - ID: ${doc.id}**
**文档名称**: ${doc.name}
**文档内容**:
${doc.content}

---`,
    )
    .join('\n\n')

  return CLUSTERING_PROMPT_TEMPLATE.replace('{{DOCUMENTS}}', documentsText)
}
