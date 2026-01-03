const { Client } = require('pg');

async function cleanProjectFailedTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const projectId = '8e815c62-f034-4497-8eab-a6f37d42b3d9';

    // 查看要删除的任务
    const result = await client.query(`
      SELECT id, type, status, created_at
      FROM ai_tasks
      WHERE project_id = $1 AND status = 'failed'
      ORDER BY created_at DESC
    `, [projectId]);

    console.log(`📋 找到 ${result.rows.length} 个失败任务:\n`);
    result.rows.forEach((task, i) => {
      console.log(`${i + 1}. ${task.type} - ${task.id}`);
    });

    if (result.rows.length === 0) {
      console.log('✅ 没有失败任务需要删除');
      return;
    }

    // 执行删除（先删除关联数据）
    console.log('\n🗑️  正在删除...');

    // 先删除关联的 generation_events
    const eventsResult = await client.query(`
      DELETE FROM ai_generation_events
      WHERE task_id = ANY($1)
      RETURNING task_id
    `, [result.rows.map(r => r.id)]);

    console.log(`  ✓ 删除了 ${eventsResult.rowCount} 条 generation_events 记录`);

    // 删除关联的 cost_tracking
    const costResult = await client.query(`
      DELETE FROM ai_cost_tracking
      WHERE task_id = ANY($1)
      RETURNING task_id
    `, [result.rows.map(r => r.id)]);

    console.log(`  ✓ 删除了 ${costResult.rowCount} 条 cost_tracking 记录`);

    // 删除关联的 action_plan_measures
    const measuresResult = await client.query(`
      DELETE FROM action_plan_measures
      WHERE task_id = ANY($1)
      RETURNING task_id
    `, [result.rows.map(r => r.id)]);

    console.log(`  ✓ 删除了 ${measuresResult.rowCount} 条 action_plan_measures 记录`);

    // 最后删除任务本身
    const deleteResult = await client.query(`
      DELETE FROM ai_tasks
      WHERE project_id = $1 AND status = 'failed'
      RETURNING id, type
    `, [projectId]);

    console.log(`✅ 成功删除 ${deleteResult.rows.length} 个失败任务\n`);

    // 按类型统计
    const typeStats = {};
    deleteResult.rows.forEach(row => {
      typeStats[row.type] = (typeStats[row.type] || 0) + 1;
    });

    console.log('📊 删除统计:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} 个`);
    });

    // 重新统计剩余任务
    const remaining = await client.query(`
      SELECT
        type,
        status,
        COUNT(*) as count
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
      ORDER BY type, status
    `, [projectId]);

    console.log('\n📊 删除后任务状态:');
    console.log('类型'.padEnd(20), '状态'.padEnd(15), '数量');
    console.log('='.repeat(50));

    remaining.rows.forEach(row => {
      console.log(row.type.padEnd(20), row.status.padEnd(15), row.count);
    });

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

cleanProjectFailedTasks();
