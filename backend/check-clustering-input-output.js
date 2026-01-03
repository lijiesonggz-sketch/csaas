const { DataSource } = require('typeorm');
const { AITask } = require('./src/database/entities/ai-task.entity');
const { AIGenerationEvent } = require('./src/database/entities/ai-generation-event.entity');

async function checkTask() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'csaas',
    entities: [AITask, AIGenerationEvent],
    synchronize: false,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(AITask);
  const eventRepo = dataSource.getRepository(AIGenerationEvent);

  const task = await repo.findOne({
    where: { task_id: '51627820-d0d1-492c-ab05-d78371fe324f' }
  });

  if (task) {
    console.log('=== 聚类任务信息 ===');
    console.log('任务ID:', task.task_id);
    console.log('状态:', task.status);
    console.log('错误:', task.error_message || '无');
    console.log('\n=== 输入数据 ===');
    if (task.input_data) {
      const input = JSON.parse(task.input_data);
      console.log('文档数量:', input.documents?.length || 0);
      if (input.documents) {
        input.documents.forEach((doc, i) => {
          console.log(`\n文档 ${i+1}:`);
          console.log('  ID:', doc.id);
          console.log('  名称:', doc.name);
          console.log('  内容长度:', doc.content?.length || 0, '字符');
          console.log('  前500字符:', doc.content?.substring(0, 500) || '无');
        });
      }
    }
    console.log('\n=== 生成事件 ===');
    const events = await eventRepo.find({
      where: { task_id: '51627820-d0d1-492c-ab05-d78371fe324f' },
      order: { created_at: 'ASC' }
    });
    console.log('事件数量:', events.length);
    events.forEach(event => {
      console.log(`\n[${event.model}] ${event.event_type}`);
      console.log('  开始时间:', event.created_at);
      console.log('  结束时间:', event.completed_at);
      if (event.input_prompt) {
        console.log('  Prompt长度:', event.input_prompt.length, '字符');
        console.log('  Prompt前1000字符:', event.input_prompt.substring(0, 1000));
      }
      if (event.raw_response) {
        console.log('  响应长度:', event.raw_response.length, '字符');
        console.log('  响应前1000字符:', event.raw_response.substring(0, 1000));
      }
      if (event.error_message) {
        console.log('  错误:', event.error_message);
      }
    });
  }

  await dataSource.destroy();
}

checkTask().catch(console.error);
