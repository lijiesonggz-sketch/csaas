const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();

  const result = await client.query(`
    SELECT id, result
    FROM ai_tasks
    WHERE id = '23c656e2-6a67-4133-b453-069c61d2110e'
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('✅ 找到问卷任务\n');

    let resultData = task.result;
    if (typeof resultData.content === 'string') {
      resultData = JSON.parse(resultData.content);
    } else if (resultData.content) {
      resultData = resultData.content;
    }

    if (resultData.questionnaire && Array.isArray(resultData.questionnaire)) {
      console.log(`📊 问卷题目总数: ${resultData.questionnaire.length}\n`);

      // 统计题型
      const typeStats = {};
      const typeSamples = {};

      resultData.questionnaire.forEach((q, idx) => {
        const type = q.question_type;
        if (!typeStats[type]) {
          typeStats[type] = 0;
          typeSamples[type] = [];
        }
        typeStats[type]++;
        if (typeSamples[type].length < 3) {
          typeSamples[type].push({ id: q.question_id, text: q.question_text.substring(0, 50) });
        }
      });

      console.log('📈 题型统计：');
      Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} 题`);
      });

      console.log('\n📋 各题型示例：');
      Object.entries(typeSamples).forEach(([type, samples]) => {
        console.log(`\n[${type}] 示例：`);
        samples.forEach((sample, idx) => {
          console.log(`   ${idx + 1}. ${sample.id}: ${sample.text}...`);
        });
      });

      // 检查是否符合前端期望的值
      console.log('\n❓ 前端期望的题型值：');
      console.log('   SINGLE_CHOICE - 单选题');
      console.log('   MULTIPLE_CHOICE - 多选题');
      console.log('   RATING - 评分题');

      console.log('\n🔍 匹配情况：');
      const expectedTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RATING'];
      expectedTypes.forEach(expectedType => {
        const matched = resultData.questionnaire.filter(q => q.question_type === expectedType).length;
        console.log(`   ${expectedType}: ${matched} 题`);
      });
    }
  }

  await client.end();
}

check().catch(console.error);
