const mysql = require('mysql2/promise');
const fs = require('fs');
const envContent = fs.readFileSync('.env.development', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) env[key.trim()] = values.join('=').trim();
});

async function checkTask() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '3306'),
    user: env.DB_USERNAME || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_DATABASE || 'csaas',
  });

  const projectId = 'f504ab5a-7347-4148-bffe-cc55d97752e6';
  
  // 查询最新的任务
  const [tasks] = await connection.query(
    `SELECT id, type, status, error_message, created_at, result, generation_stage
     FROM ai_task 
     WHERE project_id = ?
     ORDER BY created_at DESC 
     LIMIT 1`,
    [projectId]
  );

  if (tasks.length > 0) {
    const task = tasks[0];
    console.log('Latest task:');
    console.log('ID:', task.id);
    console.log('Type:', task.type);
    console.log('Status:', task.status);
    console.log('Created:', task.created_at);
    console.log('Stage:', task.generation_stage);
    console.log('Error:', task.error_message || 'None');
    
    if (task.result) {
      const result = JSON.parse(task.result);
      console.log('Result keys:', Object.keys(result));
    }
  } else {
    console.log('No tasks found for this project');
  }
  
  await connection.end();
}
checkTask();
