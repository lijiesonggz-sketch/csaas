const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres',
});

async function queryQuestionnaireTasks() {
  try {
    await client.connect();

    // 首先查看所有任务类型和状态
    const allTasksResult = await client.query(`
      SELECT type, status, COUNT(*) as count
      FROM ai_tasks
      GROUP BY type, status
      ORDER BY type, status
    `);

    console.log('\n=== 所有任务统计 ===\n');
    allTasksResult.rows.forEach(row => {
      console.log(`${row.type} - ${row.status}: ${row.count}个`);
    });

    // 查询问卷生成任务（所有状态）
    const questionnaireResult = await client.query(`
      SELECT id, type, status, created_at, updated_at
      FROM ai_tasks
      WHERE type = 'questionnaire'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n=== 最近的问卷生成任务（所有状态）===\n');

    if (questionnaireResult.rows.length === 0) {
      console.log('未找到问卷生成任务');
    } else {
      questionnaireResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. 任务ID: ${row.id}`);
        console.log(`   类型: ${row.type}`);
        console.log(`   状态: ${row.status}`);
        console.log(`   创建时间: ${row.created_at}`);
        console.log(`   更新时间: ${row.updated_at}`);
        console.log('');
      });

      const completedTasks = questionnaireResult.rows.filter(r => r.status === 'completed');
      if (completedTasks.length > 0) {
        console.log(`\n✅ 最新的已完成问卷任务ID: ${completedTasks[0].id}`);
      } else {
        console.log(`\n⚠️ 有${questionnaireResult.rows.length}个问卷任务，但都未完成`);
        console.log(`最新的问卷任务ID（${questionnaireResult.rows[0].status}状态）: ${questionnaireResult.rows[0].id}`);
      }
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await client.end();
  }
}

queryQuestionnaireTasks();
