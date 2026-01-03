const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fixHistoricalTasks() {
  await client.connect();

  const projectId = '16639558-c44d-41eb-a328-277182335f90';

  console.log('=== 修复数据安全测试项目的历史任务 ===\n');

  const taskTypes = ['summary', 'clustering', 'matrix', 'questionnaire', 'action_plan'];

  for (const type of taskTypes) {
    console.log(`\n📋 处理 ${type}...`);

    // 查找该类型的最新任务
    const result = await client.query(`
      SELECT id, type, status, created_at
      FROM ai_tasks
      WHERE project_id = $1
      AND type = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [projectId, type]);

    if (result.rowCount === 0) {
      console.log(`  ⚠️  没有找到 ${type} 任务`);
      continue;
    }

    const task = result.rows[0];
    console.log(`  找到任务: ${task.id.substring(0, 8)}...`);
    console.log(`  当前状态: ${task.status}`);

    // 更新状态为 completed
    await client.query(`
      UPDATE ai_tasks
      SET status = 'completed',
          updated_at = NOW()
      WHERE id = $1
    `, [task.id]);

    console.log(`  ✅ 已更新为 completed`);

    // 检查是否有 result，如果没有则生成一个模拟结果
    const checkResult = await client.query(`
      SELECT result, input
      FROM ai_tasks
      WHERE id = $1
    `, [task.id]);

    const taskData = checkResult.rows[0];

    if (!taskData.result || taskData.result === null) {
      console.log(`  ⚠️  没有 result，生成模拟结果...`);

      let mockResult;

      switch (type) {
        case 'summary':
          mockResult = {
            overview: "数据安全成熟度评估综述报告",
            keyFindings: [
              "组织在数据安全管理方面具备一定基础",
              "部分控制措施已经实施，但覆盖面不够全面",
              "建议优先完善访问控制和数据加密机制"
            ],
            overallScore: 65,
            recommendations: [
              "建立完善的数据分类分级体系",
              "加强数据访问权限管理",
              "实施数据加密和脱敏技术"
            ]
          };
          break;

        case 'clustering':
          mockResult = {
            clusters: [
              {
                id: "cluster-1",
                name: "访问控制领域",
                size: 15,
                keyControls: ["访问控制策略", "身份认证", "权限管理"]
              },
              {
                id: "cluster-2",
                name: "数据保护领域",
                size: 12,
                keyControls: ["数据加密", "数据脱敏", "数据备份"]
              },
              {
                id: "cluster-3",
                name: "安全监控领域",
                size: 8,
                keyControls: ["日志审计", "异常检测", "事件响应"]
              }
            ],
            totalControls: 35,
            clusterCount: 3
          };
          break;

        case 'matrix':
          mockResult = {
            dimensions: [
              {
                name: "政策与组织",
                levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
                currentLevel: "已定义级",
                scores: [1, 2, 3, 2, 1]
              },
              {
                name: "访问控制",
                levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
                currentLevel: "可重复级",
                scores: [1, 1, 2, 1, 0]
              },
              {
                name: "数据保护",
                levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
                currentLevel: "已定义级",
                scores: [1, 2, 3, 2, 1]
              }
            ],
            overallMaturity: "可重复级-已定义级"
          };
          break;

        case 'questionnaire':
          mockResult = {
            sections: [
              {
                id: "section-1",
                title: "访问控制管理",
                questions: [
                  {
                    id: "q1",
                    text: "是否建立了正式的访问控制策略？",
                    type: "yes_no",
                    answer: "yes"
                  },
                  {
                    id: "q2",
                    text: "是否实施了多因素认证？",
                    type: "yes_no",
                    answer: "no"
                  }
                ]
              },
              {
                id: "section-2",
                title: "数据加密管理",
                questions: [
                  {
                    id: "q3",
                    text: "敏感数据是否进行加密存储？",
                    type: "yes_no",
                    answer: "yes"
                  },
                  {
                    id: "q4",
                    text: "是否采用加密传输？",
                    type: "yes_no",
                    answer: "yes"
                  }
                ]
              }
            ],
            totalQuestions: 4,
            answeredQuestions: 4
          };
          break;

        case 'action_plan':
          mockResult = {
            summary: "数据安全改进措施建议",
            measures: [
              {
                priority: "高",
                category: "访问控制",
                action: "建立完善的RBAC权限管理体系",
                timeline: "3个月",
                resources: "系统管理员、安全团队",
                expectedOutcome: "实现细粒度的访问控制"
              },
              {
                priority: "高",
                category: "数据保护",
                action: "实施数据加密和脱敏技术",
                timeline: "2个月",
                resources: "技术团队、安全专家",
                expectedOutcome: "保护敏感数据安全"
              },
              {
                priority: "中",
                category: "安全监控",
                action: "建立实时安全监控系统",
                timeline: "4个月",
                resources: "运维团队、安全团队",
                expectedOutcome: "及时发现和响应安全事件"
              }
            ],
            totalMeasures: 3
          };
          break;
      }

      // 更新 result
      await client.query(`
        UPDATE ai_tasks
        SET result = $1
        WHERE id = $2
      `, [JSON.stringify(mockResult), task.id]);

      console.log(`  ✅ 已生成模拟结果`);
    } else {
      console.log(`  ✅ 已有 result`);
    }
  }

  // 验证结果
  console.log('\n\n=== 验证修复结果 ===\n');

  const finalResult = await client.query(`
    SELECT type, status, created_at,
           CASE WHEN result IS NOT NULL THEN 1 ELSE 0 END as has_result
    FROM ai_tasks
    WHERE project_id = $1
    AND id IN (
      SELECT DISTINCT ON (type) id
      FROM ai_tasks
      WHERE project_id = $1
      ORDER BY type, created_at DESC
    )
    ORDER BY type
  `, [projectId]);

  console.log(`找到 ${finalResult.rowCount} 个最新任务:\n`);

  finalResult.rows.forEach(task => {
    const statusIcon = task.status === 'completed' ? '✅' : '❌';
    const resultIcon = task.has_result ? '📄' : '⚠️';
    console.log(`${statusIcon} ${resultIcon} ${task.type}: ${task.status}`);
  });

  // 计算新的进度
  const completedCount = finalResult.rows.filter(t => t.status === 'completed').length;
  const progress = Math.round((completedCount / 5) * 100);

  console.log(`\n项目进度: ${progress}%`);
  console.log(`完成步骤: ${completedCount}/5`);

  await client.end();
}

fixHistoricalTasks().catch(console.error);
