const { Client } = require('pg');

async function checkLatestInterpretation() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查找最新的标准解读任务
    const result = await client.query(`
      SELECT task_id, selected_model, selected_result
      FROM ai_generation_results
      WHERE task_id IN (
        SELECT id FROM ai_tasks
        WHERE type = 'standard_interpretation'
        ORDER BY created_at DESC
        LIMIT 1
      )
    `);

    if (result.rows.length === 0) {
      console.log('❌ 未找到标准解读任务');
      return;
    }

    const row = result.rows[0];
    console.log('=== 最新标准解读任务 ===');
    console.log('Task ID:', row.task_id);
    console.log('Selected Model:', row.selected_model);
    console.log('\n=== 条款统计 ===');

    const selectedResult = row.selected_result;
    console.log('总条款数:', selectedResult.key_requirements?.length || 0);
    console.log('有 overview:', !!selectedResult.overview);
    console.log('有 key_terms:', !!selectedResult.key_terms);
    console.log('key_terms 数量:', selectedResult.key_terms?.length || 0);
    console.log('有 implementation_guidance:', !!selectedResult.implementation_guidance);
    console.log('有 risk_matrix:', !!selectedResult.risk_matrix);
    console.log('有 implementation_roadmap:', !!selectedResult.implementation_roadmap);

    if (selectedResult.key_requirements && selectedResult.key_requirements.length > 0) {
      console.log('\n=== 条款列表 ===');
      selectedResult.key_requirements.forEach((req, idx) => {
        console.log(`\n${idx + 1}. ${req.clause_id}: ${req.clause_text?.substring(0, 100)}...`);
        console.log(`   章节: ${req.chapter || '无'}`);
        console.log(`   优先级: ${req.priority}`);
        console.log(`   clause_full_text长度: ${req.clause_full_text?.length || 0}`);
      });
    }

    // 检查输入文档内容长度
    const taskResult = await client.query(`
      SELECT input
      FROM ai_tasks
      WHERE id = $1
    `, [row.task_id]);

    if (taskResult.rows.length > 0) {
      const input = taskResult.rows[0].input;
      console.log('\n=== 输入信息 ===');
      console.log('模式:', input.interpretationMode);
      console.log('文档名称:', input.standardDocument?.name);
      console.log('文档内容长度:', input.standardDocument?.content?.length);
      console.log('文档内容预览（前500字符）:');
      console.log(input.standardDocument?.content?.substring(0, 500));
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkLatestInterpretation();
