const { Client } = require('pg');

async function checkSurroundingDays() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询12月28日-1月2日的所有action_plan任务
    const result = await client.query(`
      SELECT id, type, status, created_at, completed_at,
             LENGTH(result::text) as result_length
      FROM ai_tasks
      WHERE type = 'action_plan'
        AND created_at >= '2025-12-28 00:00:00'
        AND created_at < '2026-01-03 00:00:00'
        AND status = 'completed'
        AND result IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log('所有已完成的action_plan任务（12月28日-1月2日）：');
    console.log('='.repeat(100));

    for (const t of result.rows) {
      const createdTime = new Date(t.created_at);
      const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);
      const dateStr = beijingTime.toLocaleDateString('zh-CN');
      const timeStr = beijingTime.toLocaleTimeString('zh-CN');

      console.log(`\n${dateStr} ${timeStr}`);
      console.log(`任务ID: ${t.id}`);
      console.log(`结果长度: ${t.result_length} 字符`);

      // 获取任务结果的摘要信息
      const taskDetail = await client.query(`
        SELECT result
        FROM ai_tasks
        WHERE id = $1
      `, [t.id]);

      if (taskDetail.rows[0].result) {
        const result = taskDetail.rows[0].result;
        if (result.metadata && result.metadata.totalMeasures) {
          console.log(`元数据中的措施总数: ${result.metadata.totalMeasures}`);
        }
        if (result.improvements) {
          let totalActions = 0;
          result.improvements.forEach(imp => {
            if (imp.actions && Array.isArray(imp.actions)) {
              totalActions += imp.actions.length;
            }
          });
          console.log(`实际措施总数: ${totalActions} 条 (${result.improvements.length} 个领域)`);
        }
      }
      console.log('-'.repeat(100));
    }

    // 找实际措施最多的任务
    console.log('\n\n' + '='.repeat(100));
    console.log('正在分析所有任务，找出措施最多的...');
    console.log('='.repeat(100));

    let maxActions = 0;
    let maxTaskId = null;
    let maxTaskDetail = null;

    for (const t of result.rows) {
      const taskDetail = await client.query(`
        SELECT result
        FROM ai_tasks
        WHERE id = $1
      `, [t.id]);

      if (taskDetail.rows[0].result && taskDetail.rows[0].result.improvements) {
        let totalActions = 0;
        taskDetail.rows[0].result.improvements.forEach(imp => {
          if (imp.actions && Array.isArray(imp.actions)) {
            totalActions += imp.actions.length;
          }
        });

        if (totalActions > maxActions) {
          maxActions = totalActions;
          maxTaskId = t.id;
          maxTaskDetail = taskDetail.rows[0].result;
        }
      }
    }

    if (maxTaskDetail) {
      console.log(`\n措施最多的任务（共 ${maxActions} 条措施）：`);
      console.log('任务ID:', maxTaskId);

      const createdTime = new Date(result.rows.find(t => t.id === maxTaskId).created_at);
      const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);
      console.log('创建时间:', beijingTime.toLocaleString('zh-CN'));

      console.log('\n标题:', maxTaskDetail.summary || '(无)');
      if (maxTaskDetail.metadata) {
        console.log('元数据:', JSON.stringify(maxTaskDetail.metadata, null, 2));
      }

      console.log(`\n改进措施共 ${maxTaskDetail.improvements.length} 个领域，${maxActions} 条措施：`);

      maxTaskDetail.improvements.forEach((imp, idx) => {
        console.log(`\n${idx + 1}. ${imp.area || '未知领域'}`);
        console.log(`   优先级: ${imp.priority || '未知'}`);
        console.log(`   时间线: ${imp.timeline || '未知'}`);
        console.log(`   措施数量: ${imp.actions?.length || 0} 条`);
        if (imp.actions && Array.isArray(imp.actions)) {
          imp.actions.forEach((action, actionIdx) => {
            console.log(`   ${actionIdx + 1}. ${action}`);
          });
        }
      });
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkSurroundingDays();
