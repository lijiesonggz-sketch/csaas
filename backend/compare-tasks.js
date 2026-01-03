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

    // 查询12月30日的任务
    const oldResult = await client.query(`
      SELECT
        title,
        description,
        responsible_department,
        resources_needed,
        dependencies,
        risks,
        expected_improvement,
        cluster_name,
        current_level,
        target_level,
        gap
      FROM action_plan_measures
      WHERE task_id = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4'
      LIMIT 2
    `);

    console.log('📅 12月30日任务 (d5e35635) 措施结构:');
    console.log(JSON.stringify(oldResult.rows, null, 2));

    // 查询最新任务
    const newResult = await client.query(`
      SELECT
        title,
        description,
        responsible_department,
        resources_needed,
        dependencies,
        risks,
        expected_improvement,
        cluster_name,
        current_level,
        target_level,
        gap
      FROM action_plan_measures
      WHERE task_id = '3263fb92-e5ec-4bdb-b4bb-43965ae11caf'
      LIMIT 2
    `);

    console.log('\n🆕 最新任务 (3263fb92) 措施结构:');
    console.log(JSON.stringify(newResult.rows, null, 2));

    // 对比字段结构
    console.log('\n📊 字段对比:');
    const oldFields = Object.keys(oldResult.rows[0] || {});
    const newFields = Object.keys(newResult.rows[0] || {});
    console.log('12月30日字段:', oldFields);
    console.log('最新任务字段:', newFields);
    console.log('差异:', newFields.filter(f => !oldFields.includes(f)), oldFields.filter(f => !newFields.includes(f)));

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

compareTasks();
