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

  // 获取最新已完成的问卷任务
  const result = await client.query(`
    SELECT id, project_id, status, result, created_at
    FROM ai_tasks
    WHERE project_id = '8e815c62-f034-4497-8eab-a6f37d42b3d9'
      AND type = 'questionnaire'
      AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('✅ 最新已完成的问卷任务：\n');
    console.log(`任务ID: ${task.id}`);
    console.log(`项目ID: ${task.project_id}`);
    console.log(`状态: ${task.status}`);
    console.log(`创建时间: ${task.created_at}`);
    console.log(`有 result: ${!!task.result}`);

    if (task.result) {
      console.log(`\nresult keys:`, Object.keys(task.result));

      if (task.result.content) {
        console.log(`\n✅ 有 content 字段`);
        console.log(`content 类型:`, typeof task.result.content);

        try {
          const content = typeof task.result.content === 'string'
            ? JSON.parse(task.result.content)
            : task.result.content;

          console.log(`\n解析后的 keys:`, Object.keys(content));

          if (content.questionnaire) {
            console.log(`\n🎯 问卷题目数量: ${content.questionnaire.length} 题`);

            // 统计聚类
            const clusters = {};
            content.questionnaire.forEach(q => {
              if (!clusters[q.cluster_name]) {
                clusters[q.cluster_name] = 0;
              }
              clusters[q.cluster_name]++;
            });

            console.log(`\n📊 聚类分布 (${Object.keys(clusters).length} 个聚类)：`);
            Object.entries(clusters).forEach(([name, count]) => {
              console.log(`   ${name}: ${count} 题`);
            });

            console.log(`\n前3题示例：`);
            content.questionnaire.slice(0, 3).forEach((q, idx) => {
              console.log(`   ${idx + 1}. [${q.cluster_name}] ${q.question_text}`);
            });
          }
        } catch (e) {
          console.log(`\n❌ 解析 content 失败:`, e.message);
          console.log(`content 前500字符:`, JSON.stringify(task.result.content).substring(0, 500));
        }
      } else {
        console.log(`\n⚠️ 没有 content 字段`);
      }

      // 检查其他重要字段
      if (task.result.qualityScores) {
        console.log(`\n质量评分:`, task.result.qualityScores);
      }
      if (task.result.selectedModel) {
        console.log(`选中模型:`, task.result.selectedModel);
      }
      if (task.result.confidenceLevel) {
        console.log(`置信度:`, task.result.confidenceLevel);
      }
    }
  } else {
    console.log('❌ 没有找到已完成的问卷任务');
  }

  await client.end();
}

check().catch(console.error);
