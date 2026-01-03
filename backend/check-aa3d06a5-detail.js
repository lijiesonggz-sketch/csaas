const { Client } = require('pg');

async function checkTaskDetail() {
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

    const result = await client.query(`
      SELECT id, type, status, created_at, completed_at, result, input
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (result.rows.length > 0) {
      const t = result.rows[0];
      const createdTime = new Date(t.created_at);
      const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);

      console.log('任务详情：');
      console.log('='.repeat(100));
      console.log('任务ID:', t.id);
      console.log('任务类型:', t.type);
      console.log('状态:', t.status);
      console.log('创建时间:', beijingTime.toLocaleString('zh-CN'));
      console.log('结果长度:', JSON.stringify(t.result).length, '字符');

      if (t.result) {
        console.log('\n' + '='.repeat(100));
        console.log('结果内容：');
        console.log('='.repeat(100));
        console.log(JSON.stringify(t.result, null, 2));

        // 统计措施数量
        if (t.result.improvements) {
          let totalActions = 0;
          t.result.improvements.forEach(imp => {
            if (imp.actions && Array.isArray(imp.actions)) {
              totalActions += imp.actions.length;
            }
          });
          console.log('\n' + '='.repeat(100));
          console.log('措施统计：');
          console.log('='.repeat(100));
          console.log(`改进领域数: ${t.result.improvements.length} 个`);
          console.log(`总措施数: ${totalActions} 条`);
        }
      }
    } else {
      console.log('未找到该任务');
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkTaskDetail();
