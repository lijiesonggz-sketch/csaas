/**
 * 改进措施生成 Prompt 模板
 * 基于成熟度分析结果生成详细的改进措施
 */

export interface ActionPlanPromptData {
  clusterName: string
  clusterId: string
  currentLevel: number
  targetLevel: number
  gap: number
  priority: 'high' | 'medium' | 'low'
  questionDetails?: Array<{
    question_text: string
    score: number
    level: number
    selected_option_text?: string
  }>
}

/**
 * 生成单个聚类的改进措施 Prompt
 */
export function generateActionPlanPrompt(data: ActionPlanPromptData): string {
  const { clusterName, currentLevel, targetLevel, gap, priority, questionDetails } = data

  // 判断紧急程度
  const urgency =
    gap >= 2.0 ? '高（差距较大，急需改进）' : gap >= 1.0 ? '中（存在明显差距）' : '低（小幅提升）'

  // 措施数量建议
  const measureCount = priority === 'high' ? 5 : priority === 'medium' ? 4 : 3

  // 问题详情描述
  let questionContext = ''
  if (questionDetails && questionDetails.length > 0) {
    questionContext = '\n当前问题评估结果：\n'
    questionDetails.forEach((q, idx) => {
      questionContext += `  问题${idx + 1}: ${q.question_text}\n`
      questionContext += `    - 得分: ${q.score}/5.0\n`
      questionContext += `    - 当前级别: Level ${q.level}\n`
      if (q.selected_option_text) {
        questionContext += `    - 选择的选项: ${q.selected_option_text}\n`
      }
      questionContext += '\n'
    })
  }

  return `你是一位资深的数据安全咨询专家，擅长基于CMMI成熟度模型为企业制定数据安全改进路线图。

## 任务背景

请为以下聚类领域生成详细的改进措施：

**聚类名称**: ${clusterName}
**当前成熟度**: Level ${currentLevel.toFixed(2)}
**目标成熟度**: Level ${targetLevel.toFixed(2)}
**差距**: ${gap.toFixed(2)} 级
**优先级**: ${priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
**改进紧急程度**: ${urgency}
${questionContext}

## 要求

请生成 ${measureCount} 条具体的改进措施，每条措施必须包含以下完整信息：

### 单个措施结构：
1. **title**: 措施标题（简洁明确）
2. **description**: 详细描述（为什么要实施这个措施，预期解决什么问题）
3. **implementation_steps**: 实施步骤数组，每个步骤包含：
   - step_number: 步骤编号
   - title: 步骤标题
   - description: 步骤描述
   - duration: 预计耗时（如"2周"、"1个月"）
4. **timeline**: 整体时间周期（如"3个月"、"6个月"）
5. **responsible_department**: 负责部门
6. **expected_improvement**: 预期提升分数（0.1-0.5分，基于差距分配）
7. **resources_needed**: 资源需求对象，包含：
   - budget: 预算估算（如"50-100万"、"无需额外预算"）
   - personnel: 需要的人员（数组，如["安全工程师", "系统管理员"]）
   - technology: 需要的技术工具（数组，如["SIEM系统", "DLP工具"]）
   - training: 培训需求描述
8. **dependencies**: 依赖关系对象，包含：
   - prerequisite_measures: 前置措施ID数组（如["M001", "M002"]）
   - external_dependencies: 外部依赖（如["监管政策发布", "供应商配合"]）
9. **risks**: 风险数组，每个风险包含：
   - risk: 风险描述
   - mitigation: 缓解措施
10. **kpi_metrics**: KPI指标数组，每个指标包含：
    - metric: 指标名称
    - target: 目标值
    - measurement_method: 测量方法

## 输出格式

请严格按照以下JSON格式输出，不要包含任何其他内容：

\`\`\`json
{
  "measures": [
    {
      "title": "实施多因素认证机制",
      "description": "通过引入多因素认证（MFA）提升账户安全性，有效防范凭据窃取和未授权访问风险。适用于所有关键系统和远程访问场景。",
      "implementation_steps": [
        {
          "step_number": 1,
          "title": "需求调研和方案设计",
          "description": "调研现有认证系统，评估业务场景，设计MFA实施方案",
          "duration": "2周"
        },
        {
          "step_number": 2,
          "title": "技术选型和采购",
          "description": "选择MFA解决方案，完成采购流程",
          "duration": "3周"
        },
        {
          "step_number": 3,
          "title": "系统部署和集成",
          "description": "部署MFA系统，与现有应用集成",
          "duration": "4周"
        },
        {
          "step_number": 4,
          "title": "测试和优化",
          "description": "进行功能测试、性能测试和用户体验优化",
          "duration": "2周"
        },
        {
          "step_number": 5,
          "title": "培训和上线",
          "description": "用户培训，分批上线",
          "duration": "2周"
        }
      ],
      "timeline": "3-4个月",
      "responsible_department": "信息安全部、IT运维部",
      "expected_improvement": 0.3,
      "resources_needed": {
        "budget": "80-120万（含软件许可和实施费用）",
        "personnel": ["安全架构师", "系统工程师", "运维工程师"],
        "technology": ["MFA认证平台", "IAM系统", "移动端APP"],
        "training": "需要对管理员进行MFA系统管理培训，对用户进行使用培训"
      },
      "dependencies": {
        "prerequisite_measures": [],
        "external_dependencies": ["业务系统配合改造"]
      },
      "risks": [
        {
          "risk": "用户可能对MFA操作流程不熟悉，导致短期工作效率下降",
          "mitigation": "提供详细的操作指南和视频教程，设置7天适应期，期间允许降级认证"
        },
        {
          "risk": "部分老旧系统可能不支持MFA集成",
          "mitigation": "采用网关代理或VPN方案实现统一认证，逐步淘汰老旧系统"
        },
        {
          "risk": "移动端网络不稳定可能影响认证成功率",
          "mitigation": "支持多种认证方式（短信、邮件、令牌、生物识别），确保可用性"
        }
      ],
      "kpi_metrics": [
        {
          "metric": "MFA覆盖率",
          "target": "100%的关键系统账户",
          "measurement_method": "统计已启用MFA的账户数/总账户数"
        },
        {
          "metric": "认证成功率",
          "target": "≥99%",
          "measurement_method": "监控系统日志统计成功认证次数/总认证次数"
        },
        {
          "metric": "未授权访问事件数",
          "target": "0次/年",
          "measurement_method": "通过SIEM系统统计安全告警事件"
        }
      ]
    }
  ]
}
\`\`\`

## 注意事项

1. 措施必须具体可执行，避免空泛的描述
2. 实施步骤要逻辑清晰，时间估算合理
3. 资源需求要切合实际，预算估算要考虑国内市场情况
4. 风险识别要全面，缓解措施要有针对性
5. KPI指标要可量化、可测量
6. 预期提升分数要合理分配，总提升应接近差距值
7. 优先级高的措施应该更详细、更具体

请开始生成改进措施：
`
}
