const { Client } = require('pg');

async function checkActionPlanByDate() {
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
      SELECT id, type, status, created_at, updated_at, completed_at, progress, error_message
      FROM ai_tasks
      WHERE type = 'action_plan'
        AND created_at >= '2025-12-30 00:00:00'
        AND created_at < '2025-12-31 00:00:00'
      ORDER BY created_at DESC
    `);

    if (result.rows.length > 0) {
      console.log('找到', result.rows.length, '个2025年12月30日的action_plan任务：');
      console.log('='.repeat(80));

      for (const t of result.rows) {
        console.log('\n任务ID:', t.id);
        console.log('状态:', t.status);
        console.log('创建时间:', t.created_at);
        console.log('完成时间:', t.completed_at || '(未完成)');
        console.log('进度:', t.progress, '%');
        console.log('错误信息:', t.error_message || '(无)');

        // 如果有结果，显示结果长度
        const resultCheck = await client.query(`
          SELECT LENGTH(result::text) as result_length
          FROM ai_tasks
          WHERE id = $1
        `, [t.id]);

        if (resultCheck.rows[0].result_length) {
          console.log('结果长度:', resultCheck.rows[0].result_length, '字符');
        }

        console.log('-'.repeat(80));
      }

      console.log('\n='.repeat(80));

      // 查询第一个已完成任务的详细结果
      const firstCompleted = result.rows.find(t => t.status === 'completed');
      if (firstCompleted) {
        console.log('\n显示第一个已完成任务的详细结果：');
        console.log('任务ID:', firstCompleted.id);

        const taskDetail = await client.query(`
          SELECT id, result, input
          FROM ai_tasks
          WHERE id = $1
        `, [firstCompleted.id]);

        if (taskDetail.rows[0].result) {
          console.log('\n结果内容:');
          console.log(JSON.stringify(taskDetail.rows[0].result, null, 2));
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

checkActionPlanByDate();
