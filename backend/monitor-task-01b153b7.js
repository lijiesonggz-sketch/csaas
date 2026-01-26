const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb';

  const result = await client.query(
    'SELECT id, type, status, progress, error_message, created_at, updated_at FROM ai_tasks WHERE id = $1',
    [taskId]
  );

  if (result.rows.length === 0) {
    console.log('❌ 任务不存在');
  } else {
    const task = result.rows[0];
    const now = new Date();
    const updated = new Date(task.updated_at);
    const created = new Date(task.created_at);
    const elapsedSinceCreated = Math.floor((now - created) / 1000);
    const elapsedSinceUpdate = Math.floor((now - updated) / 1000);

    console.log('📊 任务状态 -', now.toLocaleString('zh-CN'));
    console.log('━'.repeat(70));
    console.log('任务ID:', task.id);
    console.log('任务类型:', task.type);
    console.log('当前状态:', task.status);
    console.log('创建时间:', created.toLocaleString('zh-CN'));
    console.log('距创建:', elapsedSinceCreated, '秒前');
    console.log('最后更新:', updated.toLocaleString('zh-CN'));
    console.log('距更新:', elapsedSinceUpdate, '秒前');

    if (task.progress) {
      try {
        const p = typeof task.progress === 'string' ? JSON.parse(task.progress) : task.progress;
        console.log('');
        console.log('进度详情:');
        if (p.stage) console.log('  阶段:', p.stage);
        if (p.percentage !== undefined) console.log('  百分比:', p.percentage + '%');
        if (p.message) console.log('  消息:', p.message);
      } catch (e) {
        console.log('  进度:', task.progress);
      }
    }

    if (task.error_message) {
      console.log('');
      console.log('❌ 错误:', task.error_message);
    }

    console.log('━'.repeat(70));
  }

  await client.end();
}

checkTask();
