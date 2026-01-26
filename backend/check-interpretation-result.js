const pg = require('pg');

async function checkResult() {
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();

    const res = await client.query(
      "SELECT id, type, status, result FROM ai_tasks WHERE id = '5a90c1e2-c2ec-43e6-b97f-963f480905b0'"
    );

    if (res.rows[0]) {
      const task = res.rows[0];
      const result = task.result;

      console.log('=== 标准解读结果分析 ===\n');

      // key_requirements 在顶层，不是在 domestic 下
      if (result.key_requirements) {
        const keys = Object.keys(result.key_requirements);
        console.log('条款数量:', keys.length);
        console.log('Keys类型:', Array.isArray(result.key_requirements) ? 'Array' : 'Object');

        console.log('\n所有条款列表:');
        if (Array.isArray(result.key_requirements)) {
          result.key_requirements.forEach((req, i) => {
            console.log(`  ${i + 1}. [${req.clause_id}] ${(req.clause_text || req.clause_summary || '无文本').substring(0, 80)}...`);
          });
        } else {
          // It's an object with numeric keys
          for (const key of keys) {
            const req = result.key_requirements[key];
            const text = req.clause_text || req.clause_summary || '无文本';
            console.log(`  [${req.clause_id}] ${text.substring(0, 80)}...`);
          }
        }

        console.log('\n=== 问题诊断 ===');
        console.log('❌ 只找到了', keys.length, '个条款！');
        console.log('预期应该有30-60个条款（GBT 43208.1-2023 是一个较长的标准）');
        console.log('\n可能的原因：');
        console.log('1. 条款提取阶段AI模型只提取了12个条款');
        console.log('2. 质量验证阶段过滤掉了大部分条款');
        console.log('3. 结果聚合阶段丢失了数据');
      }

      // 检查 selectedModel 和 confidenceLevel
      console.log('\n=== 模型选择 ===');
      console.log('Selected Model:', result.selectedModel);
      console.log('Confidence Level:', result.confidenceLevel);
      console.log('Quality Scores:', JSON.stringify(result.qualityScores, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    await client.end();
  }
}

checkResult();
