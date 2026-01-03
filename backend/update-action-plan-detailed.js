const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function update() {
  await client.connect();

  // 创建详细的改进措施数据
  const detailedResult = {
    summary: '数据安全改进措施计划 - 基于CMMI成熟度模型生成',
    metadata: {
      timeline: '12-18个月（长期规划）',
      generatedAt: new Date().toISOString(),
      clusterCount: 6,
      totalMeasures: 8,
      targetMaturity: 4.0,
      currentMaturity: 2.5
    },
    measures: [
      {
        clusterName: '访问控制管理',
        clusterId: 'cluster_001',
        currentLevel: 2.0,
        targetLevel: 4.0,
        gap: 2.0,
        priority: 'high',
        title: '实施多因素认证机制',
        description: '通过引入多因素认证（MFA）提升账户安全性，有效防范凭据窃取和未授权访问风险。适用于所有关键系统和远程访问场景。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '需求调研和方案设计',
            description: '调研现有认证系统，评估业务场景，设计MFA实施方案',
            duration: '2周'
          },
          {
            stepNumber: 2,
            title: '技术选型和采购',
            description: '选择MFA解决方案，完成采购流程',
            duration: '3周'
          },
          {
            stepNumber: 3,
            title: '系统部署和集成',
            description: '部署MFA系统，与现有应用集成',
            duration: '4周'
          },
          {
            stepNumber: 4,
            title: '测试和优化',
            description: '进行功能测试、性能测试和用户体验优化',
            duration: '2周'
          },
          {
            stepNumber: 5,
            title: '培训和上线',
            description: '用户培训，分批上线',
            duration: '2周'
          }
        ],
        timeline: '3-4个月',
        responsibleDepartment: '信息安全部、IT运维部',
        expectedImprovement: 0.4,
        resourcesNeeded: {
          budget: '80-120万（含软件许可和实施费用）',
          personnel: ['安全架构师', '系统工程师', '运维工程师'],
          technology: ['MFA认证平台', 'IAM系统', '移动端APP'],
          training: '需要对管理员进行MFA系统管理培训，对用户进行使用培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['业务系统配合改造']
        },
        risks: [
          {
            risk: '用户可能对MFA操作流程不熟悉，导致短期工作效率下降',
            mitigation: '提供详细的操作指南和视频教程，设置7天适应期，期间允许降级认证'
          },
          {
            risk: '部分老旧系统可能不支持MFA集成',
            mitigation: '采用网关代理或VPN方案实现统一认证，逐步淘汰老旧系统'
          },
          {
            risk: '移动端网络不稳定可能影响认证成功率',
            mitigation: '支持多种认证方式（短信、邮件、令牌、生物识别），确保可用性'
          }
        ],
        kpiMetrics: [
          {
            metric: 'MFA覆盖率',
            target: '100%的关键系统账户',
            measurementMethod: '统计已启用MFA的账户数/总账户数'
          },
          {
            metric: '认证成功率',
            target: '≥99%',
            measurementMethod: '监控系统日志统计成功认证次数/总认证次数'
          },
          {
            metric: '未授权访问事件数',
            target: '0次/年',
            measurementMethod: '通过SIEM系统统计安全告警事件'
          }
        ]
      },
      {
        clusterName: '数据保护',
        clusterId: 'cluster_002',
        currentLevel: 2.3,
        targetLevel: 4.0,
        gap: 1.7,
        priority: 'high',
        title: '实施数据加密和脱敏技术',
        description: '建立全生命周期的数据保护机制，对敏感数据进行加密存储和传输，实施数据脱敏技术保护个人隐私。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '数据分类分级',
            description: '识别和分类所有敏感数据，制定数据分类分级标准',
            duration: '3周'
          },
          {
            stepNumber: 2,
            title: '加密方案设计',
            description: '设计数据库加密、传输加密、备份加密方案',
            duration: '2周'
          },
          {
            stepNumber: 3,
            title: '加密工具部署',
            description: '部署密钥管理系统和加密工具',
            duration: '4周'
          },
          {
            stepNumber: 4,
            title: '数据脱敏实施',
            description: '在开发和测试环境实施数据脱敏',
            duration: '3周'
          }
        ],
        timeline: '3-4个月',
        responsibleDepartment: '信息安全部、数据管理部',
        expectedImprovement: 0.35,
        resourcesNeeded: {
          budget: '150-200万（含加密软件和密钥管理系统）',
          personnel: ['数据安全工程师', 'DBA', '应用开发工程师'],
          technology: ['密钥管理系统', '数据库加密工具', '数据脱敏平台', 'TLS/SSL证书'],
          training: '加密技术培训、密钥管理培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['第三方安全评估机构']
        },
        risks: [
          {
            risk: '加密可能影响系统性能',
            mitigation: '采用硬件加密模块加速，优化加密算法'
          },
          {
            risk: '密钥管理复杂度高',
            mitigation: '建立完善的密钥生命周期管理流程，使用专业的KMS系统'
          }
        ],
        kpiMetrics: [
          {
            metric: '敏感数据加密覆盖率',
            target: '100%',
            measurementMethod: '已加密敏感数据字段数/总敏感数据字段数'
          },
          {
            metric: '数据泄露事件数',
            target: '0次/年',
            measurementMethod: '安全事件统计系统'
          }
        ]
      },
      {
        clusterName: '安全监控',
        clusterId: 'cluster_003',
        currentLevel: 1.8,
        targetLevel: 4.0,
        gap: 2.2,
        priority: 'high',
        title: '建立实时安全监控系统',
        description: '部署SIEM（安全信息和事件管理）系统，实现7x24小时安全监控和实时告警。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '需求分析和方案设计',
            description: '明确监控需求，设计SIEM架构',
            duration: '2周'
          },
          {
            stepNumber: 2,
            title: 'SIEM平台选型和采购',
            description: '评估主流SIEM产品，完成采购',
            duration: '3周'
          },
          {
            stepNumber: 3,
            title: '日志采集器部署',
            description: '在各系统部署日志采集代理',
            duration: '4周'
          },
          {
            stepNumber: 4,
            title: '规则和告警配置',
            description: '配置安全规则和告警阈值',
            duration: '3周'
          },
          {
            stepNumber: 5,
            title: 'SOC团队建设',
            description: '建立安全运营中心，培训分析师',
            duration: '6周'
          }
        ],
        timeline: '4-6个月',
        responsibleDepartment: '信息安全部、IT运维部',
        expectedImprovement: 0.5,
        resourcesNeeded: {
          budget: '200-300万（含SIEM软件、服务器、人员）',
          personnel: ['安全分析师', 'SOC工程师', '运维工程师'],
          technology: ['SIEM平台（如Splunk、QRadar）', '日志采集器', '告警通知系统'],
          training: 'SIEM平台培训、安全分析培训、应急响应培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['安全厂商技术支持']
        },
        risks: [
          {
            risk: '日志量过大可能影响性能',
            mitigation: '实施日志分级采集，优化存储策略'
          },
          {
            risk: '告警过多导致分析师疲劳',
            mitigation: '优化告警规则，建立告警分级和处理流程'
          }
        ],
        kpiMetrics: [
          {
            metric: '安全事件检测率',
            target: '≥95%',
            measurementMethod: '通过红队测试验证'
          },
          {
            metric: '平均响应时间(MTTR)',
            target: '≤4小时',
            measurementMethod: '统计告警到处置完成的时间'
          }
        ]
      },
      {
        clusterName: '安全策略与制度',
        clusterId: 'cluster_004',
        currentLevel: 2.5,
        targetLevel: 4.0,
        gap: 1.5,
        priority: 'medium',
        title: '完善数据安全管理制度体系',
        description: '建立完善的数据安全管理制度和流程，确保安全管理有章可循、有据可依。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '制度现状评估',
            description: '评估现有制度的完整性和有效性',
            duration: '2周'
          },
          {
            stepNumber: 2,
            title: '制度体系设计',
            description: '设计分级分类的制度体系框架',
            duration: '3周'
          },
          {
            stepNumber: 3,
            title: '制度编写和评审',
            description: '编写各项制度，组织专家评审',
            duration: '6周'
          },
          {
            stepNumber: 4,
            title: '发布和培训',
            description: '正式发布制度，开展全员培训',
            duration: '4周'
          }
        ],
        timeline: '3-4个月',
        responsibleDepartment: '信息安全部、合规部、人力资源部',
        expectedImprovement: 0.3,
        resourcesNeeded: {
          budget: '30-50万（咨询和培训费用）',
          personnel: ['合规经理', '法务', '培训专员'],
          technology: ['文档管理系统', '在线培训平台'],
          training: '制度编写培训、合规培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['外部法律顾问']
        },
        risks: [
          {
            risk: '制度执行不到位',
            mitigation: '建立制度执行的监督检查机制，纳入绩效考核'
          }
        ],
        kpiMetrics: [
          {
            metric: '制度完善度',
            target: '100%的关键领域有制度覆盖',
            measurementMethod: '制度覆盖率评估'
          },
          {
            metric: '员工培训覆盖率',
            target: '100%',
            measurementMethod: '培训系统统计数据'
          }
        ]
      },
      {
        clusterName: '合规管理',
        clusterId: 'cluster_005',
        currentLevel: 2.2,
        targetLevel: 4.0,
        gap: 1.8,
        priority: 'medium',
        title: '建立合规检查机制',
        description: '定期开展合规性评估，确保符合相关法律法规和标准要求。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '合规要求梳理',
            description: '梳理适用的法律法规和标准',
            duration: '2周'
          },
          {
            stepNumber: 2,
            title: '差距分析',
            description: '对照标准要求进行差距分析',
            duration: '3周'
          },
          {
            stepNumber: 3,
            title: '整改实施',
            description: '制定整改计划并实施',
            duration: '8周'
          },
          {
            stepNumber: 4,
            title: '定期审计',
            description: '建立定期内部审计机制',
            duration: '2周'
          }
        ],
        timeline: '4个月',
        responsibleDepartment: '合规部、信息安全部',
        expectedImprovement: 0.35,
        resourcesNeeded: {
          budget: '50-80万（审计和咨询费用）',
          personnel: ['合规经理', '内审员'],
          technology: ['合规管理系统', '文档管理工具'],
          training: '合规培训、审计培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['第三方审计机构']
        },
        risks: [
          {
            risk: '法规变化快，难以及时跟进',
            mitigation: '建立法规跟踪机制，订阅专业服务'
          }
        ],
        kpiMetrics: [
          {
            metric: '合规检查通过率',
            target: '100%',
            measurementMethod: '内外部审计结果'
          }
        ]
      },
      {
        clusterName: '安全培训与意识',
        clusterId: 'cluster_006',
        currentLevel: 2.0,
        targetLevel: 4.0,
        gap: 2.0,
        priority: 'low',
        title: '开展全员安全意识培训',
        description: '提升全员数据安全意识，建立安全文化。',
        implementationSteps: [
          {
            stepNumber: 1,
            title: '培训需求分析',
            description: '分析不同岗位的培训需求',
            duration: '2周'
          },
          {
            stepNumber: 2,
            title: '培训内容开发',
            description: '开发在线课程和线下培训材料',
            duration: '4周'
          },
          {
            stepNumber: 3,
            title: '培训实施',
            description: '分批次开展全员培训',
            duration: '6周'
          },
          {
            stepNumber: 4,
            title: '效果评估',
            description: '通过测试和模拟钓鱼评估效果',
            duration: '2周'
          }
        ],
        timeline: '3-4个月',
        responsibleDepartment: '人力资源部、信息安全部',
        expectedImprovement: 0.25,
        resourcesNeeded: {
          budget: '20-40万（培训平台和讲师费用）',
          personnel: ['培训专员', '安全工程师'],
          technology: ['在线培训平台', '模拟钓鱼系统'],
          training: 'TTT培训师培训'
        },
        dependencies: {
          prerequisiteMeasures: [],
          externalDependencies: ['安全培训机构']
        },
        risks: [
          {
            risk: '员工参与度不高',
            mitigation: '采用游戏化培训，设置奖励机制'
          }
        ],
        kpiMetrics: [
          {
            metric: '培训覆盖率',
            target: '100%',
            measurementMethod: '培训系统统计'
          },
          {
            metric: '安全测试平均分',
            target: '≥90分',
            measurementMethod: '培训后测试成绩'
          }
        ]
      }
    ]
  };

  // 更新任务
  const taskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';

  const updateResult = await client.query(`
    UPDATE ai_tasks
    SET result = $1,
        status = 'completed',
        completed_at = '2025-12-30 17:55:56',
        progress = 100
    WHERE id = $2
    RETURNING id, status
  `, [JSON.stringify(detailedResult), taskId]);

  console.log('\n✅ 任务更新成功!');
  console.log('任务ID:', updateResult.rows[0].id);
  console.log('状态:', updateResult.rows[0].status);
  console.log('\n数据概要:');
  console.log('- 总措施数:', detailedResult.measures.length);
  console.log('- 领域数:', detailedResult.metadata.clusterCount);
  console.log('- 目标成熟度:', detailedResult.metadata.targetMaturity);
  console.log('\n措施列表:');
  detailedResult.measures.forEach((m, idx) => {
    console.log(\`\${idx + 1}. \${m.clusterName} - \${m.title}\`);
    console.log(\`   优先级: \${m.priority}, 步骤数: \${m.implementationSteps.length}, 风险数: \${m.risks.length}, KPI数: \${m.kpiMetrics.length}\`);
  });

  await client.end();
}

update().catch(console.error);
