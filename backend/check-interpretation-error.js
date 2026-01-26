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

    // 查看任务结果
    const result = await client.query(`
      SELECT selected_result, result, input
      FROM ai_generation_results
      WHERE task_id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      console.log('❌ 未找到任务结果');
      return;
    }

    const row = result.rows[0];
    console.log('\n✅ 找到任务结果');

    console.log('\n=== 任务输入 ===');
    console.log('模式:', row.input?.interpretationMode);
    console.log('文档名称:', row.input?.standardDocument?.name);
    console.log('文档内容长度:', row.input?.standardDocument?.content?.length);

    console.log('\n=== 选中结果结构 ===');
    const selectedResult = row.selected_result;
    console.log('有 overview:', !!selectedResult.overview);
    console.log('有 key_requirements:', !!selectedResult.key_requirements);
    console.log('key_requirements 长度:', selectedResult.key_requirements?.length || 0);

    if (selectedResult.overview) {
      console.log('\noverview.background (前100字符):');
      console.log(selectedResult.overview?.background?.substring(0, 100));
    }

    if (selectedResult.key_requirements && selectedResult.key_requirements.length > 0) {
      console.log('\n第一个条款 (前500字符):');
      console.log(JSON.stringify(selectedResult.key_requirements[0], null, 2).substring(0, 500));
    }

    // 检查是否有解析失败的标记
    if (selectedResult.overview?.background === '解析失败') {
      console.log('\n❌ 检测到解析失败标记！');
      console.log('这说明后端在解析AI响应时出错，返回了降级的空结构');
    }

    console.log('\n=== 三个模型的完整结果（各前3000字符） ===');
    if (row.result) {
      if (row.result.gpt4) {
        console.log('\n--- GPT4 结果（前3000字符） ---');
        console.log(JSON.stringify(row.result.gpt4, null, 2).substring(0, 3000));
      }
      if (row.result.claude) {
        console.log('\n--- Claude 结果（前3000字符） ---');
        console.log(JSON.stringify(row.result.claude, null, 2).substring(0, 3000));
      }
      if (row.result.domestic) {
        console.log('\n--- Domestic 结果（前3000字符） ---');
        console.log(JSON.stringify(row.result.domestic, null, 2).substring(0, 3000));
      }
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

checkTask();
