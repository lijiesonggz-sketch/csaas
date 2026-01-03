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
    console.log('✅ 问卷任务数据结构检查：\n');

    let resultData = task.result;
    if (typeof resultData.content === 'string') {
      resultData = JSON.parse(resultData.content);
    } else if (resultData.content) {
      resultData = resultData.content;
    }

    if (resultData.questionnaire && Array.isArray(resultData.questionnaire)) {
      // 查看前3题的完整结构
      console.log('📋 前3题完整数据结构：\n');
      resultData.questionnaire.slice(0, 3).forEach((q, idx) => {
        console.log(`题目 ${idx + 1}: ${q.question_id}`);
        console.log(`  文本: ${q.question_text.substring(0, 60)}...`);
        console.log(`  类型: ${q.question_type}`);
        console.log(`  选项数: ${q.options ? q.options.length : 0}`);

        if (q.options && q.options.length > 0) {
          console.log(`  选项详情：`);
          q.options.forEach((opt, optIdx) => {
            console.log(`    ${optIdx + 1}. ${opt.option_id || opt.id}: ${opt.text ? opt.text.substring(0, 40) : '...'}`);
            console.log(`       分数: ${opt.score}`);
            console.log(`       级别: ${opt.level || opt.option_level || '无'}`);
            console.log(`       描述: ${opt.description ? opt.description.substring(0, 40) : '无'}...`);
          });
        }
        console.log('');
      });

      // 统计选项格式
      console.log('\n📊 选项格式统计：');
      let optionIdCount = 0;
      let levelCount = 0;
      let descriptionCount = 0;

      resultData.questionnaire.forEach(q => {
        if (q.options) {
          q.options.forEach(opt => {
            if (opt.option_id || opt.id) optionIdCount++;
            if (opt.level) levelCount++;
            if (opt.description) descriptionCount++;
          });
        }
      });

      console.log(`   有 option_id 的选项: ${optionIdCount}`);
      console.log(`   有 level 的选项: ${levelCount}`);
      console.log(`   有 description 的选项: ${descriptionCount}`);
    }
  }

  await client.end();
}

check().catch(console.error);
