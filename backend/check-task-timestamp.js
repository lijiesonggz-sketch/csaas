const { Client } = require('pg');

async function checkTaskTimestamp() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskId = 'aa3d06a5-158d-45ff-b464-ee17f032d64a';

    // 获取任务详情
    const result = await client.query(`
      SELECT id, type, status, created_at, updated_at, completed_at, progress, error_message
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (result.rows.length > 0) {
      const t = result.rows[0];
      console.log('任务时间信息：');
      console.log('='.repeat(60));
      console.log('任务ID:', t.id);
      console.log('任务类型:', t.type);
      console.log('状态:', t.status);
      console.log('创建时间:', t.created_at);
      console.log('更新时间:', t.updated_at);
      console.log('完成时间:', t.completed_at);
      console.log('进度:', t.progress, '%');
      console.log('错误信息:', t.error_message || '(无)');

      // 计算执行时间
      if (t.created_at && t.completed_at) {
        const created = new Date(t.created_at);
        const completed = new Date(t.completed_at);
        const duration = completed - created;
        const minutes = Math.floor(duration / 60000);
        const hours = (minutes / 60).toFixed(1);
        console.log('执行时长:', minutes, '分钟 (约', hours, '小时)');
      }
      console.log('='.repeat(60));
    } else {
      console.log('未找到该任务');
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkTaskTimestamp();
