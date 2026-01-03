const { Client } = require('pg');

async function checkTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskIds = [
      '373ad9cb-9001-4943-92a5-a1e57fa13f3f',
      '40be5cfa-ae35-4e4a-b5f1-ec8ca41feb82'
    ];

    const results = [];

    for (const taskId of taskIds) {
      // Query task info
      const taskResult = await client.query(`
        SELECT
          id,
          type,
          status,
          created_at,
          updated_at,
          completed_at,
          progress,
          error_message,
          input
        FROM ai_tasks
        WHERE id = $1
      `, [taskId]);

      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0];

        // Query measures count
        const measuresResult = await client.query(`
          SELECT COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
        `, [taskId]);

        let input = null;
        try {
          input = task.input ? JSON.parse(task.input) : null;
        } catch (e) {
          input = { parseError: e.message };
        }

        results.push({
          taskId: task.id,
          status: task.status,
          progress: task.progress,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          completedAt: task.completed_at,
          error: task.error_message,
          measuresCount: parseInt(measuresResult.rows[0].count),
          input: input
        });
      }
    }

    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }, null, 2));
  } finally {
    await client.end();
  }
}

checkTasks();
