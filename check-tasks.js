const { Client } = require('pg');

async function checkTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    // 查询最近的标准解读任务
    const result = await client.query(`
      SELECT
        id,
        type,
        status,
        input->>'interpretationMode' as mode,
        input->>'standardDocument->>name' as doc_name,
        created_at,
        updated_at,
        CASE
          WHEN result IS NOT NULL THEN '有结果'
          ELSE '无结果'
        END as has_result
      FROM ai_tasks
      WHERE type = 'standard_interpretation'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('📋 最近的标准解读任务：\n');
    console.log('ID\t\t\t状态\t\t模式\t\t文档\t\t\t\t创建时间\t\t\t结果');
    console.log('='.repeat(140));

    result.rows.forEach(row => {
      const mode = row.mode || '未指定';
      const time = new Date(row.created_at).toLocaleString('zh-CN');
      const docName = row.doc_name || '未知';
      console.log(`${row.id.substring(0, 8)}...\t${row.status}\t\t${mode}\t\t${docName.substring(0, 20)}\t${time}\t${row.has_result}`);
    });

    // 查看最新的任务结果
    const latestTask = result.rows[0];
    if (latestTask && latestTask.status === 'completed') {
      console.log('\n\n📊 最新任务的详细信息：');

      const detailResult = await client.query(`
        SELECT
          selected_model,
          confidence_level,
          jsonb_array_length((selected_result->'key_requirements')::jsonb) as clause_count,
          selected_result->>'risk_matrix' as has_risk_matrix,
          selected_result->>'implementation_roadmap' as has_roadmap,
          selected_result->>'checklists' as has_checklists
        FROM ai_generation_results
        WHERE task_id = $1
      `, [latestTask.id]);

      if (detailResult.rows.length > 0) {
        const detail = detailResult.rows[0];
        console.log(`选中的模型: ${detail.selected_model}`);
        console.log(`置信度: ${detail.confidence_level}`);
        console.log(`条款数量: ${detail.clause_count}`);
        console.log(`有风险矩阵: ${detail.has_risk_matrix ? '✅ 是' : '❌ 否'}`);
        console.log(`有实施路径: ${detail.has_roadmap ? '✅ 是' : '❌ 否'}`);
        console.log(`有检查清单: ${detail.has_checklists ? '✅ 是' : '❌ 否'}`);
      }
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkTasks();
