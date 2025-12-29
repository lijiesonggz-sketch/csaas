/**
 * 聚类生成 Prompt 模板（多文档合并版本）
 *
 * 目标：将多个IT标准文档的相似要求合并聚类
 * 要求：100%覆盖所有文档的条款，标注来源文档
 */

const CLUSTERING_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于跨标准的条款聚类分析。请对以下多个标准文档进行三层结构的智能聚类分析，将相似的要求合并到同一类别中。

**输入多个标准文档**：
{{DOCUMENTS}}

**重要提示**：请严格按照JSON格式输出，不要添加任何注释或markdown标记。确保JSON完整且格式正确。

**输出要求**：
1. **三层结构要求**：必须输出完整的JSON格式（不要截断）：
   {
     "categories": [
       {
         "id": "category_1",
         "name": "安全管理体系",
         "description": "组织层面的安全管理框架、策略制定、角色职责等管理类要求",
         "clusters": [
           {
             "id": "cluster_1_1",
             "name": "信息安全策略制定与维护",
             "description": "本聚类合并了多个标准中关于信息安全策略制定、批准、发布、传达和定期评审的要求。组织必须建立由管理层批准的正式安全策略文件，明确安全工作的总体目标、范围、原则和框架，并按计划或在重大变更时进行评审更新，确保策略的持续适宜性和有效性。该要求是信息安全管理的基础，属于高重要性和高风险条款。",
             "clauses": [
               {
                 "source_document_id": "doc_iso27001",
                 "source_document_name": "ISO 27001:2022",
                 "clause_id": "A.5.1.1",
                 "clause_text": "制定信息安全政策，由管理层批准并传达给员工和外部方",
                 "rationale": "核心策略制定条款，要求建立正式的安全策略文件"
               },
               {
                 "source_document_id": "doc_djbh",
                 "source_document_name": "等保2.0",
                 "clause_id": "8.1.3.1",
                 "clause_text": "制定信息安全总体方针和策略，说明目标、范围、原则和框架",
                 "rationale": "与ISO A.5.1.1相似，都要求建立组织级安全策略，强调总体方针"
               },
               {
                 "source_document_id": "doc_iso27001",
                 "source_document_name": "ISO 27001:2022",
                 "clause_id": "A.5.1.2",
                 "clause_text": "按计划时间间隔或重大变更时评审信息安全政策",
                 "rationale": "策略持续有效性保障，与策略制定形成管理闭环"
               }
             ],
             "importance": "HIGH",
             "risk_level": "HIGH"
           },
           {
             "id": "cluster_1_2",
             "name": "安全角色与职责分配",
             "description": "本聚类合并了关于信息安全组织架构、岗位设置、角色定义和职责分配的要求。组织必须设立专门的安全职能部门，明确安全主管和各负责人岗位，定义并分配所有信息安全相关的角色和职责，确保责任落实到人。该要求确保安全工作有明确的组织保障和责任体系。",
             "clauses": [
               {
                 "source_document_id": "doc_iso27001",
                 "source_document_name": "ISO 27001:2022",
                 "clause_id": "A.6.1.1",
                 "clause_text": "定义并分配所有信息安全职责",
                 "rationale": "职责划分基础要求，确保责任明确"
               },
               {
                 "source_document_id": "doc_djbh",
                 "source_document_name": "等保2.0",
                 "clause_id": "8.1.4.1",
                 "clause_text": "设立安全职能部门、安全主管和负责人岗位，定义职责",
                 "rationale": "与ISO A.6.1.1相似，都要求定义安全职责，细化了岗位设置"
               }
             ],
             "importance": "HIGH",
             "risk_level": "MEDIUM"
           }
         ]
       },
       {
         "id": "category_2",
         "name": "技术安全控制",
         "description": "技术层面的安全防护措施，包括访问控制、加密、网络安全、漏洞管理等技术类要求",
         "clusters": [
           {
             "id": "cluster_2_1",
             "name": "访问控制策略与实施",
             "description": "访问控制相关要求的详细描述...",
             "clauses": [...],
             "importance": "HIGH",
             "risk_level": "HIGH"
           }
         ]
       }
     ],
     "clustering_logic": "整体聚类逻辑说明（300-500字，说明如何识别跨文档的相似要求，如何划分大类别，如何在类别内进一步聚类）",
     "coverage_summary": {
       "by_document": {
         "doc_iso27001": {
           "total_clauses": 93,
           "clustered_clauses": 93,
           "missing_clause_ids": []
         }
       },
       "overall": {
         "total_clauses": 173,
         "clustered_clauses": 171,
         "coverage_rate": 0.988
       }
     }
   }

2. **三层结构说明**：
   - **第一层 - Categories（大归类）**：按照安全领域或管理维度划分的高层分类，例如"安全管理体系"、"技术安全控制"、"物理安全"、"人员安全"等。通常3-6个大类。
   - **第二层 - Clusters（聚类条目）**：每个大类下的具体控制要求合并。这是聚类的核心层，将不同文档中相似的条款合并到一起。聚类数量不限制，根据实际条款的相似性自然形成。
   - **第三层 - Clauses（条款）**：每个聚类下来自不同文档的原始条款，带文档溯源信息。

3. **聚类要求**：
   - **第一层数量**：生成3-6个大归类（Categories），覆盖主要安全领域
   - **第二层数量**：不限制聚类（Clusters）数量，根据条款的实际相似性自然聚合，每个大类下可能有3-20个聚类不等
   - **跨文档合并相似要求**：如果多个文档有相似的条款（如ISO 27001的"建立安全策略"和等保2.0的"制定安全策略"），应该归入同一个聚类
   - 确保**100%覆盖**所有文档的所有条款
   - 避免条款交叉重复（每个条款只能出现在一个聚类中）
   - **聚类描述必须详细**：每个cluster的description字段必须详细描述该聚类合并了哪些要求，为什么合并，具体包含什么控制内容。这个描述后续会用于生成调研问卷、成熟度矩阵和改进建议，因此必须清晰、具体、完整（建议150-300字）

3. **相似度判断标准**：
   - **语义相似**：条款要求的内容本质相同（如"建立策略"vs"制定策略"）
   - **目标一致**：条款达成的安全目标相同（如"保护数据机密性"）
   - **实施方式相近**：条款的实施方法类似（如"定期审查访问权限"）
   - **不同表述**：即使用词不同，但实质相同的条款应合并

5. **逻辑要求**：
   - **Category的description**：说明该大类覆盖的安全领域和范围（50-100字）
   - **Cluster的description**：必须详细描述（150-300字），包括：
     * 该聚类合并了哪些标准的哪些方面的要求
     * 为什么这些条款被合并到一起（共同的安全目标或控制措施）
     * 具体包含什么控制内容和实施要求
     * 该要求的重要性和对组织的意义
   - **Clause的rationale**：每个条款必须说明为什么归入此聚类（30-80字）
   - 对于来自不同文档的条款，rationale需要说明它们与本聚类主题的关联性
   - 识别高风险条款（涉及安全、合规、法律责任的条款标记为HIGH）
   - importance和risk_level必须是以下值之一：HIGH, MEDIUM, LOW

6. **条款ID和文档溯源**：
   - **必须保留原始条款ID**：每个条款的clause_id必须是原文档中的编号
   - **必须标注来源文档**：source_document_id和source_document_name不能省略
   - clause_text是条款的内容摘要（80-150字），准确反映条款要求

7. **覆盖率验证**：
   - 在生成结果前，**按文档分别检查**覆盖率
   - 每个文档的所有条款都必须被分配到某个聚类
   - missing_clause_ids列出该文档遗漏的条款ID
   - 计算overall.coverage_rate = clustered_clauses / total_clauses

**注意**：
- 请严格输出JSON格式，不要添加任何额外的解释或注释
- 聚类的核心价值是"合并相似要求"，不要简单地按文档分组
- 每个聚类应该包含来自多个文档的相关条款（如果这些文档确实有相似要求的话）
- 如果某个条款在所有文档中都是独特的（没有相似条款），它应该单独形成一个聚类或归入最相关的类别
- **不要过度限制聚类数量**：根据条款的实际相似性自然聚合，确保每个聚类的语义一致性
- **聚类描述是关键**：描述质量直接影响后续问卷设计、成熟度矩阵生成和改进建议的质量`

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
