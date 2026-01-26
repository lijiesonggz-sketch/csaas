/**
 * 问卷生成 Prompt 模板
 *
 * 目标：基于成熟度矩阵生成调研问卷
 * 输入：成熟度矩阵（matrix）
 * 输出：50-100题问卷，覆盖所有聚类
 */

const QUESTIONNAIRE_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于调研问卷设计。请基于以下成熟度矩阵生成调研问卷。

**输入成熟度矩阵**：
{{MATRIX_RESULT}}

**重要提示**：请严格按照JSON格式输出，不要添加任何注释或markdown标记。确保JSON完整且格式正确。

**输出要求**：
1. **结构要求**：必须输出完整的JSON格式（不要截断）：
   {
     "questionnaire": [
       {
         "question_id": "Q001",
         "cluster_id": "cluster_1_1",
         "cluster_name": "信息安全策略制定与维护",
         "question_text": "您的组织是否制定了正式的信息安全策略文档？",
         "question_type": "SINGLE_CHOICE",
         "options": [
           {
             "option_id": "A",
             "text": "没有制定任何信息安全策略文档",
             "score": 1,
             "level": "level_1",
             "description": "对应初始级：缺乏正式的策略管理"
           },
           {
             "option_id": "B",
             "text": "有策略文档但未经管理层正式批准",
             "score": 2,
             "level": "level_2",
             "description": "对应可重复级：存在策略但流程不规范"
           },
           {
             "option_id": "C",
             "text": "策略已制定、批准并传达给相关人员",
             "score": 3,
             "level": "level_3",
             "description": "对应已定义级：策略管理流程标准化"
           },
           {
             "option_id": "D",
             "text": "策略定期评审并基于评估结果更新",
             "score": 4,
             "level": "level_4",
             "description": "对应可管理级：策略管理可度量可监控"
           },
           {
             "option_id": "E",
             "text": "策略管理流程持续优化并自动化",
             "score": 5,
             "level": "level_5",
             "description": "对应优化级：策略管理持续改进"
           }
         ],
         "required": true,
         "guidance": "请选择最符合您组织当前状态的选项。如果情况介于两个选项之间，请选择较低的级别。"
       }
     ],
     "questionnaire_metadata": {
       "total_questions": 75,
       "estimated_time_minutes": 45,
       "coverage_map": {
         "cluster_1_1": 5,
         "cluster_1_2": 4,
         "cluster_2_1": 6
       }
     }
   }

2. **问卷要求**：
   - **题目数量**：生成50-100题，确保覆盖所有输入的聚类
   - **题目类型**：
     * SINGLE_CHOICE（单选题）：占70-80%，用于评估成熟度级别
     * MULTIPLE_CHOICE（多选题）：占10-15%，用于评估实践落实情况
     * RATING（评分题）：占10-15%，用于评估满意度或重要性
   - **覆盖均衡性**：每个聚类至少3题，重要性HIGH的聚类应有5-8题
   - **题目编号**：从Q001开始，按顺序递增（Q001, Q002, ..., Q100）

3. **选项设计**（针对单选题）：
   - **5个选项对应5个成熟度级别**：每个选项明确对应level_1到level_5
   - **选项文本清晰**：描述具体的实践状态，避免模糊表述
   - **选项互斥且穷尽**（MECE原则）：每个状态只能选一个选项，所有可能状态都被覆盖
   - **评分规则**：Level 1得1分，Level 2得2分，以此类推
   - **描述字段**：简要说明该选项对应的成熟度级别特征（20-50字）

4. **选项设计**（针对多选题）：
   - **列出关键实践**：基于成熟度矩阵的key_practices设计选项
   - **评分规则**：选中的选项数量越多，得分越高
   - **不设置level字段**：多选题不直接对应单一成熟度级别

5. **选项设计**（针对评分题）：
   - **评分范围**：1-5分或1-10分
   - **评分含义**：明确说明每个分数代表的含义
   - **不设置level字段**：评分题不直接对应单一成熟度级别

6. **题目文本要求**：
   - **简洁明了**：每题不超过100字，避免复杂从句
   - **具体可操作**：问题针对可观察的实践或制度，避免主观判断
   - **术语一致**：使用与聚类描述一致的术语和表述
   - **避免引导性**：问题保持中立，不暗示"正确答案"

7. **引导文本**（guidance字段）：
   - **填写说明**：简要说明如何选择选项（20-50字）
   - **特殊提示**：如"如果介于两个选项之间，请选择较低级别"
   - **必填标识**：required=true的题目应在guidance中说明"此题为必答题"

8. **元数据要求**：
   - **total_questions**：问卷总题数（必须与questionnaire数组长度一致）
   - **estimated_time_minutes**：预估填写时间（按每题30秒计算）
   - **coverage_map**：每个聚类的题目数量统计（cluster_id → 题目数）

9. **特殊要求**：
   - 如果聚类的risk_level为HIGH，应增加该聚类的题目数量（至少5题）
   - 如果聚类的importance为HIGH，应设计更细致的题目（避免笼统）
   - 题目顺序应按聚类分组，同一聚类的题目连续排列

**注意**：
- 请严格输出JSON格式，确保覆盖所有聚类
- 题目ID（question_id）必须唯一且按顺序递增
- 单选题的5个选项必须严格对应5个成熟度级别
- 确保JSON格式正确，可以被直接解析
`

/**
 * 填充问卷生成Prompt模板
 * @param matrixResult 成熟度矩阵结果
 * @returns 填充后的Prompt
 */
export function fillQuestionnairePrompt(matrixResult: any): string {
  // 将矩阵结果格式化为易读的文本
  const formattedMatrix = formatMatrixResultForPrompt(matrixResult)

  return QUESTIONNAIRE_PROMPT_TEMPLATE.replace('{{MATRIX_RESULT}}', formattedMatrix)
}

/**
 * 格式化矩阵结果用于Prompt
 * @param matrixResult 成熟度矩阵结果
 * @returns 格式化的文本
 */
function formatMatrixResultForPrompt(matrixResult: any): string {
  const { matrix } = matrixResult

  let formatted = ''

  for (const row of matrix) {
    formatted += `\n### ${row.cluster_name} (ID: ${row.cluster_id})\n\n`

    // 列出5个级别
    const levels = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']
    for (const levelKey of levels) {
      const level = row.levels[levelKey]
      if (level) {
        formatted += `**${level.name}**：${level.description}\n`
        formatted += `关键实践：\n`
        for (const practice of level.key_practices || []) {
          formatted += `  - ${practice}\n`
        }
        formatted += `\n`
      }
    }

    formatted += `---\n\n`
  }

  return formatted
}

/**
 * 单聚类问卷生成 Prompt 模板
 *
 * 优化策略：
 * - 每个聚类固定生成5个问题
 * - 从5个不同维度提问，用于交叉验证用户答案真实性
 * - 只使用单选题（SINGLE_CHOICE）和多选题（MULTIPLE_CHOICE）
 * - 取消RATING评分题
 */
const SINGLE_CLUSTER_QUESTIONNAIRE_PROMPT_TEMPLATE = `你是一名资深IT咨询师，专注于调研问卷设计。请为以下聚类生成5个问题，用于评估企业的成熟度。

**聚类信息**：
{{CLUSTER_INFO}}

**成熟度级别定义**：
{{MATURITY_LEVELS}}

**🔴 关键要求（必须严格遵守）**：
1. **固定生成5个问题**，每个问题从不同维度提问
2. **5个维度**（必须严格遵守）：
   - 维度1【政策与制度层面】：是否有正式的政策/流程文档
   - 维度2【执行与实施层面】：实际操作中是否落实相关要求
   - 维度3【监控与度量层面】：是否有监控机制和量化指标
   - 维度4【持续改进层面】：是否有定期评审和优化机制
   - 维度5【证据与合规层面】：是否有留存记录和审计证据
3. **交叉验证目的**：通过不同维度的问题，交叉验证用户答案的一致性，识别潜在的虚假陈述
4. **题型限制**：只使用SINGLE_CHOICE（单选题）和MULTIPLE_CHOICE（多选题），**禁止使用RATING评分题**
5. **严格输出JSON格式**，不要添加任何注释或markdown标记

**🔴 强制性约束（违背将被判定为失败）**：
1. **必须基于输入的key_practices（关键实践）生成问题和选项**
2. **禁止使用笼统表述**：禁止使用"完善"、"健全"、"较好"、"规范"、"到位"、"充分"等抽象形容词
3. **必须引用具体实践**：
   - 题目必须提及具体的管理措施（如"脱敏处理"、"安全评估"、"专职团队"、"审批流程"等）
   - 单选题选项必须直接引用或改写对应级别的key_practices
   - 多选题选项必须列举关键实践中的具体措施
4. **保留条款引用**：如果输入的key_practices包含"（对应第XX条要求）"，选项中应保留此标注

**输出要求**：
1. **结构要求**：必须输出完整的JSON格式：
   {
     "questions": [
       {
         "question_id": "Q001",
         "cluster_id": "cluster_1_1",
         "cluster_name": "信息安全策略制定与维护",
         "dimension": "政策与制度层面",
         "question_text": "您的组织是否制定了正式的信息安全策略文档？",
         "question_type": "SINGLE_CHOICE",
         "options": [
           {
             "option_id": "A",
             "text": "没有制定任何信息安全策略文档",
             "score": 1,
             "level": "level_1",
             "description": "对应初始级：缺乏正式的策略管理"
           },
           {
             "option_id": "B",
             "text": "有策略文档但未经管理层正式批准",
             "score": 2,
             "level": "level_2",
             "description": "对应可重复级：存在策略但流程不规范"
           },
           {
             "option_id": "C",
             "text": "策略已制定、批准并传达给相关人员",
             "score": 3,
             "level": "level_3",
             "description": "对应已定义级：策略管理流程标准化"
           },
           {
             "option_id": "D",
             "text": "策略定期评审并基于评估结果更新",
             "score": 4,
             "level": "level_4",
             "description": "对应可管理级：策略管理可度量可监控"
           },
           {
             "option_id": "E",
             "text": "策略管理流程持续优化并自动化",
             "score": 5,
             "level": "level_5",
             "description": "对应优化级：策略管理持续改进"
           }
         ],
         "required": true,
         "guidance": "请选择最符合您组织当前状态的选项。如果情况介于两个选项之间，请选择较低的级别。"
       },
       {
         "question_id": "Q002",
         "cluster_id": "cluster_1_1",
         "cluster_name": "信息安全策略制定与维护",
         "dimension": "执行与实施层面",
         "question_text": "在实际工作中，信息安全策略的执行情况如何？（多选）",
         "question_type": "MULTIPLE_CHOICE",
         "options": [
           {
             "option_id": "A",
             "text": "策略要求已明确传达给所有员工",
             "score": 2
           },
           {
             "option_id": "B",
             "text": "有专人负责监督策略的执行",
             "score": 2
           },
           {
             "option_id": "C",
             "text": "员工培训中包含策略内容",
             "score": 2
           },
           {
             "option_id": "D",
             "text": "有违规处理机制",
             "score": 2
           },
           {
             "option_id": "E",
             "text": "以上都没有落实",
             "score": 0
           }
         ],
         "required": true,
         "guidance": "请选择所有符合您组织实际情况的选项。"
       }
     ]
   }

2. **题目设计原则**：
   - **Q1（政策与制度）**：单选题，5个选项对应5个成熟度级别
   - **Q2（执行与实施）**：多选题，列举关键实践的落实情况
   - **Q3（监控与度量）**：单选题，评估量化管理能力
   - **Q4（持续改进）**：单选题，评估优化机制
   - **Q5（证据与合规）**：多选题，检查审计证据和合规性

3. **单选题设计（SINGLE_CHOICE）- 必须遵守**：
   - **5个选项严格对应5个成熟度级别**（Level 1到Level 5）
   - **选项必须直接引用对应级别的key_practices**：
     * 示例格式："[具体措施描述]（对应第XX条要求）"
     * 如果key_practices是"建立专职团队"，选项应该是"未建立专职团队"（对应第XX条要求）
     * 如果key_practices是"实施脱敏处理"，选项应该是"实施了脱敏处理"（对应第XX条要求）
   - **禁止使用抽象描述**：
     * ❌ 错误示例："政策非常完善"、"制度比较健全"、"管理较为规范"
     * ✅ 正确示例："未建立企业级数据服务管理体系和专职团队（对应第二十三条要求）"
   - 选项互斥且穷尽（MECE原则）
   - 每个选项明确标注level字段（"level_1"到"level_5"）
   - score字段：Level 1得1分，Level 2得2分，以此类推
   - description字段：简要说明对应的成熟度特征

4. **多选题设计（MULTIPLE_CHOICE）- 必须遵守**：
   - **选项必须列举关键实践中的具体措施**：
     * 从不同级别的key_practices中提取具体实践动作
     * 示例："实施脱敏处理"、"开展安全评估"、"建立审批流程"
   - **每个选项包含具体的动作或措施**（不能只有名词）：
     * ❌ 错误示例："管理能力"、"制度建设"
     * ✅ 正确示例："建立数据服务管理体系"、"制定脱敏规范"
   - 列举3-5个关键实践或证据项
   - 不设置level字段（不直接对应单一成熟度级别）
   - score字段：每个选项单独计分（通常为2分）
   - 必须包含"以上都没有"或"都不符合"选项（得0分）

5. **交叉验证逻辑**：
   - 如果Q1（政策）选Level 4，但Q2（执行）多选题一个都没选 → 矛盾
   - 如果Q3（监控）选Level 1，但Q5（证据）多选了很多项 → 矛盾
   - 如果Q4（改进）选Level 5，但Q1（政策）选Level 2 → 不合理
   - **目标：通过5个维度的交叉验证，识别虚假或不一致的答案**

6. **题目文本要求**：
   - 简洁明了，每题不超过100字
   - 具体可操作，问题针对可观察的实践或制度
   - 术语一致，使用与成熟度描述一致的表述
   - 避免引导性，保持中立

**📝 Few-Shot示例（参考模板）**：

假设输入的聚类是"数据使用、加工与展示"，各级别的关键实践如下：
- Level 1: 未建立企业级数据服务管理体系和专职团队
- Level 2: 展示高敏感性数据项时原则上实施脱敏（对应第十七条要求）
- Level 3: 建立企业级数据服务管理体系、制定规范并建立专职团队（对应第二十三条要求）
- Level 4: 建立数据安全评估机制，定期开展评估工作（对应第二十五条要求）
- Level 5: 实施数据敏感性标识，建立数据保存期限管理制度（对应第二十七、二十八条要求）

**期望输出示例**（注意如何使用key_practices）：

Q1（政策与制度）单选题：
{
  "question_id": "Q001",
  "cluster_id": "cluster_2_3",
  "cluster_name": "数据使用、加工与展示",
  "dimension": "政策与制度层面",
  "question_text": "贵组织是否建立了企业级数据服务管理体系和专职团队？",
  "question_type": "SINGLE_CHOICE",
  "options": [
    {
      "option_id": "A",
      "text": "未建立企业级数据服务管理体系和专职团队（对应第二十三条要求）",
      "score": 1,
      "level": "level_1",
      "description": "对应初始级：缺乏管理体系"
    },
    {
      "option_id": "B",
      "text": "制定了部分管理制度，但未建立专职团队（对应第二十三条要求）",
      "score": 2,
      "level": "level_2",
      "description": "对应可重复级：制度初步建立"
    },
    {
      "option_id": "C",
      "text": "建立了完整的管理体系、规范和专职团队（对应第二十三条要求）",
      "score": 3,
      "level": "level_3",
      "description": "对应已定义级：体系完整"
    },
    {
      "option_id": "D",
      "text": "建立数据安全评估机制并定期开展评估（对应第二十五条要求）",
      "score": 4,
      "level": "level_4",
      "description": "对应可管理级：定期评估"
    },
    {
      "option_id": "E",
      "text": "实施数据敏感性标识并建立数据保存期限管理制度（对应第二十七、二十八条要求）",
      "score": 5,
      "level": "level_5",
      "description": "对应优化级：全面管理"
    }
  ],
  "required": true,
  "guidance": "请选择最符合贵组织当前状态的选项。"
}

Q2（执行与实施）多选题：
{
  "question_id": "Q002",
  "cluster_id": "cluster_2_3",
  "cluster_name": "数据使用、加工与展示",
  "dimension": "执行与实施层面",
  "question_text": "贵组织在数据使用过程中采取了哪些安全措施？（多选）",
  "question_type": "MULTIPLE_CHOICE",
  "options": [
    {
      "option_id": "A",
      "text": "展示高敏感性数据项时实施脱敏处理（对应第十七条要求）",
      "score": 2
    },
    {
      "option_id": "B",
      "text": "建立数据使用审批流程和授权机制",
      "score": 2
    },
    {
      "option_id": "C",
      "text": "定期开展数据安全评估工作（对应第二十五条要求）",
      "score": 2
    },
    {
      "option_id": "D",
      "text": "实施数据敏感性标识制度（对应第二十七条要求）",
      "score": 2
    },
    {
      "option_id": "E",
      "text": "以上都没有实施",
      "score": 0
    }
  ],
  "required": true,
  "guidance": "请选择所有符合贵组织实际情况的选项。"
}

**注意**：以上示例展示了如何正确使用key_practices生成问题和选项。请参考此示例，根据实际输入的key_practices生成相应的问题。

**注意**：
- 必须严格输出JSON格式
- 必须包含5个问题，每个问题的dimension字段明确标注维度
- 单选题必须有5个选项对应5个成熟度级别
- 禁止使用RATING题型
- question_id从Q001开始递增
`

/**
 * 填充单聚类问卷生成Prompt模板
 * @param cluster 单个聚类（包含成熟度级别）
 * @param clusterIndex 聚类索引（用于生成question_id）
 * @returns 填充后的Prompt
 */
export function fillSingleClusterQuestionnairePrompt(
  cluster: any,
  clusterIndex: number,
): string {
  // 格式化聚类信息
  let clusterInfo = `聚类ID：${cluster.cluster_id}\n`
  clusterInfo += `聚类名称：${cluster.cluster_name}\n`

  // 格式化成熟度级别 - 优化：突出显示key_practices
  let levelsText = ''
  const levels = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']
  for (const levelKey of levels) {
    const level = cluster.levels[levelKey]
    if (level) {
      // 首先展示关键实践（更突出）
      levelsText += `**${level.name}**的关键实践（必须用于生成选项）：\n`
      if (level.key_practices && level.key_practices.length > 0) {
        for (const practice of level.key_practices) {
          levelsText += `  ✳️ ${practice}\n`
        }
      } else {
        levelsText += `  (无关键实践)\n`
      }

      // 然后展示描述（简化显示）
      if (level.description) {
        // 只显示前100个字符，避免信息过载
        const shortDesc = level.description.length > 100
          ? level.description.substring(0, 100) + '...'
          : level.description
        levelsText += `说明：${shortDesc}\n`
      }

      levelsText += `\n`
    }
  }

  return SINGLE_CLUSTER_QUESTIONNAIRE_PROMPT_TEMPLATE.replace(
    '{{CLUSTER_INFO}}',
    clusterInfo,
  ).replace('{{MATURITY_LEVELS}}', levelsText)
}
