// 检查 BullMQ 队列状态
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null
});

async function checkQueue() {
  try {
    const queue = new Queue('ai-tasks', { connection });

    // 获取队列中的任务数量
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();

    console.log('📊 BullMQ 队列状态：');
    console.log(`   等待中 (waiting): ${waiting}`);
    console.log(`   处理中 (active): ${active}`);
    console.log(`   已完成 (completed): ${completed}`);
    console.log(`   失败 (failed): ${failed}`);

    // 获取正在处理的任务
    if (active > 0) {
      const activeJobs = await queue.getActive(0, active);
      console.log(`\n⏳ 正在处理的任务：`);
      activeJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ID: ${job.id}, Task ID: ${job.data.taskId}`);
      });
    }

    // 获取等待中的任务
    if (waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, Math.min(waiting, 5));
      console.log(`\n⏰ 等待中的任务（前5个）：`);
      waitingJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ID: ${job.id}, Task ID: ${job.data.taskId}`);
      });
    }

    // 获取失败的任务
    if (failed > 0) {
      const failedJobs = await queue.getFailed(0, Math.min(failed, 5));
      console.log(`\n❌ 失败的任务（前5个）：`);
      failedJobs.forEach((job, idx) => {
        console.log(`   ${idx + 1}. Job ID: ${job.id}, Task ID: ${job.data.taskId}`);
        console.log(`      失败原因: ${job.failedReason}`);
      });
    }

    await queue.close();
    await connection.quit();
  } catch (error) {
    console.error('❌ 检查队列失败:', error.message);
    await connection.quit();
  }
}

checkQueue();
