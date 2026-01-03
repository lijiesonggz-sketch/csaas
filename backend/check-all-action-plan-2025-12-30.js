const { Client } = require('pg');

async function checkAllActionPlansByDate() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询2025年12月30日的所有action_plan任务
    const result = await client.query(`
      SELECT id, type, status, created_at, updated_at, completed_at, progress,
             LENGTH(result::text) as result_length
      FROM ai_tasks
      WHERE type = 'action_plan'
        AND created_at >= '2025-12-30 00:00:00'
        AND created_at < '2025-12-31 00:00:00'
      ORDER BY created_at DESC
    `);

    if (result.rows.length > 0) {
      console.log('2025年12月30日的所有action_plan任务（按创建时间排序）：');
      console.log('='.repeat(100));

      for (const t of result.rows) {
        const createdTime = new Date(t.created_at);
        const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);
        const hour = beijingTime.getHours();
        const timePeriod = hour < 12 ? '上午' : '下午';

        console.log(`\n[${timePeriod}] 任务ID: ${t.id}`);
        console.log(`状态: ${t.status}`);
        console.log(`创建时间: ${t.created_at} (北京时间 ${beijingTime.toLocaleString('zh-CN')})`);
        console.log(`完成时间: ${t.completed_at || '(未完成)'}`);
        console.log(`进度: ${t.progress} %`);
        console.log(`结果长度: ${t.result_length || 0} 字符`);
        console.log('-'.repeat(100));
      }

      // 找结果最长的已完成任务
      const completedTasks = result.rows.filter(t => t.status === 'completed');
      if (completedTasks.length > 0) {
        const longestTask = completedTasks.reduce((prev, current) =>
          (prev.result_length || 0) > (current.result_length || 0) ? prev : current
        );

        console.log('\n\n' + '='.repeat(100));
        console.log('结果最长的已完成任务：');
        console.log('='.repeat(100));
        console.log('任务ID:', longestTask.id);

        const taskDetail = await client.query(`
          SELECT result, input
          FROM ai_tasks
          WHERE id = $1
        `, [longestTask.id]);

        if (taskDetail.rows[0].result) {
          const result = taskDetail.rows[0].result;

          console.log('\n结果摘要:');
          if (result.summary) console.log('标题:', result.summary);
          if (result.metadata) console.log('元数据:', JSON.stringify(result.metadata, null, 2));
          if (result.improvements) {
            console.log(`\n改进措施数量: ${result.improvements.length} 个领域`);

            // 统计所有action的数量
            let totalActions = 0;
            result.improvements.forEach(imp => {
              if (imp.actions && Array.isArray(imp.actions)) {
                totalActions += imp.actions.length;
              }
            });
            console.log(`总措施数量: ${totalActions} 条`);

            console.log('\n所有领域:');
            result.improvements.forEach((imp, idx) => {
              console.log(`\n${idx + 1}. ${imp.area || '未知领域'} (${imp.priority || '未知优先级'}/${imp.timeline || '无时间线'})`);
              if (imp.actions && Array.isArray(imp.actions)) {
                console.log(`   措施数量: ${imp.actions.length} 条`);
                imp.actions.forEach((action, actionIdx) => {
                  console.log(`   ${actionIdx + 1}. ${action}`);
                });
              }
            });
          }
        }
      }
    } else {
      console.log('未找到2025年12月30日的action_plan任务');
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkAllActionPlansByDate();
