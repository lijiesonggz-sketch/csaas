const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  await client.connect();

  // 查看所有events，包括错误
  const events = await client.query(
    'SELECT id, model, output, error_message, metadata, created_at FROM ai_generation_events WHERE task_id = $1 ORDER BY created_at',
    ['33c787e5-256a-49aa-a22c-97d544f76535']
  );

  console.log('='.repeat(70));
  console.log('AI Generation Events 详细记录');
  console.log('='.repeat(70));
  console.log('总记录数:', events.rows.length);

  events.rows.forEach((event, idx) => {
    const i = idx + 1;
    console.log('\n[' + i + '] ' + event.model);
    console.log('  创建时间:', event.created_at);
    console.log('  错误信息:', event.error_message || '无');

    if (event.output) {
      console.log('  Output类型:', typeof event.output);
      console.log('  Output keys:', Object.keys(event.output));

      if (event.output.content) {
        const content = event.output.content;
        console.log('  Content类型:', typeof content);
        console.log('  Content长度:', typeof content === 'string' ? content.length : 'N/A');

        // 尝试解析并比较前几个聚类
        try {
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          if (parsed.categories && parsed.categories.length > 0) {
            console.log('  第1个聚类名称:', parsed.categories[0].name);
            console.log('  第1个聚类描述前50字符:', parsed.categories[0].description?.substring(0, 50));

            // 打印第1个聚类的第1个cluster的第1个clause
            if (parsed.categories[0].clusters && parsed.categories[0].clusters.length > 0) {
              const cluster = parsed.categories[0].clusters[0];
              console.log('  第1个cluster名称:', cluster.name);
              if (cluster.clauses && cluster.clauses.length > 0) {
                console.log('  第1个clause前80字符:', JSON.stringify(cluster.clauses[0]).substring(0, 80));
              }
            }
          }
        } catch (e) {
          console.log('  解析失败:', e.message);
        }
      }
    }

    if (event.metadata) {
      console.log('  Metadata:', JSON.stringify(event.metadata).substring(0, 200));
    }
  });

  console.log('\n' + '='.repeat(70));

  // 查看ai_generation_results表中的原始数据
  const results = await client.query(
    'SELECT gpt4_result, claude_result, domestic_result FROM ai_generation_results WHERE task_id = $1',
    ['33c787e5-256a-49aa-a22c-97d544f76535']
  );

  if (results.rows.length > 0) {
    const r = results.rows[0];
    console.log('\n' + '='.repeat(70));
    console.log('ai_generation_results表对比');
    console.log('='.repeat(70));

    // 比较前3个聚类名称
    const compareCategories = (data, modelName) => {
      if (!data || !data.categories) {
        console.log('\n' + modelName + ': 无数据');
        return;
      }
      console.log('\n' + modelName + ':');
      console.log('  聚类数量:', data.categories.length);
      data.categories.slice(0, 3).forEach((cat, idx) => {
        console.log('  [' + (idx + 1) + '] ' + cat.name);
        console.log('      描述前50字符:', cat.description?.substring(0, 50));
      });
    };

    compareCategories(r.gpt4_result, 'GPT-4');
    compareCategories(r.domestic_result, 'Qwen');

    // 检查是否是同一个对象引用
    console.log('\n对象引用检查:');
    console.log('  GPT-4结果对象ID:', r.gpt4_result ? JSON.stringify(r.gpt4_result).substring(0, 50) : 'null');
    console.log('  Qwen结果对象ID:', r.domestic_result ? JSON.stringify(r.domestic_result).substring(0, 50) : 'null');

    // 深度比较前100个字符
    if (r.gpt4_result && r.domestic_result) {
      const gpt4Str = JSON.stringify(r.gpt4_result);
      const qwenStr = JSON.stringify(r.domestic_result);
      console.log('\n深度比较:');
      console.log('  GPT-4 JSON长度:', gpt4Str.length);
      console.log('  Qwen JSON长度:', qwenStr.length);
      console.log('  前100字符是否相同:', gpt4Str.substring(0, 100) === qwenStr.substring(0, 100));
      console.log('  完全相同:', gpt4Str === qwenStr);
    }
  }

  console.log('\n' + '='.repeat(70));
  await client.end();
})();
