const { Client } = require('pg');

async function checkStuckTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查找正在执行的任务
    const result = await client.query(`
      SELECT id, project_id, type, status, error_message, created_at, updated_at, result, input
      FROM ai_tasks
      WHERE type = 'standard_interpretation' AND status = 'processing'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ 没有找到正在执行的标准解读任务');
      return;
    }

    const task = result.rows[0];
    console.log('=== 正在执行的任务 ===');
    console.log('任务ID:', task.id);
    console.log('项目ID:', task.project_id);
    console.log('创建时间:', task.created_at);
    console.log('更新时间:', task.updated_at);

    const createdTime = new Date(task.created_at).getTime();
    const updatedTime = new Date(task.updated_at).getTime();
    const currentTime = Date.now();
    const createdMinutesAgo = Math.floor((currentTime - createdTime) / 60000);
    const updatedMinutesAgo = Math.floor((currentTime - updatedTime) / 60000);

    console.log(`创建于: ${createdMinutesAgo}分钟前`);
    console.log(`更新于: ${updatedMinutesAgo}分钟前`);

    // 检查input
    if (task.input) {
      const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;
      console.log('\n任务输入:');
      console.log('  解读模式:', input.interpretationMode || '未指定');
      console.log('  文档名称:', input.standardDocument?.name || '无');
      console.log('  文档内容长度:', input.standardDocument?.content?.length || 0, '字符');
    }

    // 检查是否有result
    if (task.result) {
      console.log('\n⚠️ 任务有result但状态仍是processing（可能卡在保存阶段）');
    } else {
      console.log('\n任务还没有result（还在AI生成阶段）');
    }

    console.log('\n建议: 如果任务执行超过10分钟仍未完成，可能已卡死，需要终止');
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkStuckTask();
