const { Client } = require('pg');

async function compareTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const task1 = '2f1284ba-8b18-40a7-a787-ed05a9a14128'; // 12月29日 - 141条款
  const task2 = '51627820-d0d1-492c-ab05-d78371fe324f'; // 今天 - 13条款

  console.log('=== 对比两个聚类任务 ===\n');

  for (const taskId of [task1, task2]) {
    console.log(`\n【任务ID】 ${taskId}`);
    const res = await client.query(
      "SELECT created_at, input, result, error_message FROM ai_tasks WHERE id = $1",
      [taskId]
    );

    if (res.rows.length > 0) {
      const task = res.rows[0];
      const date = task.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`创建时间: ${date}`);
      console.log(`状态: ${res.rows[0].result ? '有result' : '无result'}`);

      if (task.input) {
        console.log(`\n输入文档:`);
        task.input.documents?.forEach((doc, i) => {
          console.log(`  ${i+1}. ${doc.name}`);
          console.log(`     长度: ${doc.content?.length || 0} 字符`);
          // 显示前500字符
          console.log(`     前500字符:\n${doc.content?.substring(0, 500)}...`);
        });
      }
    }
  }

  // 查看AI generation events
  console.log('\n\n=== AI Generation Events 对比 ===\n');

  for (const taskId of [task1, task2]) {
    console.log(`\n【任务】 ${taskId.substring(0, 8)}...`);

    const eventRes = await client.query(
      "SELECT model, input, error_message, created_at FROM ai_generation_events WHERE task_id = $1 ORDER BY created_at ASC",
      [taskId]
    );

    console.log(`Events数量: ${eventRes.rows.length}`);

    eventRes.rows.forEach((event, idx) => {
      console.log(`\n  [${idx+1}] ${event.model}`);
      console.log(`  创建时间: ${event.created_at}`);

      if (event.input && event.input.prompt) {
        const prompt = event.input.prompt;
        console.log(`  Prompt长度: ${prompt.length} 字符`);

        // 检查prompt的关键部分
        const三层Index = prompt.indexOf('三层结构');
        const聚类要求Index = prompt.indexOf('聚类要求');
        const覆盖Index = prompt.indexOf('100%覆盖');

        console.log(`  包含'三层结构': ${三层Index >= 0 ? '是 (' + 三层Index + ')' : '否'}`);
        console.log(`  包含'聚类要求': ${聚类要求Index >= 0 ? '是' : '否'}`);
        console.log(`  包含'100%覆盖': ${覆盖Index >= 0 ? '是' : '否'}`);

        // 显示prompt的关键要求部分
        const要求Start = prompt.indexOf('**聚类要求**');
        if (要求Start >= 0) {
          const要求End = prompt.indexOf('**', 要求Start + 20);
          if (要求End >= 0) {
            console.log(`  聚类要求部分:\n${prompt.substring(要求Start, 要求End + 200)}...`);
          }
        }
      }

      if (event.error_message) {
        console.log(`  错误: ${event.error_message.substring(0, 100)}...`);
      }
    });
  }

  await client.end();
}

compareTasks().catch(console.error);
