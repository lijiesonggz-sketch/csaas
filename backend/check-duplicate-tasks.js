const { Client } = require('pg');

async function checkDuplicateTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskIds = [
      '373ad9cb-9001-4943-92a5-a1e57fa13f3f',
      '40be5cfa-ae35-4e4a-b5f1-ec8ca41feb82'
    ];

    console.log('='.repeat(80));
    console.log('检查两个重复生成的改进措施任务状态\n');

    for (const taskId of taskIds) {
      console.log('📋 任务ID:', taskId);
      console.log('-'.repeat(80));

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
          input,
          result
        FROM ai_tasks
        WHERE id = $1
      `, [taskId]);

      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0];

        console.log('状态:', task.status);
        console.log('进度:', task.progress, '%');
        console.log('创建时间:', task.created_at);
        console.log('更新时间:', task.updated_at);
        console.log('完成时间:', task.completed_at || '(未完成)');

        if (task.input) {
          const input = JSON.parse(task.input);
          console.log('输入参数:');
          console.log('  - survey_response_id:', input.survey_response_id);
          console.log('  - 当前成熟度:', input.current_maturity?.toFixed(2));
          console.log('  - 目标成熟度:', input.target_maturity);
          console.log('  - 差距:', input.gap?.toFixed(2));
        }

        if (task.error_message) {
          console.log('❌ 错误信息:', task.error_message);
        }

        // 查询措施数量
        const measuresResult = await client.query(`
          SELECT
            COUNT(*) as total_count,
            cluster_name,
            COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
          GROUP BY cluster_name
          ORDER BY cluster_name
        `, [taskId]);

        const totalCount = await client.query(`
          SELECT COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
        `, [taskId]);

        console.log('✅ 已生成措施数量:', totalCount.rows[0].count, '条');

        if (measuresResult.rows.length > 0) {
          console.log('按聚类分组:');
          measuresResult.rows.forEach(row => {
            console.log(`  - ${row.cluster_name}: ${row.count}条`);
          });
        }

      } else {
        console.log('⚠️  未找到该任务');
      }

      console.log('');
    }

    // 查询是否还有其他action_plan任务
    console.log('='.repeat(80));
    console.log('最近的5个action_plan任务:');
    console.log('-'.repeat(80));

    const recentTasks = await client.query(`
      SELECT
        id,
        status,
        progress,
        created_at,
        completed_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    recentTasks.rows.forEach((task, index) => {
      const isHighlighted = taskIds.includes(task.id);
      const marker = isHighlighted ? ' 👈 当前检查的任务' : '';
      console.log(`${index + 1}. ${task.id}`);
      console.log(`   状态: ${task.status.padEnd(12)} 进度: ${task.progress}%`);
      console.log(`   创建: ${task.created_at}`);
      if (task.completed_at) {
        console.log(`   完成: ${task.completed_at}`);
      }
      console.log(marker);
    });

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkDuplicateTasks();
