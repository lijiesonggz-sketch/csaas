const { Client } = require('pg');

const taskId = '7bbfcec1-52b8-48fa-99cf-6af32e13ae29';
let lastStatus = '';
let lastProgress = -1;

async function checkStatus() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  try {
    const result = await client.query(
      'SELECT status, progress, error_message, updated_at FROM ai_tasks WHERE id = $1',
      [taskId]
    );

    if (result.rows.length > 0) {
      const task = result.rows[0];
      const statusChanged = task.status !== lastStatus;
      const progressChanged = task.progress !== lastProgress;

      if (statusChanged || progressChanged) {
        const now = new Date().toLocaleTimeString('zh-CN');
        console.log('[' + now + '] 状态更新:');

        if (statusChanged) {
          console.log('  状态: ' + (lastStatus || '初始') + ' → ' + task.status);
          lastStatus = task.status;
        }

        if (progressChanged) {
          console.log('  进度: ' + lastProgress + '% → ' + task.progress + '%');
          lastProgress = task.progress;
        }

        if (task.error_message) {
          console.log('  错误: ' + task.error_message);
        }

        console.log('');
      }

      if (task.status === 'completed') {
        console.log('🎉 聚类任务已完成！');
        client.end();
        process.exit(0);
      } else if (task.status === 'failed') {
        console.log('❌ 聚类任务失败！');
        console.log('错误信息: ' + (task.error_message || '未知错误'));
        client.end();
        process.exit(1);
      }
    } else {
      console.log('❌ 任务不存在');
      client.end();
      process.exit(1);
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  }

  await client.end();
}

console.log('🔄 开始监控聚类任务: ' + taskId);
console.log('每分钟检查一次状态更新...');
console.log('');

// 首次检查
checkStatus();

// 之后每分钟检查一次
setInterval(checkStatus, 60000);
