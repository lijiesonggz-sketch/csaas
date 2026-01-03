const { AppDataSource } = require('./dist/src/config/database.config.js');
const { AITask } = require('./dist/src/database/entities/ai-task.entity.js');
const { AIGenerationEvent } = require('./dist/src/database/entities/ai-generation-event.entity.js');

async function checkTasks() {
  await AppDataSource.initialize();
  const taskRepo = AppDataSource.getRepository(AITask);
  const eventRepo = AppDataSource.getRepository(AIGenerationEvent);

  // 查找最新的 action_plan 任务
  const tasks = await taskRepo.find({
    where: { generation_type: 'action_plan' },
    order: { created_at: 'DESC' },
    take: 3
  });

  console.log('最新的 3 个 action_plan 任务:\n');

  for (const task of tasks) {
    console.log('Task ID:', task.id);
    console.log('Status:', task.status);
    console.log('Created:', task.created_at);
    console.log('Updated:', task.updated_at);
    console.log('Error Message:', task.error_message || 'None');
    console.log('\n--- 事件记录 ---');

    const events = await eventRepo.find({
      where: { task_id: task.id },
      order: { timestamp: 'ASC' }
    });

    events.forEach(e => {
      console.log(`[${e.timestamp}] ${e.event_type}: ${e.message}`);
      if (e.metadata) {
        console.log('  Metadata:', JSON.stringify(e.metadata, null, 2));
      }
    });

    console.log('\n' + '='.repeat(60) + '\n');
  }

  await AppDataSource.destroy();
}

checkTasks().catch(console.error);
