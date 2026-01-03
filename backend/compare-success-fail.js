const { Client } = require('pg');

async function compareTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 成功的任务
    const successTaskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';
    // 失败的任务
    const failedTaskId = '40be5cfa-ae35-4e4a-b5f1-ec8ca41feb82';

    console.log('='.repeat(80));
    console.log('成功任务 vs 失败任务对比');
    console.log('='.repeat(80));

    // 查询成功任务
    const successResult = await client.query(`
      SELECT id, status, created_at, completed_at, progress, input, result
      FROM ai_tasks
      WHERE id = $1
    `, [successTaskId]);

    // 查询失败任务
    const failedResult = await client.query(`
      SELECT id, status, created_at, completed_at, progress, input, result, error_message
      FROM ai_tasks
      WHERE id = $1
    `, [failedTaskId]);

    if (successResult.rows.length > 0) {
      const task = successResult.rows[0];
      console.log('\n✅ 成功任务:');
      console.log('ID:', task.id);
      console.log('创建时间:', task.created_at);
      console.log('完成时间:', task.completed_at);
      console.log('状态:', task.status);
      console.log('进度:', task.progress, '%');

      if (task.input) {
        try {
          const input = JSON.parse(task.input);
          console.log('\n输入参数:');
          console.log('  - survey_response_id:', input.survey_response_id);
          console.log('  - 当前成熟度:', input.current_maturity?.toFixed(2));
          console.log('  - 目标成熟度:', input.target_maturity);
          console.log('  - 差距:', input.gap?.toFixed(2));
        } catch (e) {
          console.log('  (无法解析input)');
        }
      }

      if (task.result) {
        console.log('\n结果摘要:');
        console.log('  - 总措施数:', task.result.total_measures);
        console.log('  - 聚类数:', task.result.cluster_count);
        console.log('  - 时间线:', task.result.timeline);
      }

      // 查询措施详情
      const measuresResult = await client.query(`
        SELECT
          cluster_name,
          COUNT(*) as count,
          AVG(expected_improvement) as avg_improvement
        FROM action_plan_measures
        WHERE task_id = $1
        GROUP BY cluster_name
        ORDER BY cluster_name
      `, [successTaskId]);

      console.log('\n按聚类分组的措施:');
      measuresResult.rows.forEach(row => {
        console.log(`  - ${row.cluster_name}: ${row.count}条 (平均提升: ${row.avg_improvement.toFixed(2)})`);
      });
    }

    if (failedResult.rows.length > 0) {
      const task = failedResult.rows[0];
      console.log('\n\n❌ 失败任务:');
      console.log('ID:', task.id);
      console.log('创建时间:', task.created_at);
      console.log('状态:', task.status);
      console.log('进度:', task.progress, '%');
      console.log('错误:', task.error_message);

      if (task.input) {
        try {
          const input = JSON.parse(task.input);
          console.log('\n输入参数:');
          console.log('  - survey_response_id:', input.survey_response_id);
          console.log('  - 当前成熟度:', input.current_maturity?.toFixed(2));
          console.log('  - 目标成熟度:', input.target_maturity);
          console.log('  - 差距:', input.gap?.toFixed(2));
        } catch (e) {
          console.log('  (无法解析input)');
        }
      }
    }

    // 对比分析
    console.log('\n\n' + '='.repeat(80));
    console.log('关键差异分析:');
    console.log('='.repeat(80));

    // 检查成功任务创建时的AI响应文件
    const successDate = new Date(successResult.rows[0].created_at);
    console.log('\n成功任务创建时间:', successDate.toISOString());
    console.log('失败任务创建时间:', failedResult.rows[0].created_at);

    // 查找那个时间段的AI响应文件
    console.log('\n建议检查:');
    console.log('1. 查看2025-12-30的AI响应文件,对比JSON格式');
    console.log('2. 检查action-plan.prompts.ts是否有变化');
    console.log('3. 检查action-plan-generation.service.ts的fixJSON方法是否有变化');

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

compareTasks();
