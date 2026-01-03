const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = 'de8fdad2-ed81-4d03-944b-c414cc76b914';

  // 查询任务结果
  const result = await client.query(
    'SELECT id, type, status, result, input FROM ai_tasks WHERE id = $1',
    [taskId]
  );

  if (result.rows.length === 0) {
    console.log('❌ 任务不存在');
  } else {
    const task = result.rows[0];
    console.log('任务ID:', task.id);
    console.log('状态:', task.status);
    console.log('');
    console.log('Result类型:', typeof task.result);
    console.log('Result是否为null:', task.result === null);
    console.log('Result是否为空对象:', task.result && Object.keys(task.result).length === 0);
    console.log('');

    if (!task.result) {
      console.log('❌ 任务result字段为空!');
      console.log('');
      console.log('📥 检查input字段:');
      const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;
      console.log('  input存在:', !!input);
      console.log('  input.standardDocument长度:', input.standardDocument?.length || 0);

      // 统计文档数
      if (input.standardDocument) {
        const matches = input.standardDocument.match(/=== .* ===/g);
        if (matches) {
          console.log('  发现文档数:', matches.length);
          console.log('  文档列表:');
          matches.forEach((m, i) => {
            console.log('    ' + (i+1) + '.', m.replace(/=== /g, '').replace(/ ===/g, ''));
          });
        }
      }
    } else {
      console.log('✅ 任务result存在!');
      console.log('Result键:', Object.keys(task.result));
      console.log('');
      console.log('Result完整内容:');
      console.log(JSON.stringify(task.result, null, 2));
    }
  }

  await client.end();
}

checkTask();
