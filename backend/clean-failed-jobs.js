/**
 * 清理BullMQ中的失败任务
 */
const { Queue } = require('bullmq');

async function cleanFailedJobs() {
  const queue = new Queue('ai-tasks', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    console.log('🧹 正在清理失败的任务...\n');

    // 获取失败的任务
    const failedJobs = await queue.getFailed();
    console.log(`📊 发现 ${failedJobs.length} 个失败的任务\n`);

    // 删除所有失败的任务
    for (const job of failedJobs) {
      console.log(`   删除失败任务: ${job.id}`);
      await job.remove();
    }

    console.log('\n✅ 清理完成！');
    await queue.close();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

cleanFailedJobs();
