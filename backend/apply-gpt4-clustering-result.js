const { Client } = require('pg');

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

    const taskId = 'fbaa24f9-a82f-4f4d-9cd0-f69ca21137e4';

    console.log('📋 正在处理聚类任务:', taskId);

    // 1. 提取GPT-4的结果
    const eventResult = await client.query(
      "SELECT output FROM ai_generation_events WHERE task_id = $1 AND model = 'gpt4' ORDER BY created_at ASC LIMIT 1",
      [taskId]
    );

    if (eventResult.rows.length === 0 || !eventResult.rows[0].output || !eventResult.rows[0].output.content) {
      console.log('❌ 未找到GPT-4的生成结果');
      process.exit(1);
    }

    const gpt4Content = eventResult.rows[0].output.content;
    const gpt4Result = JSON.parse(gpt4Content);

    console.log('✅ GPT-4结果已提取');
    console.log('   - 大类数量:', gpt4Result.categories.length);
    const totalClusters = gpt4Result.categories.reduce((sum, cat) => sum + cat.clusters.length, 0);
    console.log('   - 聚类总数:', totalClusters);

    // 2. 构建完整的result对象
    const result = {
      gpt4: gpt4Result,
      claude: null,
      domestic: null,
      selectedModel: 'gpt4',
      selectedResult: gpt4Result
    };

    // 3. 更新数据库
    await client.query(
      "UPDATE ai_tasks SET result = $1, status = 'completed', updated_at = NOW() WHERE id = $2",
      [result, taskId]
    );

    console.log('✅ 数据库已更新');
    console.log('   - 状态: completed');
    console.log('   - 选中模型: gpt4');

    // 4. 验证更新
    const verifyResult = await client.query(
      "SELECT status, result FROM ai_tasks WHERE id = $1",
      [taskId]
    );

    if (verifyResult.rows.length > 0) {
      const task = verifyResult.rows[0];
      console.log('\n✅ 验证成功');
      console.log('   任务状态:', task.status);
      console.log('   有结果:', !!task.result);

      if (task.result && task.result.gpt4) {
        console.log('\n📊 聚类结果预览:');
        const gpt4 = task.result.gpt4;
        console.log('   大类 (Categories):', gpt4.categories.length);
        gpt4.categories.forEach((cat, idx) => {
          console.log(`     [${idx + 1}] ${cat.name}: ${cat.clusters.length} 个聚类`);
        });
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
