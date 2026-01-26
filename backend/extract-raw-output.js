const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    await client.connect();
    const taskId = '54cebda2-9e7a-4d4a-a8d1-909406388d9d';

    const result = await client.query(
      "SELECT model, output FROM ai_generation_events WHERE task_id = $1 AND model = 'gpt4' ORDER BY created_at LIMIT 1",
      [taskId]
    );

    if (result.rows.length > 0) {
      const output = result.rows[0].output;

      if (output) {
        // 保存整个output对象
        fs.writeFileSync('raw-output.json', JSON.stringify(output, null, 2), 'utf8');
        console.log('✅ 完整output已保存到: raw-output.json');

        if (output.content) {
          const content = output.content;
          fs.writeFileSync('raw-content.txt', content, 'utf8');
          console.log('✅ Content已保存到: raw-content.txt');
          console.log('Content长度:', content.length);
        }
      } else {
        console.log('❌ Output为空');
      }
    } else {
      console.log('❌ 未找到AI生成事件');
    }

  } finally {
    await client.end();
  }
})();
