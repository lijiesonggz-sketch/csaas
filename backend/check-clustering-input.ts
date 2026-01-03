import { DataSource } from 'typeorm';
import { AITask } from './src/database/entities/ai-task.entity';
import { AIGenerationEvent } from './src/database/entities/ai-generation-event.entity';

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
    where: { id: '51627820-d0d1-492c-ab05-d78371fe324f' }
  });

  if (task) {
    console.log('=== 聚类任务信息 ===');
    console.log('任务ID:', task.id);
    console.log('状态:', task.status);
    console.log('错误:', task.errorMessage || '无');
    console.log('\n=== 输入数据 ===');
    if (task.input) {
      const input = task.input;
      console.log('文档数量:', input.documents?.length || 0);
      if (input.documents) {
        input.documents.forEach((doc: any, i: number) => {
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
      where: { taskId: '51627820-d0d1-492c-ab05-d78371fe324f' },
      order: { createdAt: 'ASC' }
    });
    console.log('事件数量:', events.length);
    events.forEach(event => {
      console.log(`\n[${event.model}]`);
      console.log('  开始时间:', event.createdAt);
      console.log('  执行时间:', event.executionTimeMs, 'ms');
      if (event.input && event.input.prompt) {
        console.log('  Prompt长度:', event.input.prompt.length, '字符');
      }
      if (event.output && event.output.content) {
        console.log('  响应长度:', event.output.content.length, '字符');
        console.log('  响应前1000字符:', event.output.content.substring(0, 1000));
      }
      if (event.errorMessage) {
        console.log('  错误:', event.errorMessage);
      }
    });
  }

  await dataSource.destroy();
}

checkTask().catch(console.error);
