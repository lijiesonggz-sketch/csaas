const { Client } = require('pg');

async function checkTaskErrors() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskIds = [
      '373ad9cb-9001-4943-92a5-a1e57fa13f3f',
      '40be5cfa-ae35-4e4a-b5f1-ec8ca41feb82'
    ];

    for (const taskId of taskIds) {
      console.log('\n' + '='.repeat(80));
      console.log('任务ID:', taskId);
      console.log('='.repeat(80));

      const result = await client.query(`
        SELECT status, progress, error_message
        FROM ai_tasks
        WHERE id = $1
      `, [taskId]);

      if (result.rows.length > 0) {
        const task = result.rows[0];
        console.log('状态:', task.status);
        console.log('进度:', task.progress, '%');
        console.log('错误信息:', task.error_message);

        // Analyze error position
        const match = task.error_message.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1]);
          console.log('\n错误位置:', position);

          // Calculate which cluster failed based on progress
          if (task.progress <= 20) {
            console.log('失败阶段: 第一个聚类 (gap分析完成,开始生成第一个聚类措施)');
          } else if (task.progress <= 30) {
            console.log('失败阶段: 第二个聚类生成中');
          } else if (task.progress <= 40) {
            console.log('失败阶段: 第三个聚类生成中');
          } else {
            console.log('失败阶段: 后续聚类生成中');
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('总结分析:');
    console.log('='.repeat(80));
    console.log('两个任务都因为AI生成的JSON格式错误而失败');
    console.log('需要增强JSON修复逻辑或改进Prompt以获得更稳定的输出');

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkTaskErrors();
