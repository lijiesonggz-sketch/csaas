const { Client } = require('pg');

async function checkRawResponse() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    const taskId = 'ad653aff-2cbe-4ca0-aa5d-d0d5d7952256';

    console.log('🔍 查询原始AI响应');

    const result = await client.query(`
      SELECT gpt4_result, claude_result, domestic_result, selected_model
      FROM ai_generation_results
      WHERE task_id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      console.log('❌ 未找到结果');
      return;
    }

    const row = result.rows[0];
    console.log('选中的模型:', row.selected_model);
    console.log('\n');

    // 检查每个模型的原始响应
    const models = [
      { name: 'GPT4', data: row.gpt4_result },
      { name: 'Claude', data: row.claude_result },
      { name: 'Domestic', data: row.domestic_result },
    ];

    for (const model of models) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`=== ${model.name} 原始响应（前4000字符） ===`);
      console.log(`${'='.repeat(80)}`);

      if (!model.data) {
        console.log('❌ 无数据');
        continue;
      }

      // 检查是否是字符串（原始AI响应）
      if (typeof model.data === 'string') {
        console.log(model.data.substring(0, 4000));
        console.log('\n... (响应被截断，完整长度:', model.data.length, '字符)');
      } else {
        // 已经是对象，说明已经解析过了
        console.log(JSON.stringify(model.data, null, 2).substring(0, 4000));
        console.log('\n... (响应被截断)');
      }
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

checkRawResponse();
