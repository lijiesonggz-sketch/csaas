const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: '.env.development' });

async function checkTasks() {
  let connection;
  try {
    // 创建连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'csaas',
    });

    console.log('Database connected\n');

    const projectId = 'f504ab5a-7347-4148-bffe-cc55d97752e6';

    // 查询最近的10个任务
    const [tasks] = await connection.query(
      `SELECT id, type, status, error_message, created_at, completed_at, generation_stage
       FROM ai_task
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [projectId]
    );

    console.log('Project ' + projectId + ' recent tasks:\n');
    console.log('ID\t\t\tType\t\t\t\t\tStatus\t\tError');
    console.log('='.repeat(150));

    tasks.forEach(task => {
      const id = task.id.substring(0, 8) + '...';
      const type = task.type.padEnd(30);
      const status = task.status.padEnd(15);
      const error = (task.error_message || 'None').substring(0, 50);
      console.log(id + '\t' + type + '\t' + status + '\t' + error);
    });

    // 找到最近的标准解读任务
    const latestInterpretationTask = tasks.find(t => t.type === 'standard_interpretation');

    if (latestInterpretationTask) {
      console.log('\n\nLatest standard_interpretation task details:');
      console.log('='.repeat(100));
      console.log('Task ID: ' + latestInterpretationTask.id);
      console.log('Status: ' + latestInterpretationTask.status);
      console.log('Error: ' + (latestInterpretationTask.error_message || 'None'));
      console.log('Created: ' + latestInterpretationTask.created_at);
      console.log('Completed: ' + (latestInterpretationTask.completed_at || 'Not completed'));
      console.log('Stage: ' + (latestInterpretationTask.generation_stage || 'N/A'));

      // 查询该任务的事件
      const [events] = await connection.query(
        `SELECT id, model, input, output, error_message, created_at, execution_time_ms
         FROM ai_generation_event
         WHERE task_id = ?
         ORDER BY created_at ASC`,
        [latestInterpretationTask.id]
      );

      console.log('\nAI model calls (' + events.length + ' records):');
      console.log('='.repeat(100));

      events.forEach((event, idx) => {
        console.log('\n[' + (idx + 1) + '] Model: ' + event.model);
        console.log('    Created: ' + event.created_at);
        console.log('    Duration: ' + (event.execution_time_ms || 'N/A') + ' ms');
        if (event.error_message) {
          console.log('    ERROR: ' + event.error_message);
        }
        if (event.output) {
          try {
            const output = JSON.parse(event.output);
            if (output.content) {
              const content = output.content;
              const preview = typeof content === 'string'
                ? content.substring(0, 200)
                : JSON.stringify(content).substring(0, 200);
              console.log('    Output preview: ' + preview + '...');
            }
          } catch (e) {
            console.log('    Output: (parse error or empty)');
          }
        }
      });
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkTasks();
