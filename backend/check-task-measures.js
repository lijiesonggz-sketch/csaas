const { Client } = require('pg');

const taskId = '3263fb92-e5ec-4bdb-b4bb-43965ae11caf';

async function checkMeasures() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询总数
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM action_plan_measures WHERE task_id = $1',
      [taskId]
    );
    console.log('数据库中措施数量:', countResult.rows[0].count, '条');

    // 查询示例
    const sampleResult = await client.query(
      'SELECT title, cluster_name, priority FROM action_plan_measures WHERE task_id = $1 LIMIT 5',
      [taskId]
    );
    console.log('\n示例措施:');
    sampleResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. [${row.cluster_name}] ${row.title} (${row.priority})`);
    });

    // 测试API查询
    const apiResult = await client.query(
      `SELECT am.*, json_build_object(
        'id', t.id,
        'type', t.type,
        'status', t.status,
        'result', t.result
      ) as task_info
      FROM action_plan_measures am
      LEFT JOIN ai_tasks t ON am.task_id = t.id
      WHERE am.task_id = $1
      LIMIT 1`,
      [taskId]
    );

    if (apiResult.rows.length > 0) {
      console.log('\n✅ 数据关联正常');
      console.log('任务ID:', apiResult.rows[0].task_info.id);
      console.log('任务状态:', apiResult.rows[0].task_info.status);
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkMeasures();
