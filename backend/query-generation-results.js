const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres',
});

async function queryGenerationResults() {
  try {
    await client.connect();

    // 查询所有问卷生成结果
    const result = await client.query(`
      SELECT
        r.id,
        r.task_id,
        r.generation_type,
        r.selected_model,
        r.created_at,
        t.status as task_status
      FROM ai_generation_results r
      LEFT JOIN ai_tasks t ON r.task_id = t.id
      WHERE r.generation_type = 'questionnaire'
      ORDER BY r.created_at DESC
      LIMIT 5
    `);

    console.log('\n=== 问卷生成结果 ===\n');

    if (result.rows.length === 0) {
      console.log('未找到问卷生成结果');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. 结果ID: ${row.id}`);
        console.log(`   任务ID: ${row.task_id}`);
        console.log(`   任务状态: ${row.task_status}`);
        console.log(`   生成类型: ${row.generation_type}`);
        console.log(`   选择的模型: ${row.selected_model}`);
        console.log(`   创建时间: ${row.created_at}`);
        console.log('');
      });

      console.log(`\n✅ 最新的问卷生成任务ID（有结果）: ${result.rows[0].task_id}`);
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await client.end();
  }
}

queryGenerationResults();
