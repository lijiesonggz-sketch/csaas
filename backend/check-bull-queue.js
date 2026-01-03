/**
 * 检查BullMQ队列状态
 */
const { Queue } = require('bullmq');

async function checkBullQueue() {
  const queue = new Queue('ai-tasks', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    console.log('✅ Connected to BullMQ queue\n');

    //获取队列统计信息
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    console.log('📊 队列统计：');
    console.log(`   等待中: ${waiting}`);
    console.log(`   处理中: ${active}`);
    console.log(`   已完成: ${completed}`);
    console.log(`   失败: ${failed}`);
    console.log(`   延迟: ${delayed}\n`);

    // 获取等待中的任务
    if (waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, 5);
      console.log('📋 等待中的任务（前5个）：\n');
      for (const job of waitingJobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`Name: ${job.name}`);
        console.log(`Data: ${JSON.stringify(job.data, null, 2).substring(0, 200)}...`);
        console.log('');
      }
    }

    // 获取失败的任务
    if (failed > 0) {
      const failedJobs = await queue.getFailed(0, 5);
      console.log('\n❌ 失败的任务（前5个）：\n');
      for (const job of failedJobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`Name: ${job.name}`);
        console.log(`失败原因: ${job.failedReason}`);
        console.log('');
      }
    }

    await queue.close();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkBullQueue();
