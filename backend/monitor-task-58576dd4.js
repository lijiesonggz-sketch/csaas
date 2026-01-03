const { Client } = require('pg');

const taskId = '58576dd4-9c63-4420-b01d-f12ad9569809';
let lastProgress = 20;
let checkCount = 0;

async function checkTaskStatus() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        status,
        progress,
        error_message,
        created_at,
        updated_at
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (result.rows.length > 0) {
      const task = result.rows[0];
      checkCount++;

      console.log('\n' + '='.repeat(80));
      console.log(`📊 检查 #${checkCount} - ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
      console.log('='.repeat(80));
      console.log('状态:', task.status);
      console.log('进度:', task.progress, '%');

      const progressChange = task.progress - lastProgress;
      if (progressChange > 0) {
        console.log('进度变化: +', progressChange.toFixed(2), '%');
      }
      lastProgress = task.progress;

      // 查询措施数量
      const measuresResult = await client.query(`
        SELECT COUNT(*) as count
        FROM action_plan_measures
        WHERE task_id = $1
      `, [taskId]);

      const measureCount = parseInt(measuresResult.rows[0].count);
      console.log('已生成措施:', measureCount, '条');

      if (task.status === 'completed') {
        console.log('\n✅✅✅ 任务完成！✅✅✅');
        console.log('总计生成:', measureCount, '条改进措施');

        // 查询措施分布
        const clusterResult = await client.query(`
          SELECT cluster_name, COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
          GROUP BY cluster_name
          ORDER BY count DESC
        `, [taskId]);

        console.log('\n按聚类分布:');
        clusterResult.rows.forEach(row => {
          console.log(`  - ${row.cluster_name}: ${row.count}条`);
        });

        return true; // 停止监控
      } else if (task.status === 'failed') {
        console.log('\n❌❌❌ 任务失败 ❌❌❌');
        console.log('错误:', task.error_message);
        return true; // 停止监控
      } else {
        // 计算预计剩余时间
        if (progressChange > 0 && task.progress < 100) {
          const remainingPercent = 100 - task.progress;
          const estimatedMinutes = (remainingPercent / progressChange);
          console.log('预计剩余时间: ~', Math.round(estimatedMinutes), '分钟');
        }
        return false; // 继续监控
      }
    } else {
      console.log('❌ 未找到任务');
      return true; // 停止监控
    }
  } catch (err) {
    console.error('错误:', err.message);
    return true; // 出错停止监控
  } finally {
    await client.end();
  }
}

async function startMonitoring() {
  console.log('🚀 开始监控任务:', taskId);
  console.log('⏱️  每60秒检查一次...\n');

  // 立即检查一次
  const shouldStop = await checkTaskStatus();

  if (!shouldStop) {
    // 设置定时检查
    const interval = setInterval(async () => {
      const shouldStop = await checkTaskStatus();
      if (shouldStop) {
        clearInterval(interval);
        console.log('\n' + '='.repeat(80));
        console.log('监控结束');
        console.log('='.repeat(80));
        process.exit(0);
      }
    }, 60000); // 60秒 = 60000毫秒

    // 防止进程退出
    process.stdin.resume();
  } else {
    process.exit(0);
  }
}

startMonitoring();
