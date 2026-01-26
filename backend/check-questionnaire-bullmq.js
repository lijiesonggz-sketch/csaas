const { Client } = require('pg');
const { Queue: QueueRedis } = require('bullmq');
const Redis = require('ioredis');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'csaas',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// 创建Redis连接
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const aiTasksQueue = new QueueRedis('ai-tasks', { connection: redis });

(async () => {
  await client.connect();
  const taskId = '70aa5fdc-6923-4ad1-8082-9a3b33238a4e';

  try {
    console.log('📋 检查问卷任务状态...\n');

    // 1. 检查数据库任务状态
    const taskResult = await client.query(
      'SELECT id, type, status, progress, error_message, created_at, updated_at FROM ai_tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];
      console.log('📊 数据库任务状态:');
      console.log(`  ID: ${task.id}`);
      console.log(`  类型: ${task.type}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  进度: ${task.progress}%`);
      console.log(`  错误: ${task.error_message || '无'}`);
      console.log(`  创建时间: ${task.created_at}`);
      console.log(`  更新时间: ${task.updated_at}`);
      console.log(`  运行时长: ${Math.round((new Date(task.updated_at) - new Date(task.created_at)) / 1000 / 60)}分钟`);
    }

    // 2. 检查BullMQ队列中的job状态
    console.log('\n🔄 检查BullMQ队列状态...');

    const jobs = await aiTasksQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], 0, 100);

    const targetJob = jobs.find(job => job.data.taskId === taskId);

    if (targetJob) {
      console.log('\n📦 BullMQ Job信息:');
      console.log(`  Job ID: ${targetJob.id}`);
      console.log(`  状态: ${targetJob.state}`);
      console.log(`  任务ID: ${targetJob.data.taskId}`);
      console.log(`  类型: ${targetJob.data.type}`);
      console.log(`  项目ID: ${targetJob.data.projectId}`);
      console.log(`  失败原因: ${targetJob.failedReason || '无'}`);
      console.log(`  返回值: ${targetJob.returnvalue ? '有' : '无'}`);
      console.log(`  尝试次数: ${targetJob.attemptsMade}/${targetJob.opts.attempts || '无限制'}`);

      // 获取job的堆栈trace
      const stacktrace = targetJob.stacktrace;
      if (stacktrace && stacktrace.length > 0) {
        console.log('\n❌ 错误堆栈:');
        stacktrace.forEach((trace, index) => {
          console.log(`  尝试 ${index + 1}:`);
          console.log(trace.split('\n').slice(0, 5).join('\n'));
        });
      }
    } else {
      console.log('\n⚠️  在BullMQ队列中未找到该Job');
      console.log('  可能的原因:');
      console.log('    1. Job已完成并被清理');
      console.log('    2. Job从未被加入队列');
      console.log('    3. Redis连接问题');
    }

    // 3. 检查队列统计
    console.log('\n📈 队列统计:');
    const waitingCount = await aiTasksQueue.getWaitingCount();
    const activeCount = await aiTasksQueue.getActiveCount();
    const completedCount = await aiTasksQueue.getCompletedCount();
    const failedCount = await aiTasksQueue.getFailedCount();

    console.log(`  等待中: ${waitingCount}`);
    console.log(`  处理中: ${activeCount}`);
    console.log(`  已完成: ${completedCount}`);
    console.log(`  失败: ${failedCount}`);

    // 4. 检查所有活跃的job
    if (activeCount > 0) {
      console.log('\n🔥 当前活跃的Jobs:');
      const activeJobs = await aiTasksQueue.getActive();
      activeJobs.forEach(job => {
        console.log(`  Job ${job.id}: ${job.data.type} (任务ID: ${job.data.taskId})`);
      });
    }

    // 5. 检查失败的job
    if (failedCount > 0) {
      console.log('\n❌ 失败的Jobs (最近5个):');
      const failedJobs = await aiTasksQueue.getFailed(0, 5);
      failedJobs.forEach(job => {
        console.log(`  Job ${job.id}: ${job.data.type}`);
        console.log(`    任务ID: ${job.data.taskId}`);
        console.log(`    失败原因: ${job.failedReason?.substring(0, 100)}...`);
      });
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await client.end();
    await aiTasksQueue.close();
    await redis.quit();
  }
})();
