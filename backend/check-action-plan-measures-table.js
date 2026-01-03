const { Client } = require('pg');

async function checkActionPlanMeasuresTable() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询action_plan_measures表中12月30日的数据
    const result = await client.query(`
      SELECT task_id, cluster_name, title, priority, sort_order,
             LENGTH(description::text) as desc_length
      FROM action_plan_measures
      WHERE created_at >= '2025-12-30 00:00:00'
        AND created_at < '2025-12-31 00:00:00'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    if (result.rows.length > 0) {
      console.log(`找到 ${result.rows.length} 条措施记录（12月30日）：`);
      console.log('='.repeat(100));

      const tasks = {};
      result.rows.forEach(row => {
        if (!tasks[row.task_id]) {
          tasks[row.task_id] = [];
        }
        tasks[row.task_id].push(row);
      });

      for (const taskId in tasks) {
        console.log(`\n任务ID: ${taskId}`);
        console.log(`措施数量: ${tasks[taskId].length} 条`);

        // 获取任务创建时间
        const taskInfo = await client.query(`
          SELECT created_at FROM ai_tasks WHERE id = $1
        `, [taskId]);

        if (taskInfo.rows.length > 0) {
          const createdTime = new Date(taskInfo.rows[0].created_at);
          const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);
          console.log(`创建时间: ${beijingTime.toLocaleString('zh-CN')}`);
        }

        console.log('措施列表：');
        tasks[taskId].forEach((measure, idx) => {
          console.log(`  ${idx + 1}. ${measure.title || '(无标题)'}`);
          console.log(`     优先级: ${measure.priority || '未知'}`);
          console.log(`     描述长度: ${measure.desc_length} 字符`);
          if (measure.description && measure.description.length <= 200) {
            console.log(`     描述: ${measure.description.substring(0, 100)}...`);
          }
        });
        console.log('-'.repeat(100));
      }

      // 找措施最多的任务
      let maxMeasures = 0;
      let maxTaskId = null;
      for (const taskId in tasks) {
        if (tasks[taskId].length > maxMeasures) {
          maxMeasures = tasks[taskId].length;
          maxTaskId = taskId;
        }
      }

      if (maxMeasures >= 90) {
        console.log('\n\n' + '='.repeat(100));
        console.log(`找到90条措施的任务！`);
        console.log('='.repeat(100));
        console.log(`任务ID: ${maxTaskId}`);
        console.log(`措施数量: ${maxMeasures} 条`);
      }
    } else {
      console.log('action_plan_measures表中没有12月30日的数据');
    }

    // 查询整个action_plan_measures表
    const totalResult = await client.query(`
      SELECT task_id, COUNT(*) as count
      FROM action_plan_measures
      GROUP BY task_id
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('\n\n' + '='.repeat(100));
    console.log('措施最多的10个任务：');
    console.log('='.repeat(100));

    for (const row of totalResult.rows) {
      const taskInfo = await client.query(`
        SELECT created_at FROM ai_tasks WHERE id = $1
      `, [row.task_id]);

      let timeStr = '(未知)';
      if (taskInfo.rows.length > 0) {
        const createdTime = new Date(taskInfo.rows[0].created_at);
        const beijingTime = new Date(createdTime.getTime() + 8 * 3600 * 1000);
        timeStr = beijingTime.toLocaleString('zh-CN');
      }

      console.log(`\n任务ID: ${row.task_id}`);
      console.log(`措施数量: ${row.count} 条`);
      console.log(`创建时间: ${timeStr}`);
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkActionPlanMeasuresTable();
