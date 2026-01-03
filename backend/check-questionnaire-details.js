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

  // Get all questionnaire tasks
  const result = await client.query(`
    SELECT id, type, status, input, created_at
    FROM ai_tasks
    WHERE type = 'questionnaire'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log(`\n📊 最近 ${result.rows.length} 个问卷任务：\n`);

  result.rows.forEach((task, idx) => {
    console.log(`${idx + 1}. 任务ID: ${task.id}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   创建时间: ${task.created_at}`);
    console.log(`   输入参数:`, JSON.stringify(task.input, null, 2));
    console.log('');
  });

  // Get latest completed questionnaire and count questions
  const completedTask = await client.query(`
    SELECT id, result
    FROM ai_tasks
    WHERE type = 'questionnaire' AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (completedTask.rows.length > 0) {
    const task = completedTask.rows[0];
    console.log(`\n✅ 最新完成的问卷任务: ${task.id}`);

    let result = task.result;
    // Parse content if it's a string
    if (typeof result.content === 'string') {
      result = JSON.parse(result.content);
    } else if (result.content) {
      result = result.content;
    }

    if (result.questionnaire && Array.isArray(result.questionnaire)) {
      console.log(`   问卷题目总数: ${result.questionnaire.length} 题`);

      // Group by cluster
      const clusters = {};
      result.questionnaire.forEach(q => {
        if (!clusters[q.cluster_name]) {
          clusters[q.cluster_name] = [];
        }
        clusters[q.cluster_name].push(q);
      });

      console.log(`   聚类领域数: ${Object.keys(clusters).length}\n`);
      console.log(`   各聚类题目数量：`);
      Object.entries(clusters).forEach(([clusterName, questions]) => {
        console.log(`      - ${clusterName}: ${questions.length} 题`);
      });
    }

    console.log(`\n   前3题示例：`);
    result.questionnaire.slice(0, 3).forEach((q, idx) => {
      console.log(`      ${idx + 1}. [${q.cluster_name}] ${q.question_text}`);
    });
  }

  await client.end();
}

check().catch(console.error);
