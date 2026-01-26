/**
 * 测试进度追踪功能
 * 模拟聚类任务生成，检查progress_details是否正确保存
 */

const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    await client.connect();

    const testTaskId = uuidv4();
    console.log('🧪 测试任务ID:', testTaskId);

    // 1. 创建测试任务
    console.log('\n步骤1: 创建测试任务...');
    await client.query(
      `INSERT INTO ai_tasks (id, project_id, type, status, generation_stage, progress_details, input, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [testTaskId, '5b43dad9-18f0-436b-b2b1-417c08507c99', 'clustering', 'pending', 'pending', '{}', JSON.stringify({ documents: [{ id: 'test', name: 'Test Doc', content: 'Test content' }] })]
    );
    console.log('✅ 任务创建成功');

    // 2. 模拟进度更新（GPT-4开始生成）
    console.log('\n步骤2: 模拟GPT-4开始生成...');
    const progress1 = {
      gpt4: { status: 'generating', started_at: new Date().toISOString() },
      domestic: { status: 'pending', started_at: new Date().toISOString() }
    };
    await client.query(
      'UPDATE ai_tasks SET generation_stage = $1, progress_details = $2, updated_at = NOW() WHERE id = $3',
      ['generating_models', progress1, testTaskId]
    );
    console.log('✅ GPT-4开始生成');
    await sleep(1000);

    // 3. 检查进度是否保存
    console.log('\n步骤3: 检查进度是否保存...');
    const result1 = await client.query('SELECT progress_details FROM ai_tasks WHERE id = $1', [testTaskId]);
    console.log('当前进度:', JSON.stringify(result1.rows[0].progress_details, null, 2));
    if (result1.rows[0].progress_details.gpt4?.status === 'generating') {
      console.log('✅ 进度保存成功');
    } else {
      console.log('❌ 进度保存失败');
      process.exit(1);
    }

    // 4. 模拟GPT-4完成
    console.log('\n步骤4: 模拟GPT-4完成...');
    const progress2 = {
      gpt4: { status: 'completed', started_at: new Date().toISOString(), completed_at: new Date().toISOString(), duration_ms: 5000, tokens: 1000, cost: 0.01 },
      domestic: { status: 'generating', started_at: new Date().toISOString() }
    };
    await client.query(
      'UPDATE ai_tasks SET progress_details = $1, updated_at = NOW() WHERE id = $2',
      [progress2, testTaskId]
    );
    console.log('✅ GPT-4完成');
    await sleep(1000);

    // 5. 检查最终进度
    console.log('\n步骤5: 检查最终进度...');
    const result2 = await client.query('SELECT progress_details FROM ai_tasks WHERE id = $1', [testTaskId]);
    console.log('最终进度:', JSON.stringify(result2.rows[0].progress_details, null, 2));
    if (result2.rows[0].progress_details.gpt4?.status === 'completed') {
      console.log('✅ 最终进度保存成功');
    } else {
      console.log('❌ 最终进度保存失败');
      process.exit(1);
    }

    // 6. 测试status API
    console.log('\n步骤6: 测试status API...');
    const response = await fetch(`http://localhost:3000/ai-tasks/${testTaskId}/status`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API调用成功');
      console.log('返回数据:', JSON.stringify(data.data, null, 2));
      if (data.data.progress?.gpt4) {
        console.log('✅ 进度数据正确返回给前端');
        console.log('   GPT-4状态:', data.data.progress.gpt4.status);
        console.log('   GPT-4消息:', data.data.progress.gpt4.message);
      } else {
        console.log('❌ API返回的进度数据为空');
      }
    } else {
      console.log('❌ API调用失败');
    }

    // 7. 清理测试任务
    console.log('\n步骤7: 清理测试任务...');
    await client.query('DELETE FROM ai_tasks WHERE id = $1', [testTaskId]);
    console.log('✅ 测试完成，任务已清理');

    console.log('\n📊 总结:');
    console.log('✅ 数据库进度保存: 正常');
    console.log('✅ API进度返回: 需要验证');
    console.log('\n如果API返回有gpt4字段，说明修复成功！');
    console.log('请在从前端创建新的聚类任务来测试。');

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await client.end();
  }
})();
