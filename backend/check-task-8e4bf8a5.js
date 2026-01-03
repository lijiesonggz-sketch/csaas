const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskId = '8e4bf8a5-1456-4176-b206-6973326932fa';

    console.log('查询任务状态:', taskId);
    console.log('='.repeat(80));

    // 查询任务信息
    const taskResult = await client.query(`
      SELECT
        id,
        type,
        status,
        created_at,
        updated_at,
        completed_at,
        progress,
        error_message,
        input
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];

      console.log('📋 基本信息:');
      console.log('  状态:', task.status);
      console.log('  进度:', task.progress, '%');
      console.log('  创建时间:', task.created_at);
      console.log('  更新时间:', task.updated_at);
      console.log('  完成时间:', task.completed_at || '(未完成)');

      if (task.error_message) {
        console.log('\n❌ 错误信息:');
        console.log(' ', task.error_message);
      }

      // 解析input
      if (task.input) {
        try {
          const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;
          console.log('\n📥 输入参数:');
          console.log('  survey_response_id:', input.survey_response_id);
          console.log('  当前成熟度:', input.current_maturity?.toFixed(2));
          console.log('  目标成熟度:', input.target_maturity);
          console.log('  差距:', input.gap?.toFixed(2));
        } catch (e) {
          console.log('\n📥 输入参数: (无法解析)');
        }
      }

      // 查询措施数量
      const measuresResult = await client.query(`
        SELECT COUNT(*) as count
        FROM action_plan_measures
        WHERE task_id = $1
      `, [taskId]);

      console.log('\n📊 生成的措施:');
      console.log('  措施数量:', measuresResult.rows[0].count, '条');

      if (measuresResult.rows[0].count > 0) {
        // 查询聚类分布
        const clusterResult = await client.query(`
          SELECT
            cluster_name,
            COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
          GROUP BY cluster_name
          ORDER BY count DESC
        `, [taskId]);

        console.log('\n  按聚类分布:');
        clusterResult.rows.forEach(row => {
          console.log(`    - ${row.cluster_name}: ${row.count}条`);
        });
      }

      // 根据状态给出建议
      console.log('\n💡 状态说明:');
      if (task.status === 'completed') {
        console.log('  ✅ 任务已完成，可以查看生成的改进措施');
      } else if (task.status === 'failed') {
        console.log('  ❌ 任务失败，查看错误信息了解原因');
        console.log('  💡 建议：代码已恢复到12-30成功版本，可以重新生成');
      } else if (task.status === 'processing') {
        console.log('  ⏳ 任务正在处理中，进度:', task.progress, '%');
        console.log('  💡 请耐心等待，可能需要几分钟时间');
      } else {
        console.log('  ⏸️  任务等待处理');
      }

    } else {
      console.log('❌ 未找到该任务');
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkTask();
