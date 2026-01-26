const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

const aiTaskQueue = new Queue('ai-tasks', { connection });

async function checkQueue() {
  try {
    // 检查队列状态
    const counts = await aiTaskQueue.getJobCounts();
    console.log('=== AI任务队列状态 ===');
    console.log('等待中:', counts.waiting);
    console.log('活跃:', counts.active);
    console.log('完成:', counts.completed);
    console.log('失败:', counts.failed);
    console.log('延迟:', counts.delayed);
    console.log('暂停:', counts.paused);

    // 获取活跃的任务
    const activeJobs = await aiTaskQueue.getActive(0, 10);
    if (activeJobs.length > 0) {
      console.log('\n=== 活跃任务详情 ===');
      for (const job of activeJobs) {
        console.log('\nJob ID:', job.id);
        console.log('任务ID:', job.data.taskId);
        console.log('类型:', job.data.type);
        console.log('创建于:', new Date(job.timestamp).toLocaleString());
        console.log('处理次数:', job.attemptsMade);
        console.log('失败原因:', job.failedReason);
      }
    }

    // 获取失败的任务
    const failedJobs = await aiTaskQueue.getFailed(0, 5);
    if (failedJobs.length > 0) {
      console.log('\n=== 最近失败的任务 ===');
      for (const job of failedJobs) {
        console.log('\nJob ID:', job.id);
        console.log('任务ID:', job.data.taskId);
        console.log('类型:', job.data.type);
        console.log('失败原因:', job.failedReason);
      }
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await connection.quit();
    await aiTaskQueue.close();
  }
}

checkQueue();
