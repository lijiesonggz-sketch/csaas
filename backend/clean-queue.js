const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

const aiTaskQueue = new Queue('ai-tasks', { connection });

async function cleanQueue() {
  try {
    console.log('=== 清理卡住的任务 ===\n');

    // 获取活跃任务
    const activeJobs = await aiTaskQueue.getActive(0, 10);
    console.log(`找到 ${activeJobs.length} 个活跃任务`);

    for (const job of activeJobs) {
      console.log(`\n处理任务 ${job.id}:`);
      console.log(`  任务ID: ${job.data.taskId}`);
      console.log(`  类型: ${job.data.type}`);
      console.log(`  状态: 活跃但已卡死`);

      // 将任务移到失败状态
      await job.moveToFailed({ message: '任务已超时，需要手动重试' });
      console.log(`  ✅ 已移到失败队列`);
    }

    // 清理失败的任务（可选）
    const failedCount = await aiTaskQueue.getJobCounts('failed');
    console.log(`\n当前失败任务数: ${failedCount.failed}`);

    console.log('\n✅ 清理完成！现在可以创建新任务测试了。');
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await connection.quit();
    await aiTaskQueue.close();
  }
}

cleanQueue();
