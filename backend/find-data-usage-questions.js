const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    await client.connect();
    const projectId = '8e815c62-f034-4497-8eab-a6f37d42b3d9';

    // 查询该项目的问卷任务ID
    const qTasks = await client.query(
      "SELECT id FROM ai_tasks WHERE project_id = $1 AND type = 'questionnaire' ORDER BY created_at",
      [projectId]
    );

    console.log('该项目的问卷任务:', qTasks.rows.length, '个');

    // 对每个任务查询AI生成事件
    for (const taskRow of qTasks.rows) {
      const taskId = taskRow.id;

      const events = await client.query(
        "SELECT model, output, created_at FROM ai_generation_events WHERE task_id = $1 ORDER BY created_at",
        [taskId]
      );

      if (events.rows.length > 0) {
        console.log(`\n任务 ${taskId.substring(0, 8)} 的AI生成事件:`);

        for (const eventRow of events.rows) {
          console.log(`  模型: ${eventRow.model}`);
          console.log(`  时间: ${eventRow.created_at.toISOString()}`);

          if (eventRow.output && eventRow.output.content) {
            try {
              const content = JSON.parse(eventRow.output.content);

              if (content.questions) {
                console.log(`  问题数量: ${content.questions.length}`);

                // 查找数据使用相关的问题
                const dataQuestions = content.questions.filter(q =>
                  q.cluster_name && q.cluster_name.includes('数据使用')
                );

                if (dataQuestions.length > 0) {
                  console.log('\n  ✅ 找到"数据使用"聚类的问题:');

                  dataQuestions.forEach((q, i) => {
                    console.log(`\n  问题${i+1}: ${q.question_id}`);
                    console.log(`  维度: ${q.dimension}`);
                    console.log(`  题目: ${q.question_text}`);
                    console.log('  选项:');
                    q.options.forEach(opt => {
                      console.log(`    ${opt.option_id}. ${opt.text}`);
                    });
                  });

                  // 找到后就退出
                  process.exit(0);
                }
              }
            } catch (e) {
              console.log(`  解析失败: ${e.message}`);
            }
          }
        }
      }
    }

    console.log('\n❌ 未在AI生成事件中找到"数据使用"聚类的问题');

  } finally {
    await client.end();
  }
})();
