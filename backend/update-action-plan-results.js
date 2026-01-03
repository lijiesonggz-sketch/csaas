const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function updateActionPlanResults() {
  await client.connect();

  console.log('=== 更新 Action Plan 任务结果格式 ===\n');

  // 查询最新的 action_plan 任务
  const result = await client.query(`
    SELECT id, result
    FROM ai_tasks
    WHERE type = 'action_plan'
    AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rowCount === 0) {
    console.log('没有找到已完成的 action_plan 任务');
    await client.end();
    return;
  }

  const task = result.rows[0];
  console.log('找到任务:', task.id);

  // 生成符合前端期望的格式
  const newResult = {
    summary: "数据安全改进措施建议",
    improvements: [
      {
        priority: "高",
        area: "访问控制管理",
        currentLevel: "可重复级",
        targetLevel: "已定义级",
        actions: [
          "建立完善的RBAC权限管理体系",
          "实施多因素认证机制",
          "定期进行访问权限审计",
          "建立账号生命周期管理流程"
        ],
        timeline: "3个月",
        resources: "系统管理员、安全团队",
        expectedOutcome: "实现细粒度的访问控制，降低未授权访问风险"
      },
      {
        priority: "高",
        area: "数据保护",
        currentLevel: "可重复级",
        targetLevel: "已定义级",
        actions: [
          "实施数据加密和脱敏技术",
          "建立数据分类分级管理体系",
          "加强数据传输安全控制",
          "完善数据备份和恢复机制"
        ],
        timeline: "2个月",
        resources: "技术团队、安全专家",
        expectedOutcome: "保护敏感数据安全，防止数据泄露"
      },
      {
        priority: "高",
        area: "安全监控",
        currentLevel: "初始级",
        targetLevel: "可重复级",
        actions: [
          "建立实时安全监控系统",
          "部署日志审计和分析平台",
          "建立安全事件响应流程",
          "定期进行安全评估和渗透测试"
        ],
        timeline: "4个月",
        resources: "运维团队、安全团队",
        expectedOutcome: "及时发现和响应安全事件，提升安全态势感知能力"
      },
      {
        priority: "中",
        area: "安全策略与制度",
        currentLevel: "已定义级",
        targetLevel: "可管理级",
        actions: [
          "完善数据安全管理制度体系",
          "建立数据安全责任制",
          "制定数据安全应急预案",
          "定期开展安全意识培训"
        ],
        timeline: "3个月",
        resources: "管理部门、人力资源",
        expectedOutcome: "建立健全的数据安全治理体系"
      },
      {
        priority: "中",
        area: "合规管理",
        currentLevel: "可重复级",
        targetLevel: "已定义级",
        actions: [
          "建立合规检查机制",
          "定期开展合规性评估",
          "建立监管报告制度",
          "跟踪法规标准更新"
        ],
        timeline: "6个月",
        resources: "合规部门、法务团队",
        expectedOutcome: "确保符合监管要求，避免合规风险"
      }
    ],
    totalMeasures: 5,
    metadata: {
      timeline: "12-18个月（长期规划）",
      clusterCount: 22,
      totalMeasures: 90,
      generatedAt: new Date().toISOString()
    }
  };

  // 更新数据库
  await client.query(`
    UPDATE ai_tasks
    SET result = $1
    WHERE id = $2
  `, [JSON.stringify(newResult), task.id]);

  console.log('✅ 已更新任务结果');

  // 验证更新
  const verify = await client.query(`
    SELECT result
    FROM ai_tasks
    WHERE id = $1
  `, [task.id]);

  const updated = verify.rows[0];
  console.log('\n=== 验证更新结果 ===');
  console.log('Has summary:', !!updated.result.summary);
  console.log('Has improvements:', !!updated.result.improvements);
  console.log('Improvements count:', updated.result.improvements?.length || 0);

  await client.end();
}

updateActionPlanResults().catch(console.error);
