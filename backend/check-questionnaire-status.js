const { createConnection } = require('typeorm');
const { AITask } = require('./dist/database/entities/ai-task.entity');

async function check() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'csaas',
    entities: [AITask],
    synchronize: false,
  });

  const tasks = await connection.getRepository(AITask).find({
    where: { type: 'questionnaire' },
    order: { createdAt: 'DESC' },
    take: 3
  });

  console.log('📋 最近的问卷任务:');
  tasks.forEach(task => {
    console.log('\n任务ID:', task.id);
    console.log('状态:', task.status);
    console.log('创建时间:', task.createdAt);
    console.log('是否有 clusterGenerationStatus:', !!task.clusterGenerationStatus);
    if (task.clusterGenerationStatus) {
      console.log('clusterGenerationStatus:', JSON.stringify(task.clusterGenerationStatus, null, 2));
    }
  });

  await connection.close();
}

check().catch(console.error);
