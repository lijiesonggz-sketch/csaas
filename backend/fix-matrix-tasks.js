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

    const projectId = '5b43dad9-18f0-436b-b2b1-417c08507c99';
    const clusteringTaskId = 'fbaa24f9-a82f-4f4d-9cd0-f69ca21137e4';

    console.log('📋 正在修复矩阵任务...');

    // 1. 获取聚类任务的结果
    const clusteringResult = await client.query(
      "SELECT result FROM ai_tasks WHERE id = $1",
      [clusteringTaskId]
    );

    if (clusteringResult.rows.length === 0 || !clusteringResult.rows[0].result) {
      console.log('❌ 未找到聚类任务结果');
      process.exit(1);
    }

    const clusteringData = clusteringResult.rows[0].result;
    const selectedResult = clusteringData.selectedResult || clusteringData.gpt4;

    console.log('✅ 聚类结果已加载');
    console.log('   大类数量:', selectedResult.categories.length);

    // 2. 获取所有失败的矩阵任务
    const failedTasks = await client.query(
      "SELECT id, input FROM ai_tasks WHERE project_id = $1 AND type = 'matrix' AND status = 'failed' ORDER BY created_at DESC LIMIT 5",
      [projectId]
    );

    console.log(`\n📝 找到 ${failedTasks.rows.length} 个失败的矩阵任务`);

    // 3. 修复每个失败的任务
    for (const task of failedTasks.rows) {
      console.log(`\n🔧 修复任务: ${task.id.substring(0, 8)}...`);

      // 更新 input，添加 clusteringResult
      const updatedInput = {
        ...task.input,
        clusteringResult: selectedResult
      };

      // 更新任务状态为 pending，让 BullMQ 重新处理
      await client.query(
        "UPDATE ai_tasks SET input = $1, status = 'pending', error_message = NULL, updated_at = NOW() WHERE id = $2",
        [updatedInput, task.id]
      );

      console.log(`  ✅ 已更新，等待重新执行`);
    }

    console.log('\n✅ 所有失败任务已修复！');
    console.log('   请在前端重新点击"生成成熟度矩阵"按钮');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
