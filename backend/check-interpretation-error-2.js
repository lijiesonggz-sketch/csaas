const { Client } = require('pg');

async function checkTask() {
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

    console.log('🔍 查询任务:', taskId);

    // 先查看表结构
    const schema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_generation_results'
      ORDER BY ordinal_position
    `);

    console.log('\n=== ai_generation_results 表结构 ===');
    schema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // 查看任务结果
    const result = await client.query(`
      SELECT *
      FROM ai_generation_results
      WHERE task_id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      console.log('\n❌ 未找到任务结果');
      return;
    }

    const row = result.rows[0];
    console.log('\n✅ 找到任务结果');
    console.log('结果包含的列:', Object.keys(row).join(', '));

    console.log('\n=== 选中结果结构 ===');
    const selectedResult = row.selected_result;
    console.log('有 overview:', !!selectedResult?.overview);
    console.log('有 key_requirements:', !!selectedResult?.key_requirements);
    console.log('key_requirements 长度:', selectedResult?.key_requirements?.length || 0);

    if (selectedResult?.overview) {
      console.log('\noverview.background:');
      console.log(selectedResult.overview.background?.substring(0, 200));
    }

    if (selectedResult?.key_requirements && selectedResult.key_requirements.length > 0) {
      console.log('\n第一个条款:');
      console.log(JSON.stringify(selectedResult.key_requirements[0], null, 2).substring(0, 800));
    }

    // 检查是否有解析失败的标记
    if (selectedResult?.overview?.background === '解析失败') {
      console.log('\n❌ 检测到解析失败标记！');
      console.log('这说明后端在解析AI响应时出错，返回了降级的空结构');
    }

    console.log('\n=== 完整的selected_result（前5000字符） ===');
    console.log(JSON.stringify(selectedResult, null, 2).substring(0, 5000));

  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

checkTask();
