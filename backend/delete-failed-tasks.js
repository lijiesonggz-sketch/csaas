const { Client } = require('pg');

async function deleteFailedTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 可配置的过滤条件
    const projectId = process.argv[2]; // 项目ID（可选）
    const taskType = process.argv[3]; // 任务类型（可选）
    const dryRun = process.argv[4] === '--dry-run'; // 是否只预览不删除

    console.log('🔍 查找失败任务...\n');

    // 构建查询条件
    let whereClause = 'WHERE t.status = $1';
    const params = ['failed'];

    let paramIndex = 2;
    if (projectId) {
      whereClause += ` AND t.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }
    if (taskType) {
      whereClause += ` AND t.type = $${paramIndex}`;
      params.push(taskType);
      paramIndex++;
    }

    // 查询要删除的任务
    const selectQuery = `
      SELECT
        t.id,
        t.project_id,
        p.name as project_name,
        t.type,
        t.status,
        t.progress,
        t.created_at,
        t.completed_at,
        t.error_message
      FROM ai_tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      ${whereClause}
      ORDER BY t.created_at DESC
    `;

    const result = await client.query(selectQuery, params);

    if (result.rows.length === 0) {
      console.log('✅ 没有找到符合条件的失败任务');
      return;
    }

    console.log(`📋 找到 ${result.rows.length} 个失败任务:\n`);
    console.log('项目ID'.padEnd(38), '项目名称'.padEnd(30), '类型'.padEnd(15), '进度', '创建时间');
    console.log('='.repeat(150));

    result.rows.forEach((task, i) => {
      const projectName = task.project_name || '未知项目';
      const progress = task.progress || 0;
      const createdAt = new Date(task.created_at).toLocaleString('zh-CN');

      console.log(
        task.id.padEnd(38),
        projectName.substring(0, 28).padEnd(30),
        task.type.padEnd(15),
        `${progress}%`.padEnd(6),
        createdAt
      );
    });

    if (dryRun) {
      console.log('\n⚠️  这是预览模式，不会实际删除任务');
      console.log('💡 要执行删除，请运行: node delete-failed-tasks.js [projectId] [taskType]');
      console.log('   例如: node delete-failed-tasks.js 8e815c62-f034-4497-8eab-a6f37d42b3d9');
      console.log('   例如: node delete-failed-tasks.js 8e815c62-f034-4497-8eab-a6f37d42b3d9 action_plan');
      return;
    }

    // 确认删除
    console.log('\n⚠️  警告：即将删除以上失败任务！');
    console.log('💡 这些操作不可逆，建议先备份数据库\n');

    // 执行删除
    const deleteQuery = `
      DELETE FROM ai_tasks
      ${whereClause}
      RETURNING id
    `;

    console.log('🗑️  正在删除失败任务...');

    const deleteResult = await client.query(deleteQuery, params);

    console.log(`✅ 成功删除 ${deleteResult.rows.length} 个失败任务\n`);

    // 显示删除的任务ID
    console.log('已删除的任务ID:');
    deleteResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.id}`);
    });

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

// 显示使用说明
if (process.argv.length === 2 && process.argv[1].endsWith('delete-failed-tasks.js')) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  失败任务删除工具                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📖 使用方法:');
  console.log('');
  console.log('1. 预览所有失败任务（不删除）:');
  console.log('   node delete-failed-tasks.js --dry-run');
  console.log('');
  console.log('2. 删除所有失败任务:');
  console.log('   node delete-failed-tasks.js');
  console.log('');
  console.log('3. 删除特定项目的失败任务:');
  console.log('   node delete-failed-tasks.js <项目ID>');
  console.log('');
  console.log('4. 删除特定项目特定类型的失败任务:');
  console.log('   node delete-failed-tasks.js <项目ID> <任务类型>');
  console.log('');
  console.log('   示例: node delete-failed-tasks.js 8e815c62-f034-4497-8eab-a6f37d42b3d9 action_plan');
  console.log('');
  console.log('📋 可用任务类型:');
  console.log('   - summary      (综述生成)');
  console.log('   - clustering   (聚类分析)');
  console.log('   - matrix       (成熟度矩阵)');
  console.log('   - questionnaire (问卷生成)');
  console.log('   - action_plan  (改进措施)');
  console.log('');
  console.log('⚠️  注意事项:');
  console.log('   - 建议先使用 --dry-run 预览要删除的任务');
  console.log('   - 删除操作不可逆，请谨慎操作');
  console.log('   - 建议在执行前备份数据库');
  console.log('');
  process.exit(0);
}

deleteFailedTasks();
